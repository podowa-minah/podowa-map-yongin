// src/lib/pests.js
// 해충관리 — 벌레별 점수(0~5). 순수 계산만 (CLAUDE.md §10, DOM/React 안 씀).
// 저장: trees.season_data.pests = { '응애': 3, '총채': 1, ... }  (기존 jsonb 안, DB 변경 없음)
//
// ⭐ 알고리즘 불변 원칙:
//   종합점수/신호등이 쓰는 bugs(0~5) = "가장 센 벌레 점수"(max).
//   → scoring.js 는 1도 안 바뀐다. 벌레별 세부는 분포·도감용 '덤'일 뿐, 점수 계산엔 max만 들어간다.

export const DEFAULT_PESTS = ['깍지', '응애', '총채', '개각충'];

// 심각도 색 (0 깨끗 초록 → 5 가장 심함 빨강). 표시 전용 — 점수 공식과 무관.
export const PEST_COLORS = ['#16a34a', '#7f9f12', '#d69e2e', '#e07b12', '#dc4a16', '#c0140f'];
export const PEST_SHADOWS = [
  'rgba(20,83,45,.5)', 'rgba(55,75,10,.5)', 'rgba(120,80,10,.45)',
  'rgba(140,70,10,.45)', 'rgba(150,50,10,.45)', 'rgba(120,10,10,.5)',
];

// 벌레별 점수 객체 → bugs(0~5). 가장 센 놈. 없으면 0.  (scoring.js 에 넘길 값)
export function bugsFromPests(pests = {}) {
  const vals = Object.values(pests || {}).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return vals.length ? Math.max(...vals) : 0;
}

// 가장 심한 벌레 하나 { name, score } | null  (나무에 왔을 때 알림용)
export function worstPest(pests = {}) {
  let name = null, score = 0;
  for (const k of Object.keys(pests || {})) {
    const v = Number(pests[k]);
    if (Number.isFinite(v) && v > score) { score = v; name = k; }
  }
  return name ? { name, score } : null;
}

// 알림 배너 색 밴드 (0 깨끗 / 1~2 노랑 / 3 주황 / 4~5 빨강)
export function pestAlertBand(score) {
  if (!score || score <= 0) return { bg: '#f0fdf4', bd: '#bbf7d0', tx: '#166534', em: '✅' };
  if (score <= 2) return { bg: '#fefce8', bd: '#fde68a', tx: '#854d0e', em: '🐛' };  // 약하게 — 경고 아님
  if (score <= 3) return { bg: '#fff7ed', bd: '#fed7aa', tx: '#9a3412', em: '⚠️' };
  return { bg: '#fef2f2', bd: '#fecaca', tx: '#991b1b', em: '🔴' };
}

// 점수별 한 줄 말투 — 오늘 봐서 준 점수니까, 1점은 약하게 / 5점은 급하게.
export function pestSeverityText(score) {
  const s = Number(score) || 0;
  if (s <= 0) return '';
  if (s === 1) return '약하게 있어요';
  if (s === 2) return '지켜보세요';
  if (s === 3) return '꽤 있어요';
  if (s === 4) return '심해요 · 방제하세요';
  return '아주 심해요 · 오늘 방제!';
}

// 기록에서 벌레 점수 읽기 — 옛 데이터(bugs만 있고 pests 없음)는 '미분류'로 살려서 보여준다.
//   (데이터 안 잃게: 예전 해충 점수도 그대로 표시·재분류 가능)
export function readPests(seasonData = {}, bugs = null) {
  const p = seasonData?.pests;
  if (p && Object.keys(p).length) return p;
  const b = Number(bugs);
  return Number.isFinite(b) && b > 0 ? { 미분류: b } : {};
}

// 히스토리/표 한 줄 요약 — "깍지 3 · 총채 2" (센 순). 벌레 없으면 옛 bugs 숫자.
//   더보기 '해충' 칸이 max 하나만 보여주던 걸 벌레별로 다 보이게 할 때 씀.
export function pestSummary(seasonData = {}, bugs = null) {
  const p = readPests(seasonData, bugs);
  const entries = Object.entries(p)
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!entries.length) return (bugs != null && bugs !== '') ? String(bugs) : '';
  return entries.map(([n, v]) => `${n} ${v}`).join(' · ');
}
