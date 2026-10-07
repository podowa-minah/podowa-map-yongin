// src/lib/rest-mode.js
// 🌙 휴식모드 — 수확 끝난 뒤 "조용 모드". 쪼기(남은/미달성/불)만 끄고, 입력은 그대로 다 됨.
//   · 신호등 알고리즘은 1도 안 건드림 — 휴식날은 화면에서 평가·쪼기를 '안 보여줄' 뿐 (게이트 레이어).
//   · 저장(§11 기존 테이블): app_settings.rest_mode = JSON [{ from:'YYYY-MM-DD', to:'YYYY-MM-DD'|null }]
//       to=null 인 구간이 있으면 '지금 휴식 중'. 끄면 그 구간 to=오늘로 닫음.
//   · 매일 기록할 필요 없음 — 켠 '기간'만 저장하면 그 기간의 모든 날이 자동으로 휴식날 (계산).

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// app_settings 값(문자열/배열) → 기간 배열. 깨져도 안전하게 [].
export function readRestPeriods(raw) {
  if (!raw) return [];
  const v = typeof raw === 'string' ? safeParse(raw) : raw;
  const arr = Array.isArray(v) ? v : (v && Array.isArray(v.periods) ? v.periods : []);
  return arr.filter((p) => p && p.from);
}

// 지금 열린(진행 중) 휴식 구간 — 없으면 null
export function openPeriod(periods = []) {
  return periods.find((p) => p && p.from && !p.to) || null;
}

// 지금 휴식 중?
export function restActive(periods = []) {
  return !!openPeriod(periods);
}

// 특정 날짜가 휴식날인가 (어느 구간에든 속하면)
export function isRestDay(dateStr, periods = []) {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return (periods || []).some((p) => {
    if (!p || !p.from) return false;
    const to = p.to || '9999-12-31';
    return p.from <= d && d <= to;
  });
}

// 휴식 N일째 (진행 중 구간의 from~오늘, 포함) — 아니면 0
export function daysResting(periods = [], today) {
  const p = openPeriod(periods);
  if (!p) return 0;
  const from = new Date(`${p.from}T00:00:00`);
  const t = new Date(`${String(today).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(t.getTime())) return 1;
  return Math.max(1, Math.floor((t - from) / 86400000) + 1);
}

// 휴식 시작 — 이미 쉬는 중이면 그대로
export function startRest(periods = [], today) {
  if (restActive(periods)) return periods;
  return [...periods, { from: String(today).slice(0, 10), to: null }];
}

// 휴식 끝 — 열린 구간 to=오늘로 닫음 (헤더는 restActive=false로 즉시 복귀)
export function endRest(periods = [], today) {
  const d = String(today).slice(0, 10);
  return (periods || []).map((p) => (p && p.from && !p.to ? { ...p, to: d } : p));
}
