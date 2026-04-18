// scripts/weekly-email.mjs
// 매주 일요일 점심(KST) GitHub Actions로 실행
// Supabase에서 전체 데이터 → 엑셀 생성 → Resend로 이메일 발송

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const SEASON_NAMES = {
  1: '맹아기', 2: '4-5엽기', 3: '개화기',
  4: '착과기', 5: '경핵기', 6: '성숙기', 7: '수확기',
};

const SEASON_OPTION_LABELS = {
  1: ['지켜봄', '맹아정리 (약한 것들)', '맹아정리 (센 것들)', '가지배치', '해충잡기'],
  2: ['약한가지 세력조절', '강한가지 세력조절', '해충잡기', '개화직전 세력조절'],
  3: ['꽃송이로 세력조절', '송이손질', '최종송이결정', '가지뉘임', '개화시작', '만개'],
  4: ['송이털기', '송이크기정리', '알솎이', '세력조절 (강한가지)', '세력조절 (약한가지)', '가지정리'],
  5: ['세력조절 (강한가지)', '세력조절 (약한가지)', '알솎이'],
  6: ['세력조절 (강한가지)', '세력조절 (약한가지)', '알솎이'],
};

function formatSeasonData(seasonData, season) {
  if (!seasonData || !season) return '';
  const data = seasonData[season];
  if (!data) return '';

  if (Number(season) === 7) {
    const qualities = ['착색', '당도', '등숙', '잎상태', '열매품질'];
    return qualities.filter(q => data[q]).map(q => `${q}: ${data[q]}점`).join(', ');
  }

  const labels = SEASON_OPTION_LABELS[season] || [];
  const checked = [];
  labels.forEach((label, i) => {
    if (data[`option${i + 1}`]) checked.push(label);
  });
  return checked.join(', ');
}

async function main() {
  console.log('📊 데이터 조회 중...');

  // 나무 데이터
  const { data: trees, error: treeErr } = await supabase
    .from('trees')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: true });

  if (treeErr) throw new Error(`trees 조회 실패: ${treeErr.message}`);
  if (!trees || trees.length === 0) {
    console.log('데이터 없음, 이메일 발송 스킵');
    return;
  }

  // 라벨 데이터
  const { data: labelData } = await supabase.from('tree_labels').select('*');
  const labelMap = {};
  if (labelData) {
    labelData.forEach(l => { labelMap[l.id] = l; });
  }

  console.log(`📝 ${trees.length}건 데이터로 엑셀 생성 중...`);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Farm Data');

  // 헤더
  const headers = [
    'Tree ID', '나무 이름', '날짜', '생육시기', '체크항목',
    '세력', '균형', '해충', '부분방제', '코멘트', '생산자', '사진', '사진 URL'
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  ws.columns = [
    { width: 8 },   // Tree ID
    { width: 14 },  // 나무 이름
    { width: 12 },  // 날짜
    { width: 10 },  // 생육시기
    { width: 30 },  // 체크항목
    { width: 6 },   // 세력
    { width: 6 },   // 균형
    { width: 6 },   // 해충
    { width: 8 },   // 부분방제
    { width: 20 },  // 코멘트
    { width: 10 },  // 생산자
    { width: 10 },  // 사진
    { width: 50 },  // 사진 URL
  ];

  for (const row of trees) {
    const lbl = labelMap[`Tree-${row.id}`] || {};
    const seasonChecks = formatSeasonData(row.season_data, row.season);
    const imageUrl = row.images && row.images.length > 0 ? row.images[0] : '';

    const rowData = [
      row.id,
      lbl.name || '',
      row.date,
      SEASON_NAMES[row.season] || '',
      seasonChecks,
      row.power || '',
      row.balance || '',
      row.bugs !== null && row.bugs !== undefined ? row.bugs : '',
      row.partial_treatment ? 'Yes' : '',
      row.comments || '',
      row.producer || '',
      '', // 사진 썸네일 자리
      imageUrl,
    ];

    const rowIndex = ws.rowCount; // 현재 행 번호 (addRow 전)
    const excelRow = ws.addRow(rowData);
    excelRow.height = 45;
    excelRow.alignment = { vertical: 'middle' };

    if (imageUrl) {
      const urlCell = excelRow.getCell(13);
      urlCell.value = { text: '원본 보기', hyperlink: imageUrl };
      urlCell.font = { color: { argb: 'FF0066CC' }, underline: true };

      // 썸네일 삽입
      const thumbUrl = row.thumbnails && row.thumbnails.length > 0 ? row.thumbnails[0] : imageUrl;
      try {
        const resp = await fetch(thumbUrl);
        if (resp.ok) {
          const arrBuf = await resp.arrayBuffer();
          const imageId = wb.addImage({
            buffer: Buffer.from(arrBuf),
            extension: 'jpeg',
          });
          ws.addImage(imageId, {
            tl: { col: 11, row: rowIndex },
            ext: { width: 40, height: 40 },
          });
        }
      } catch (e) {
        // 이미지 실패해도 계속 진행
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();

  // KST 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10);

  console.log('📧 이메일 발송 중...');

  const { data: emailResult, error: emailErr } = await resend.emails.send({
    from: 'Podowa Farm <onboarding@resend.dev>',
    to: ['ehfl147@gmail.com'],
    subject: `🌿 Podowa 주간 리포트 (${dateStr})`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #2d3748;">🌿 Podowa 주간 리포트</h2>
        <p style="color: #718096;">${dateStr} 기준 전체 데이터 (${trees.length}건)</p>
        <p style="color: #718096;">첨부된 엑셀 파일을 확인해주세요.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #a0aec0;">Podowa Farm Tracker에서 자동 발송</p>
      </div>
    `,
    attachments: [
      {
        filename: `podowa-report-${dateStr}.xlsx`,
        content: Buffer.from(buffer).toString('base64'),
      },
    ],
  });

  if (emailErr) throw new Error(`이메일 발송 실패: ${emailErr.message}`);

  console.log(`✅ 이메일 발송 완료! ID: ${emailResult?.id}`);
}

main().catch((err) => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
