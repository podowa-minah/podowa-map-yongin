// src/lib/variety-records.js
// 나무 일별기록(trees) → 품종×월 집계 — 연간생육 뷰의 "진짜 데이터원".
// CLAUDE.md §10 LAYER 2: 순수 함수만 (DOM/React 안 씀). 저장 X, 매번 trees에서 계산.
//
// 핵심 원칙(minari): 품종 = tree_labels.name (포도맵 라벨 그대로).
//   "2-3 함부르크"면 함부르크. 사진엔 나무번호+날짜(2-3 · 6/10)가 박힌다.
//   - 사진: trees.images / trees.thumbnails
//   - 한일: trees.season_data 에서 그날 season 의 체크된 작업
//   - 진단: power/balance/bugs → calcTreeScore → scoreBand (scoring.js 재사용)

import { calcTreeScore, scoreBand, powerScore, POWER_IDEAL } from './scoring';

// 안전 숫자 변환 (scoring.js 내부 toNumOrNull 과 동일 규칙 — DB가 text 컬럼이라 "?" 등 섞임)
function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 점수를 끌어내린 요인 — 짧은 한글 라벨. ("왜 경보/주의인지" 설명용)
//   세력: 이상점(~3.35)에서 멀면 약함/과함, 균형: 낮으면 나쁨, 해충: 많으면 감점.
export function weakFactors(row) {
  if (!row) return [];
  const out = [];
  const p = toNum(row.power);
  if (p != null && powerScore(p) < 3.0) out.push(p < POWER_IDEAL ? '세력 약함' : '세력 과함');
  const b = toNum(row.balance);
  if (b != null && b < 3.0) out.push('균형 나쁨');
  const bg = toNum(row.bugs);
  if (bg != null && bg > 2.0) out.push('해충 많음');
  return out;
}

// 품종 가이드 뷰용 짧은 한일 라벨 — TreeModal SEASON_OPTION_LABELS 의 표시용 축약본.
// (체크 순서/개수는 TreeModal 과 동일하게 유지해야 option 인덱스가 맞는다)
export const WORK_LABELS = {
  1: ['지켜봄', '맹아정리(약)', '맹아정리(강)', '가지배치', '해충잡기'],
  2: ['약한가지 세력조절', '강한가지 세력조절', '해충잡기', '개화직전 세력조절'],
  3: ['꽃송이 세력조절', '송이손질', '최종송이결정', '가지뉘임', '개화시작', '만개'],
  4: ['송이털기', '송이크기정리', '알솎이', '세력조절(강)', '세력조절(약)', '가지정리'],
  5: ['세력조절(강)', '세력조절(약)', '알솎이'],
  6: ['세력조절(강)', '세력조절(약)', '알솎이'],
};
// 7(수확기)은 체크 대신 품질 점수 — season_data[7] = { 착색:n, 당도:n, ... }
export const QUALITY_KEYS = ['착색', '당도', '등숙', '잎상태', '열매품질'];

// "MM/DD/YYYY" → 월(1~12). 형식 안전: ISO("YYYY-MM-DD")도 받는다. (TZ 영향 없게 문자열 파싱)
export function monthOfDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (s.includes('/')) {                  // MM/DD/YYYY
    const m = parseInt(s.split('/')[0], 10);
    return m >= 1 && m <= 12 ? m : null;
  }
  if (s.includes('-')) {                  // YYYY-MM-DD
    const m = parseInt(s.split('-')[1], 10);
    return m >= 1 && m <= 12 ? m : null;
  }
  return null;
}

// "YYYY-MM-DD"(또는 MM/DD/YYYY, 타임스탬프) → 연도(2026 등). 못 읽으면 null.
//   연간 검색용: 2027년에 2026년 사진만 골라보려면 이 연도로 거른다. (minari 요청)
export function yearOfDate(dateStr) {
  const s = String(dateStr || '').split('T')[0];
  let y = null;
  if (s.includes('/')) y = parseInt(s.split('/')[2], 10);       // MM/DD/YYYY
  else if (s.includes('-')) y = parseInt(s.split('-')[0], 10);  // YYYY-MM-DD
  return Number.isFinite(y) ? y : null;
}

// 나무 기록에 실제로 존재하는 연도들 — 최신 먼저. (연도 선택기 옵션용)
export function availableYears(treeData) {
  const set = new Set();
  for (const rows of Object.values(treeData || {}))
    for (const row of rows || []) {
      const y = yearOfDate(row.date);
      if (y) set.add(y);
    }
  return [...set].sort((a, b) => b - a);
}

// "MM/DD/YYYY"(또는 ISO) → 그 달의 몇 주차(1~4). 1~7일=1주, 8~14=2주, 15~21=3주, 22일~=4주.
//   (다섯째 주는 minari 요청대로 4주차에 포함)
export function weekOfMonth(dateStr) {
  const s = String(dateStr || '');
  let day = null;
  if (s.includes('/')) day = parseInt(s.split('/')[1], 10);       // MM/DD/YYYY
  else if (s.includes('-')) day = parseInt(s.split('-')[2], 10);  // YYYY-MM-DD
  if (!day || isNaN(day)) return 4;
  return Math.min(4, Math.ceil(day / 7));
}

// 한 entry 의 날짜 문자열 — 나무기록은 date, 직접올림은 created_at. (타임존 영향 없게 문자열 그대로)
function dateOfEntry(e) {
  return String((e?.kind === 'tree' ? e.date : e?.created_at) || '').split('T')[0];
}

// "YYYY-MM-DD"(또는 MM/DD/YYYY) → "26년 4월 6일" (주차 헤더 옆 날짜). 형식 안전, 못 읽으면 ''.
export function ymdKo(dateStr) {
  const s = String(dateStr || '').split('T')[0];
  let y, m, d;
  if (s.includes('/'))      { const p = s.split('/'); m = +p[0]; d = +p[1]; y = +p[2]; }   // MM/DD/YYYY
  else if (s.includes('-')) { const p = s.split('-'); y = +p[0]; m = +p[1]; d = +p[2]; }   // YYYY-MM-DD
  else return '';
  if (!y || !m || !d) return '';
  return `${String(y).slice(2)}년 ${m}월 ${d}일`;
}

// 한 주차(entry 배열) → 그 안에서 가장 이른 기록의 "26년 4월 6일". (같은 달·주차라 day 비교로 충분)
export function weekStartKo(entries) {
  if (!entries?.length) return '';
  const dayOf = (e) => {
    const s = dateOfEntry(e);
    if (s.includes('/')) return Number(s.split('/')[1]);
    if (s.includes('-')) return Number(s.split('-')[2]);
    return 99;
  };
  let first = entries[0];
  for (const e of entries) if (dayOf(e) < dayOf(first)) first = e;
  return ymdKo(dateOfEntry(first));
}

// "MM/DD/YYYY" → "M/D" (사진 밑 날짜 도장)
export function mdOfDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr);
  if (s.includes('/')) { const [mm, dd] = s.split('/'); return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`; }
  if (s.includes('-')) { const [, mm, dd] = s.split('-'); return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`; }
  return '';
}

// 한 기록의 "한일" 라벨 배열 — 그날 season 의 체크된 작업만.
export function workOfRow(row) {
  if (!row) return [];
  const season = Number(row.season);
  const state = row.season_data?.[row.season] || row.season_data?.[String(season)] || {};
  if (season === 7) {
    return QUALITY_KEYS.filter((q) => state[q]).map((q) => `${q} ${state[q]}점`);
  }
  const labels = WORK_LABELS[season] || [];
  return labels.filter((_, i) => state[`option${i + 1}`]);
}

// 한 기록 → 진단 ({score, band:{label,color}, reasons:[…]} | null)
//   reasons: 점수 깎은 요인 — "경보/주의" 옆에 왜인지 보여줄 때 씀.
export function diagnosisOfRow(row) {
  const score = calcTreeScore(row);
  if (score == null) return null;
  return { score, band: scoreBand(score), reasons: weakFactors(row) };
}

// 한 기록(사진 있는 것만) → variety_guides 엔트리 모양으로 변환 (기존 UI가 그대로 소비).
//   추가 메타: treeId, md, month, work[], diag — 사진 캡션·진단 배지에 쓴다.
function rowToEntry(row, treeId) {
  const month = monthOfDate(row.date);
  if (month == null) return null;
  const imgs = Array.isArray(row.images) ? row.images : [];
  if (!imgs.length) return null;          // 연간생육은 사진 중심 — 사진 없는 기록은 제외
  const thumbs = Array.isArray(row.thumbnails) ? row.thumbnails : [];
  return {
    id: `tree-${treeId}-${row.row_id || row.date}`,
    kind: 'tree',
    treeId,
    month,
    date: row.date,
    md: mdOfDate(row.date),
    image_urls: imgs,
    thumbnails: thumbs,
    video_url: null,
    work: workOfRow(row),
    diag: diagnosisOfRow(row),
    producer: row.producer || '',     // 입력 작업자 (trees.producer) — 카드에 작게 표시
    comments: row.comments || '',
  };
}

// 메인: 나무 전체 → { byName: { [품종명]: { [월]: entry[] } }, names: [품종명...] }
//   labels: { 'Tree-<id>': { name, disabled, ... } }
//   year(선택): 주면 그 연도 기록만 — 연간 검색용. (null=전체 연도)
export function aggregateVarietyPhotos(treeData, labels, year = null) {
  const byName = {};
  for (const treeId of Object.keys(treeData || {})) {
    const lbl = labels?.[`Tree-${treeId}`];
    const name = (lbl?.name || '').trim();
    if (!name) continue;                  // 이름 없는 나무 제외
    for (const row of treeData[treeId] || []) {
      if (year != null && yearOfDate(row.date) !== year) continue;  // 연도 필터
      const entry = rowToEntry(row, treeId);
      if (!entry) continue;
      (byName[name] ??= {});
      (byName[name][entry.month] ??= []).push(entry);
    }
  }
  for (const months of Object.values(byName))     // 각 월: 최신(날짜 늦은) 먼저
    for (const m of Object.keys(months))
      months[m].sort((a, b) => new Date(b.date) - new Date(a.date));
  return { byName, names: Object.keys(byName) };
}

// 농장 전체(1단 개요) — 월별 사진 엔트리 + 그 달 진단 평균.
//   → { [월(1~12)]: { entries: entry[], score, band, count } }
//   진단 평균은 사진 유무와 무관하게 그 달 모든 기록에서 (정확도 위해).
export function aggregateFarmMonthly(treeData, labels, year = null) {
  const byName = aggregateVarietyPhotos(treeData, labels, year).byName;
  const monthEntries = {};
  for (const months of Object.values(byName))
    for (const m of Object.keys(months))
      (monthEntries[m] ??= []).push(...months[m]);

  const monthScores = {};
  for (const treeId of Object.keys(treeData || {})) {
    const lbl = labels?.[`Tree-${treeId}`];
    if (!lbl?.name || lbl.disabled) continue;
    for (const row of treeData[treeId] || []) {
      if (year != null && yearOfDate(row.date) !== year) continue;  // 연도 필터
      const month = monthOfDate(row.date);
      if (month == null) continue;
      const s = calcTreeScore(row);
      if (s != null) (monthScores[month] ??= []).push(s);
    }
  }

  const out = {};
  for (let m = 1; m <= 12; m++) {
    const entries = (monthEntries[m] || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const scores = monthScores[m] || [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    out[m] = {
      entries,
      score: avg,
      band: avg != null ? scoreBand(avg) : null,
      count: entries.reduce((n, e) => n + (e.image_urls?.length || 0), 0),
    };
  }
  return out;
}
