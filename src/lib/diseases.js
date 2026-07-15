// src/lib/diseases.js
// 병(病) 도메인 — 흰가루병/노균병 등. 해충(pests.js)과 쌍둥이 구조.
//   · 저장 위치: trees.season_data.diseases = { 흰가루병: 2, 노균병: 0 }  (jsonb 키, 스키마 변경 없음)
//   · 점수 0~5 심각도 색은 pests.js 걸 그대로 공유 (심각도는 심각도니까).
//   · ⚠️ 병은 신호등(세력/해충/시계) 알고리즘에 안 물림 — Phase 1은 기록/표시만. (완화·정정 금지 원칙 유지)
import { PEST_COLORS, PEST_SHADOWS, pestAlertBand } from './pests';

// "아는 것만" — 흔한 3개로 시작. 앱에서 ＋추가로 늘림.
export const DEFAULT_DISEASES = ['흰가루병', '노균병', '잿빛곰팡이병'];

// 심각도 색/그림자 — 해충과 동일 스케일 재사용
export const DISEASE_COLORS = PEST_COLORS;
export const DISEASE_SHADOWS = PEST_SHADOWS;

// season_data.diseases 안전 읽기 (없으면 {})
export function readDiseases(seasonData = {}) {
  const d = seasonData?.diseases;
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}

// 가장 센 병 { name, score } — 없으면 null
export function worstDisease(diseases = {}) {
  let best = null;
  for (const [name, v] of Object.entries(diseases || {})) {
    const s = Number(v);
    if (s > 0 && (!best || s > best.score)) best = { name, score: s };
  }
  return best;
}

// 알림 배너 색 — 해충과 동일 심각도 색
export function diseaseAlertBand(score) {
  return pestAlertBand(score);
}

// 심각도 문구 (병 말투)
export function diseaseSeverityText(score) {
  switch (Number(score)) {
    case 1: return '조금 보여요';
    case 2: return '지켜보세요';
    case 3: return '꽤 번졌어요';
    case 4: return '심해요 · 방제하세요';
    case 5: return '아주 심해요 · 오늘 방제!';
    default: return '';
  }
}

// "흰가루병 2 · 노균병 1" (점수>0만, 센 순) — 더보기/요약용
export function diseaseSummary(seasonData = {}) {
  const d = readDiseases(seasonData);
  const items = Object.entries(d)
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  if (items.length === 0) return '';
  return items.map(([n, v]) => `${n} ${v}`).join(' · ');
}
