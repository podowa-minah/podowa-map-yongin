// src/lib/streak.js
// 연속 출근 일수 — trees 기록 또는 daily_notes 입력 있는 날을 출근으로 봄
// CLAUDE.md §10: 순수 계산 (DOM/React 안 씀)
// 오늘 활동 없으면 어제부터 카운트 (오늘 아직 일 안 했을 수도 있음)

export function getActiveStreak(treeData, todayIso, dailyRows = []) {
  const days = new Set();
  for (const id of Object.keys(treeData || {})) {
    for (const r of (treeData[id] || [])) {
      if (r.date) days.add(r.date);
    }
  }
  for (const n of dailyRows) {
    if (n?.date) days.add(n.date);
  }
  let count = 0;
  let cursor = todayIso;
  // 오늘 활동 있으면 오늘부터, 없으면 어제부터 시작
  if (!days.has(cursor)) cursor = shiftDay(cursor, -1);
  while (days.has(cursor)) {
    count++;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

function shiftDay(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
