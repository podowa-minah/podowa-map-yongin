// src/lib/trends.js
// 추이 / 비교 계산 — treeData에서 일정 기간 평균 추출
// CLAUDE.md 섹션 10: 순수 계산 (DB 호출 없음, React 없음)

import { avgScore, avgMetrics } from './scoring';

// ISO 날짜 비교용 — daysBack 일 전 ~ baseIso (exclusive) 사이 기록 추출
//   treeData: { [treeId]: [{date, power, balance, bugs, ...}, ...] }
function recordsBetween(treeData, fromIso, toIsoExclusive) {
  const records = [];
  for (const treeId of Object.keys(treeData || {})) {
    const days = treeData[treeId] || [];
    for (const r of days) {
      if (r.date && r.date >= fromIso && r.date < toIsoExclusive) {
        records.push({ id: treeId, ...r });
      }
    }
  }
  return records;
}

// "YYYY-MM-DD" + N → 그 날짜
function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// 그날 / 과거 N일 평균 비교
//   todayRecords: 오늘 records (이미 추출됨)
//   treeData: 전체
//   selectedDate: 기준 일
//   pastDays: 비교 대상 기간 (예: 5 또는 7)
export function buildTrends({ todayRecords, treeData, selectedDate, pastDays = 7 }) {
  const today = avgMetrics(todayRecords);
  const fromIso = addDays(selectedDate, -pastDays);
  const pastRecords = recordsBetween(treeData, fromIso, selectedDate);
  const past = avgMetrics(pastRecords);

  const todayScore = avgScore(todayRecords);
  const pastScore = avgScore(pastRecords);

  return {
    today, past,
    todayScore, pastScore,
    // 비교 (오늘 - 과거)
    delta:        (todayScore != null && pastScore != null) ? (todayScore - pastScore) : null,
    powerDelta:   (today?.power != null && past?.power != null) ? (today.power - past.power) : null,
    balanceDelta: (today?.balance != null && past?.balance != null) ? (today.balance - past.balance) : null,
    bugsDelta:    (today?.bugs != null && past?.bugs != null) ? (today.bugs - past.bugs) : null,
    pastDays,
    pastRecordCount: pastRecords.length,
  };
}

// 등급 분포 (히스토그램) — 1~5 점수별 카운트
export function distributionByLevel(records, metricKey) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of records) {
    const v = r[metricKey];
    if (v == null) continue;
    const lv = Math.round(Number(v));
    if (lv >= 1 && lv <= 5) counts[lv] += 1;
  }
  const total = records.length;
  return { counts, total };
}

// 5일 평균 위해 helper
export function avgFromRecords(treeData, selectedDate, days) {
  const fromIso = addDays(selectedDate, -days);
  const recs = recordsBetween(treeData, fromIso, selectedDate);
  return {
    metrics: avgMetrics(recs),
    score: avgScore(recs),
    count: recs.length,
  };
}
