// src/lib/briefing.js
// 아침 브리핑 — 클로드에 보낼 "컨텍스트" 조립 (순수 계산, CLAUDE.md §10)
//
// 원칙(minari 확인):
//   - 올해(이번 생육기) 기록만으로 현황을 계산한다. 작년은 절대 섞지 않는다.
//   - 작년은 "참고"로만 따로 담는다(데이터 쌓이면 채움). 올해 숫자에 합산 X.
//   - 숫자(세력·균형·해충·품종)는 여기서(규칙엔진) 계산, 글 해석·종합은
//     /api/briefing 의 클로드가 맡는다.
//
// 입력: App이 가진 treeData(나무별 raw) + labels + 오늘 메모들
// 출력: /api/briefing 에 그대로 POST 할 수 있는 평범한 객체

import { getFarmDiagnosis, getVarietyAverages, getFarmTrend } from './diagnosis';

// "YYYY-MM-DD" 또는 "MM/DD/YYYY" → 연도 숫자
function yearOf(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (s.includes('-')) return parseInt(s.slice(0, 4), 10);
  if (s.includes('/')) { const p = s.split('/'); return parseInt(p[2], 10); }
  return null;
}

// ★ 올해 기록만 남긴 treeData 새 객체 (원본 불변) — "생육기 지나면 리셋" 반영
export function filterTreeDataByYear(treeData = {}, year) {
  const out = {};
  for (const id of Object.keys(treeData)) {
    const recs = (treeData[id] || []).filter((r) => yearOf(r.date) === year);
    if (recs.length) out[id] = recs;
  }
  return out;
}

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);   // 소수1 반올림
const toNum = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const avgOf = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
// "YYYY-MM-DD" 또는 "MM/DD/YYYY" → 월(1~12)
function monthOf(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (s.includes('-')) return parseInt(s.slice(5, 7), 10);
  if (s.includes('/')) return parseInt(s.split('/')[0], 10);
  return null;
}

// 올해 나무 메모(진단 텍스트) 최신순 — 사람이 쓴 자유 글 = 학습 핵심 재료
function recentFarmerNotes(treeDataYear, labels, limit = 8) {
  const notes = [];
  for (const id of Object.keys(treeDataYear)) {
    const name = (labels?.[`Tree-${id}`]?.name || '').trim();
    for (const r of treeDataYear[id]) {
      const t = (r.comments || '').trim();
      if (t) notes.push({ date: r.date, id, name, text: t });   // id = 나무 좌표(AI가 메모를 좌표에 연결)
    }
  }
  notes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return notes.slice(0, limit);
}

// Tier1 기억 — 최근 N일 영농일지(daily_notes)를 날짜별 한 줄로 압축해 AI에 먹인다.
//   "어제 방제한 게 오늘 어떤지" 흐름을 잇기 위함. 오늘은 제외, 최신→과거.
//   rows = daily_notes(type=journal) 행들. 새 저장 X, 있는 데이터에서 계산(§10).
const cut = (s, n = 60) => (s && s.length > n ? s.slice(0, n) + '…' : s);
export function buildRecentHistory(rows = [], todayIso, days = 7) {
  const out = [];
  const sorted = [...rows]
    .filter((r) => r?.date && r.date < todayIso)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days);
  for (const r of sorted) {
    const jn = r.journal_notes || {};
    const ai = jn.briefing?.snapshot?.ai || {};
    const parts = [];
    // 사람이 쓴 기록 우선, 없으면 AI 진단 요약
    if (jn.pest?.note)        parts.push(`병해충 ${cut(jn.pest.note)}`);
    else if (ai.pest)         parts.push(`병해충 ${cut(ai.pest)}`);
    if (jn.growth?.note)      parts.push(`생육 ${cut(jn.growth.note)}`);
    else if (ai.growth)       parts.push(`생육 ${cut(ai.growth)}`);
    if (jn.env?.note)         parts.push(`환경 ${cut(jn.env.note)}`);
    const done = jn.briefing?.snapshot?.doneTasks || [];
    if (done.length) parts.push(`한 일 ${done.map((t) => (t.kind === 'field' ? t.cat : t.treeId)).join(',')}`);
    if (parts.length) out.push(`${r.date} — ${parts.join(' / ')}`);
  }
  return out;   // 문자열 배열 (최신→과거)
}

// Tier2 기억 — 이번 시즌을 "월별 한 줄"로 압축해 AI에 먹인다(지난달 대비 흐름).
//   올해 기록만(작년 안 섞음). 각 달: 세력·균형·해충 월평균 + 기록일수. 새 저장 X(§10).
//   treeDataYear = 올해로 필터된 treeData. 반환: 문자열 배열(오래된→최근 달).
export function buildMonthlyRollup(treeDataYear = {}, todayIso) {
  const curMonth = monthOf(todayIso);
  const months = {};   // 월 -> { pw:[], bal:[], bug:[], days:Set }
  for (const id of Object.keys(treeDataYear)) {
    for (const r of treeDataYear[id] || []) {
      const m = monthOf(r.date);
      if (!m) continue;
      const g = months[m] || (months[m] = { pw: [], bal: [], bug: [], days: new Set() });
      const p = toNum(r.power), b = toNum(r.balance), k = toNum(r.bugs);
      if (p != null) g.pw.push(p);
      if (b != null) g.bal.push(b);
      if (k != null) g.bug.push(k);
      g.days.add(r.date);
    }
  }
  const out = [];
  for (const m of Object.keys(months).map(Number).sort((a, b) => a - b)) {
    const g = months[m];
    const parts = [];
    const pw = avgOf(g.pw), bal = avgOf(g.bal), bug = avgOf(g.bug);
    if (pw != null) parts.push(`세력 ${r1(pw)}`);
    if (bal != null) parts.push(`균형 ${r1(bal)}`);
    if (bug != null) parts.push(`해충 ${r1(bug)}`);
    if (!parts.length) continue;
    const tag = m === curMonth ? ' (이번달·진행중)' : '';
    out.push(`${m}월${tag} — ${parts.join(' · ')} · 기록 ${g.days.size}일`);
  }
  return out;
}

// 메인: 클로드에 보낼 컨텍스트 (올해 현황 + 사람 메모 + 작년 참고 자리)
export function buildBriefingContext({
  treeData = {},
  labels = {},
  todayIso,
  year,
  weather = '',
  stage = '',
  yesterdayNote = '',      // 어제 영농일지 한줄 (사람)
  eyeCheck = null,         // 오늘 아침 눈파악 { vigor, pest, note }
} = {}) {
  const yr = year || yearOf(todayIso) || new Date().getFullYear();
  const yearData = filterTreeDataByYear(treeData, yr);   // 올해만

  const diag = getFarmDiagnosis(yearData, labels, todayIso);
  const varieties = getVarietyAverages(yearData, labels);
  const farmerNotes = recentFarmerNotes(yearData, labels);
  const tr = getFarmTrend(yearData, todayIso || '', 7);   // 최근 1주 vs 직전 1주 추세

  return {
    date: todayIso || '',
    stage,
    weather,
    // 올해 현황 (밭 전체, 1~5)
    diagnosis: {
      vigor: r1(diag.metrics?.power),
      balance: r1(diag.metrics?.balance),
      pest: r1(diag.metrics?.bugs),
      score: r1(diag.score),
    },
    // 추세 (최근 1주 vs 직전 1주) — dir: 1 상승 / 0 유지 / -1 하락
    trend: {
      days: tr.days,
      power: { dir: tr.power?.dir ?? 0, delta: r1(tr.power?.delta) },
      balance: { dir: tr.balance?.dir ?? 0, delta: r1(tr.balance?.delta) },
      bugs: { dir: tr.bugs?.dir ?? 0, delta: r1(tr.bugs?.delta) },
    },
    // 품종별 (낮은 점수 먼저)
    varieties: varieties.slice(0, 8).map((v) => ({
      name: v.name, score: r1(v.score), reason: v.reason || null,
    })),
    // 유심히 볼 나무 (id = 나무 번호 "열-행", 예: 1-5)
    watchCount: diag.watchTotal || 0,
    watchTrees: (diag.watchTrees || []).map((w) => ({
      id: w.id, name: w.name || '', reasons: w.reasons,
    })),
    // 사람이 쓴 자유 메모 (어제 일지 + 나무 진단) — 학습 핵심
    yesterdayNote: yesterdayNote || '',
    // 좌표 + 품종 + 글 → AI가 "1-5에 유충"처럼 좌표에 연결해 판단
    farmerNotes: farmerNotes.map((n) => `[${[n.id, n.name].filter(Boolean).join(' ')}] ${n.text}`),
    // 오늘 아침 눈파악 (사람 판단)
    eyeCheck: eyeCheck || null,
    // 이번 시즌 월별 흐름(지난달 대비) — Tier2 기억
    monthly: buildMonthlyRollup(yearData, todayIso),
    // 작년 참고 — 데이터 쌓이면 같은 시기 요약을 여기에. 올해 숫자엔 합산 X.
    lastYear: null,
  };
}
