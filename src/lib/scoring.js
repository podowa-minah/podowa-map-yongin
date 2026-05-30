// src/lib/scoring.js
// 포도와 종합점수 — 세력/균형/해충 기반 (0~5 점)
// CLAUDE.md 섹션 10: trees 데이터 → 계산만 (저장 X)

// 공식: 세력 × 0.4 + 균형 × 0.25 + 해충 × 0.35
// (해충 값은 작을수록 좋음 → reverse 처리: 5 - bugs)
export const WEIGHTS = {
  power: 0.40,
  balance: 0.25,
  bugs: 0.35,
};

// 점수 해석 단계 (5점 만점)
export const SCORE_BANDS = [
  { min: 4.0, label: '양호', color: '#16a34a' },
  { min: 3.5, label: '관찰', color: '#65a30d' },
  { min: 3.0, label: '주의', color: '#ca8a04' },
  { min: 0.0, label: '경보', color: '#dc2626' },
];

// 0~5 점수 → 단계 라벨
export function scoreBand(score) {
  if (score == null || isNaN(score)) return SCORE_BANDS[3];
  for (const b of SCORE_BANDS) {
    if (score >= b.min) return b;
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1];
}

// 안전 숫자 변환 — null/undefined/빈문자열/비숫자 모두 null 처리
// (DB에 power/balance가 text 컬럼이라 옛 데이터에 "?" 같은 비숫자가 섞일 수 있음)
function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 세력 이상점 — "적당한 것이 가장 좋다". 3.2~3.5가 최적, 3 부근이 이상적.
// 높을수록 좋은 게 아니라, 이상점에서 멀어질수록(약하거나 너무 강하거나) 감점.
export const POWER_IDEAL = 3.35;

// 세력 원본값(0~5) → 점수 기여도(0~5).
// 이상점(~3.35)에서 최고점, 멀어질수록 종(bell) 모양으로 감점.
// 저세력(약함)을 과번무(너무 강함)보다 조금 더 가혹하게 본다.
export function powerScore(power) {
  const p = toNumOrNull(power);
  if (p == null) return null;
  const d = Math.abs(p - POWER_IDEAL);
  const k = p < POWER_IDEAL ? 1.2 : 0.9;   // 약세 penalty가 과번무보다 약간 큼
  return Math.max(0, Math.min(5, 5 - k * d));
}

// 한 나무의 한 기록 → 종합점수 (0~5)
// 세력은 이상점(~3.35) 기준 종 모양 점수(powerScore), 해충은 0이 깨끗(최고)이라 5 - bugs 로 reverse
export function calcTreeScore({ power, balance, bugs }) {
  const p = powerScore(power);            // 세력: 이상점 기준 환산 점수
  const b = toNumOrNull(balance);
  const bv = toNumOrNull(bugs);
  if (p == null && b == null && bv == null) return null;
  const bugsReversed = bv != null ? (5 - bv) : null;

  // 사용 가능한 가중치만 합산 (NULL/비숫자는 제외)
  let totalWeight = 0;
  let weightedSum = 0;
  if (p != null) { weightedSum += p * WEIGHTS.power;     totalWeight += WEIGHTS.power; }
  if (b != null) { weightedSum += b * WEIGHTS.balance;   totalWeight += WEIGHTS.balance; }
  if (bugsReversed != null) { weightedSum += bugsReversed * WEIGHTS.bugs; totalWeight += WEIGHTS.bugs; }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;   // 가중평균 — 0~5
}

// 여러 나무 기록의 평균 점수
export function avgScore(records) {
  if (!records || records.length === 0) return null;
  const scores = records.map(calcTreeScore).filter(s => s != null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// 평균 세력/균형/해충 (디테일 분포용)
export function avgMetrics(records) {
  if (!records || records.length === 0) return null;
  // 빈문자열·비숫자는 제외 (NaN 오염 방지)
  const valid = (key) => records.map(r => toNumOrNull(r[key])).filter(v => v != null);
  const power = valid('power');
  const balance = valid('balance');
  const bugs = valid('bugs');
  return {
    power: power.length ? power.reduce((a, b) => a + b, 0) / power.length : null,
    balance: balance.length ? balance.reduce((a, b) => a + b, 0) / balance.length : null,
    bugs: bugs.length ? bugs.reduce((a, b) => a + b, 0) / bugs.length : null,
    count: records.length,
  };
}

// 품종별 그룹화 (tree_labels.name 에서 품종 추출 — 마지막 토큰)
// 예: "함부르크", "샤인머스캣", "홍이두"
export function groupByVariety(records, labels) {
  const groups = {};
  for (const r of records) {
    const treeId = `Tree-${r.id}`;
    const labelName = (labels[treeId]?.name || '').trim();
    if (!labelName) continue;   // 이름 없는 나무는 제외
    if (!groups[labelName]) groups[labelName] = [];
    groups[labelName].push(r);
  }
  return groups;
}

// ── 현재 밭 상태 ───────────────────────────────────────
// 각 나무의 "가장 최근 점수있는 기록"으로 현재 밭 종합점수 계산
// CLAUDE.md §10: trees + lib만으로 계산, 저장 X
export function getCurrentFarmScore(treeData, labels) {
  let scoredCount = 0;
  let totalCount = 0;
  const scores = [];
  for (const treeId of Object.keys(treeData || {})) {
    const labelId = `Tree-${treeId}`;
    if (labels?.[labelId]?.disabled) continue;
    totalCount++;
    const records = treeData[treeId] || [];
    // 최신부터 점수 계산되는 기록 찾기
    for (const r of records) {
      const s = calcTreeScore(r);
      if (s != null) {
        scores.push(s);
        scoredCount++;
        break;
      }
    }
  }
  return {
    score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    scoredCount,
    totalCount,
  };
}
