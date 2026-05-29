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

// 한 나무의 한 기록 → 종합점수 (0~5)
// 해충은 0이 깨끗(최고), 5가 최악 → 5 - bugs 로 reverse
export function calcTreeScore({ power, balance, bugs }) {
  if (power == null && balance == null && bugs == null) return null;
  const p = power != null ? Number(power) : null;
  const b = balance != null ? Number(balance) : null;
  const bugsReversed = bugs != null ? (5 - Number(bugs)) : null;

  // 사용 가능한 가중치만 합산 (NULL은 제외)
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
  const valid = (key) => records.map(r => r[key]).filter(v => v != null).map(Number);
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
