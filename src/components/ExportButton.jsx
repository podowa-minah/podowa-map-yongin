// src/components/ExportButton.jsx
import React from 'react';
import { supabase } from '../supabaseClient';
import { useLabels } from '../LabelContext';
import ExcelJS from 'exceljs';

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
    // 수확기: 품질 점수
    const qualities = ['착색', '당도', '등숙', '잎상태', '열매품질'];
    return qualities.filter(q => data[q]).map(q => `${q}: ${data[q]}점`).join(', ');
  }

  // 체크박스 항목
  const labels = SEASON_OPTION_LABELS[season] || [];
  const checked = [];
  labels.forEach((label, i) => {
    if (data[`option${i + 1}`]) checked.push(label);
  });
  return checked.join(', ');
}

async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      // 썸네일로 리사이즈
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // 정사각형 크롭
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        canvas.toBlob((b) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsArrayBuffer(b);
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
}

export default function ExportButton() {
  const [loading, setLoading] = React.useState(false);
  const { labels } = useLabels();

  const exportToXlsx = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('trees')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('데이터가 없습니다');
        setLoading(false);
        return;
      }

      // LabelContext에서 가져온 labels 사용 (key: "Tree-1-1" 형식)
      const labelMap = labels || {};

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

      // 컬럼 너비
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
        { width: 40 },  // 사진 URL
      ];

      // 데이터 행 추가
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // LabelContext key: "Tree-1-1", trees.id: "1-1"
        const lbl = labelMap[`Tree-${row.id}`] || {};
        const seasonChecks = formatSeasonData(row.season_data, row.season);
        const imageUrl = row.images && row.images.length > 0 ? row.images[0] : '';
        const thumbUrl = row.thumbnails && row.thumbnails.length > 0 ? row.thumbnails[0] : '';

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

        const excelRow = ws.addRow(rowData);
        excelRow.height = 45;
        excelRow.alignment = { vertical: 'middle' };

        // 사진 URL 하이퍼링크
        if (imageUrl) {
          const urlCell = excelRow.getCell(13);
          urlCell.value = { text: '원본 보기', hyperlink: imageUrl };
          urlCell.font = { color: { argb: 'FF0066CC' }, underline: true };
        }

        // 사진 썸네일 삽입 (썸네일 URL 있으면 그걸 사용, 없으면 원본에서 리사이즈)
        if (imageUrl) {
          try {
            const imgBuffer = await fetchImageAsBase64(thumbUrl || imageUrl);
            if (imgBuffer) {
              const imageId = wb.addImage({
                buffer: imgBuffer,
                extension: 'jpeg',
              });
              ws.addImage(imageId, {
                tl: { col: 11, row: i + 1 },
                ext: { width: 40, height: 40 },
              });
            }
          } catch (e) {
            // 이미지 실패해도 계속 진행
          }
        }
      }

      // 다운로드
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `farm-tracker-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();

    } catch (error) {
      console.error('Export error:', error);
      alert(`내보내기 실패: ${error.message}`);
    }

    setLoading(false);
  };

  return (
    <button
      onClick={exportToXlsx}
      disabled={loading}
      style={{
        padding: '10px 20px',
        background: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = '#059669';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#10b981';
      }}
    >
      {loading ? '📥 내보내는 중...' : '📊 Excel 내보내기'}
    </button>
  );
}
