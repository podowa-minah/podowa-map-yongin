// src/lib/dailyReport.js
// 특정 날짜의 농장 자동 집계 (저장 안 함, 계산만)
//
// 입력: trees 일별 기록 + tree_labels + 그날 daily_notes
// 출력: 작업 요약, 점수 분포, 품종별 점수 등

import { avgMetrics, avgScore, groupByVariety, calcTreeScore } from './scoring';

// 생육시기 라벨
export const SEASON_NAMES = {
  1: '맹아기', 2: '4-5엽기', 3: '개화기', 4: '착과기',
  5: '경핵기', 6: '성숙기', 7: '수확기',
};

// records 에서 가장 많이 체크된 생육시기 → "개화기" 같은 이름 반환
export function getDominantSeason(records) {
  if (!records || records.length === 0) return '';
  const counts = {};
  for (const r of records) {
    if (r.season) counts[r.season] = (counts[r.season] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return '';
  entries.sort((a, b) => b[1] - a[1]);
  return SEASON_NAMES[entries[0][0]] || '';
}

// 그날 trees 기록 → 자동 요약
//   {
//     records: [...],
//     workerCount, workerBreakdown,
//     metrics: { power, balance, bugs, count },
//     totalScore,
//     varietyScores: [{ name, score, count }, ...],
//     seasonBreakdown: { '3개화기': N, ... },
//     bloomCount, partialTreatmentCount, bugDetectedCount,
//   }
export function buildDailyReport({ records, labels }) {
  if (!records || records.length === 0) {
    return {
      records: [],
      workerCount: 0,
      workerBreakdown: [],
      metrics: null,
      totalScore: null,
      varietyScores: [],
      seasonBreakdown: {},
      bloomCount: 0,
      partialTreatmentCount: 0,
      bugDetectedCount: 0,
    };
  }

  // 작업자 카운트
  const workerCounts = {};
  for (const r of records) {
    if (r.producer) workerCounts[r.producer] = (workerCounts[r.producer] || 0) + 1;
  }
  const workerBreakdown = Object.entries(workerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // 전체 평균
  const metrics = avgMetrics(records);
  const totalScore = avgScore(records);

  // 품종별
  const groups = groupByVariety(records, labels || {});
  const varietyScores = Object.entries(groups)
    .map(([name, rs]) => ({ name, score: avgScore(rs), count: rs.length }))
    .filter(v => v.score != null)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // 생육시기 분포
  const seasonBreakdown = {};
  for (const r of records) {
    if (r.season) {
      const label = `${r.season}. ${SEASON_NAMES[r.season] || ''}`;
      seasonBreakdown[label] = (seasonBreakdown[label] || 0) + 1;
    }
  }
  const dominantSeason = getDominantSeason(records);

  // 특이 카운트
  let bloomCount = 0;          // 개화기 만개 체크
  let partialTreatmentCount = 0;
  let bugDetectedCount = 0;
  for (const r of records) {
    // 개화기 만개: season=3, option6=true
    const sd = r.season_data?.[r.season] || r.season_data?.[String(r.season)];
    if (Number(r.season) === 3 && sd?.option6 === true) bloomCount += 1;
    if (r.partial_treatment) partialTreatmentCount += 1;
    if (r.bugs != null && Number(r.bugs) >= 2) bugDetectedCount += 1;
  }

  return {
    records,
    workerCount: Object.keys(workerCounts).length,
    workerBreakdown,
    metrics,
    totalScore,
    varietyScores,
    seasonBreakdown,
    dominantSeason,                              // 예: "개화기"
    bloomCount,
    partialTreatmentCount,
    bugDetectedCount,
  };
}

// 점수 차트용 — 분포 비교 (오늘 vs 5일 평균)
// records: 오늘 / records5days: 최근 5일
export function buildDistributionData(todayRecords, last5DaysRecords) {
  const today = avgMetrics(todayRecords);
  const past = avgMetrics(last5DaysRecords);
  return {
    today,
    past,
  };
}
