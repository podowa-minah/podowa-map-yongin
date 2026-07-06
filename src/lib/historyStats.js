// src/lib/historyStats.js
// 작업 히스토리 관련 순수 계산 — 미달일, 사유 미제출, 월평균 등
// CLAUDE.md 섹션 10 — DB raw 데이터(daily_summaries + daily_notes) → 순수 계산

// 미달일: completed < total (또는 100% 미달)
export function isMissedDay(summary) {
  if (!summary) return false;
  const total = Number(summary.total) || 0;
  const completed = Number(summary.completed) || 0;
  if (total === 0) return false;                       // 작업 대상 없는 날은 미달 아님
  return completed < total;
}

// 미달일 + 사유 미제출 목록 (최근 N일 한도)
//   summaries: daily_summaries rows
//   notes:    daily_notes rows (type='incomplete_reason' 포함)
//   limitDays: 며칠 전까지만 검사 (default 30)
export function getMissedDaysNeedingReasons(summaries = [], notes = [], limitDays = 30) {
  // limitDays 안의 미달일만
  const today = new Date();
  const kstToday = new Date(today.getTime() + 9 * 3600 * 1000);
  const cutoff = new Date(kstToday.getTime() - limitDays * 86400000)
    .toISOString().slice(0, 10);
  const todayIso = kstToday.toISOString().slice(0, 10);

  // 사유 있는 날짜 set
  const reasonDates = new Set(
    notes.filter(n => n.type === 'incomplete_reason' && n.content && n.content.trim().length > 0)
      .map(n => n.date)
  );

  return summaries
    .filter(s => isMissedDay(s) && s.date >= cutoff && s.date < todayIso)   // 오늘 빼고 (오늘은 아직 진행 중)
    .filter(s => !reasonDates.has(s.date))
    .sort((a, b) => a.date < b.date ? 1 : -1);                              // 최근부터
}

// 미달일 사유 가져오기 (있으면)
export function getReasonForDate(notes, date) {
  if (!notes || !date) return null;
  return notes.find(n => n.type === 'incomplete_reason' && n.date === date) || null;
}

// 월 평균 달성률 — 해당 월의 미달/완료 평균
//   summaries: daily_summaries rows
//   year, month: 1-based month
export function monthAvgCompletion(summaries = [], year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const rows = summaries.filter(s => s.date && s.date.startsWith(prefix) && Number(s.total) > 0);
  if (rows.length === 0) return null;
  const sumPct = rows.reduce((acc, s) => {
    const pct = Number(s.completed) / Number(s.total) * 100;
    return acc + pct;
  }, 0);
  return Math.round(sumPct / rows.length);
}

// TOP 작업자 — 최근 N일 누적 그루 수
export function topWorkers(summaries = [], days = 30, topN = 3) {
  const today = new Date();
  const kstToday = new Date(today.getTime() + 9 * 3600 * 1000);
  const cutoff = new Date(kstToday.getTime() - days * 86400000)
    .toISOString().slice(0, 10);

  const counts = {};
  for (const s of summaries) {
    if (s.date < cutoff) continue;
    const workers = s.workers || [];
    for (const w of (Array.isArray(workers) ? workers : [])) {
      const name = w.name || w.author || w.producer;
      const count = Number(w.count) || 0;
      if (!name) continue;
      counts[name] = (counts[name] || 0) + count;
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// 월별 평균 달성률 — summaries에 있는 모든 월. [{ year, month, avg, days }] 최근 월 먼저.
export function monthlyAverages(summaries = []) {
  const byMonth = {};
  for (const s of summaries) {
    if (!s.date || !(Number(s.total) > 0)) continue;
    const key = String(s.date).slice(0, 7);   // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { sum: 0, days: 0 };
    byMonth[key].sum += Number(s.completed) / Number(s.total) * 100;
    byMonth[key].days += 1;
  }
  return Object.entries(byMonth)
    .map(([key, v]) => {
      const [y, m] = key.split('-');
      return { year: Number(y), month: Number(m), avg: Math.round(v.sum / v.days), days: v.days };
    })
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
}

// 농부별 누적 돌본 그루수 — 전체(days=null) 또는 최근 days일. [{ name, count }] 많은 순 (탑N 제한 없음).
export function workerTotals(summaries = [], days = null) {
  let cutoff = null;
  if (days != null) {
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    cutoff = new Date(kst.getTime() - days * 86400000).toISOString().slice(0, 10);
  }
  const counts = {};
  for (const s of summaries) {
    if (cutoff && s.date < cutoff) continue;
    for (const w of (Array.isArray(s.workers) ? s.workers : [])) {
      const name = w.name || w.author || w.producer;
      const count = Number(w.count) || 0;
      if (!name) continue;
      counts[name] = (counts[name] || 0) + count;
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// 내일 예상 작업량 — 최근 N일 평균 total
export function predictTomorrowWorkload(summaries = [], recentDays = 7) {
  const today = new Date();
  const kstToday = new Date(today.getTime() + 9 * 3600 * 1000);
  const cutoff = new Date(kstToday.getTime() - recentDays * 86400000)
    .toISOString().slice(0, 10);
  const rows = summaries.filter(s => s.date >= cutoff && Number(s.total) > 0);
  if (rows.length === 0) return null;
  const avg = rows.reduce((acc, s) => acc + Number(s.total), 0) / rows.length;
  return Math.round(avg);
}
