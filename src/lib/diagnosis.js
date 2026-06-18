// src/lib/diagnosis.js
// 밭 전체 진단 — 현재 상태 + "유심히 볼 나무"(이상치 감지) + 품종 평균 + 추세
// CLAUDE.md §10: trees + labels → 순수 계산만, 저장 X (DOM/React 없음)

import { calcTreeScore, avgMetrics, avgScore, powerScore, POWER_IDEAL } from './scoring';

// 안전 숫자 변환 (scoring.js와 동일 규칙 — power/balance가 text 컬럼이라)
function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 점수있는 최신/직전 기록 뽑기 (date 내림차순)
function pickScored(records) {
  const sorted = [...records].sort((a, b) =>
    (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let latest = null, prev = null;
  for (const r of sorted) {
    const s = calcTreeScore(r);
    if (s == null) continue;
    if (latest == null) latest = { rec: r, score: s };
    else { prev = { rec: r, score: s }; break; }
  }
  return { latest, prev };
}

// ── 밭 전체 진단 ─────────────────────────────────────
// 각 나무의 "가장 최근 점수있는 기록"으로 현재 밭 상태를 계산
// 반환:
//   { score, scoredCount, totalCount,
//     metrics: { power, balance, bugs },        // 밭 전체 평균 (최신 기록)
//     watchTrees: [{ id, name, score, reasons[], severity }],
//     watchTotal }
export function getFarmDiagnosis(treeData, labels, todayIso) {
  const trees = [];
  for (const id of Object.keys(treeData || {})) {
    const labelId = `Tree-${id}`;
    if (labels?.[labelId]?.disabled) continue;
    const records = treeData[id] || [];
    const { latest, prev } = pickScored(records);
    trees.push({
      id,
      name: (labels?.[labelId]?.name || '').trim(),
      latest, prev,
      recordedToday: records.some(r => r.date === todayIso),
    });
  }

  const totalCount = trees.length;
  const scored = trees.filter(t => t.latest != null);
  const scoredCount = scored.length;

  // 밭 평균 점수 + 표준편차 (이상치 판단 기준)
  const scores = scored.map(t => t.latest.score);
  const mean = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const std = (scores.length > 1 && mean != null)
    ? Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length)
    : 0;

  // 밭 평균 세력/균형/해충 (각 나무 최신 기록의 원본값)
  const avgRaw = (key) => {
    const vals = scored.map(t => toNum(t.latest.rec[key])).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const metrics = { power: avgRaw('power'), balance: avgRaw('balance'), bugs: avgRaw('bugs') };

  // ── 유심히 볼 나무 (이상치 3신호) ──
  const DROP_CUT = 1.0;   // ② 급락 기준 (점수 하락폭)
  const K = 1.0;          // ① 표준편차 배수
  const FLOOR = 0.5;      // ① 최소 격차 (std 작을 때 과다검출 방지)
  const MAX_WATCH = 8;    // 표시 상한

  const watch = [];
  for (const t of scored) {
    if (t.recordedToday) continue;      // (A) 오늘 챙긴 나무는 오늘 제외
    const s = t.latest.score;
    const power = toNum(t.latest.rec.power);
    const bal = toNum(t.latest.rec.balance);
    const bugs = toNum(t.latest.rec.bugs);
    const reasons = [];
    let severity = 0;

    // ① 자기 과거보다 급락 — "왜" 떨어졌는지(해충↑/균형↓/세력↓)까지 짚는다
    let dropCause = null;
    if (t.prev != null) {
      const drop = t.prev.score - s;
      if (drop >= DROP_CUT) {
        severity += drop;
        const pBug = toNum(t.prev.rec.bugs);
        const pBal = toNum(t.prev.rec.balance);
        const pPow = toNum(t.prev.rec.power);
        // 가장 많이 "나빠진" 항목을 원인으로 (기여도 하락폭 비교 — 작은 변화여도 1등을 집음)
        const cand = [];
        if (pBug != null && bugs != null) cand.push({ k: '해충↑', d: bugs - pBug });               // 해충은 높을수록 나쁨
        if (pBal != null && bal != null) cand.push({ k: '균형↓', d: pBal - bal });                  // 균형은 높을수록 좋음
        if (pPow != null && power != null) cand.push({ k: power < pPow ? '세력↓' : '세력↑', d: powerScore(pPow) - powerScore(power) });
        cand.sort((a, b) => b.d - a.d);
        dropCause = (cand.length && cand[0].d > 0) ? cand[0].k : '급락';
        reasons.push(dropCause);
      }
    }
    // ② 위험 신호 (원본 데이터) — 급락 원인과 중복되면 생략
    if (bugs != null && bugs >= 4 && dropCause !== '해충↑') { reasons.push('해충'); severity += 1.5; }
    if (power != null && power <= 1.5 && dropCause !== '세력↓') { reasons.push('세력약'); severity += 1; }
    // ③ 밭 평균에서 유독 처짐 (상대 비교)
    if (mean != null) {
      const gap = mean - s;
      const cut = Math.max(FLOOR, K * std);
      if (gap >= cut) { reasons.push('평균↓'); severity += gap; }
    }

    if (reasons.length > 0) {
      watch.push({ id: t.id, name: t.name, score: s, reasons, severity });
    }
  }
  watch.sort((a, b) => b.severity - a.severity);

  return {
    score: mean,
    scoredCount,
    totalCount,
    metrics,
    watchTrees: watch.slice(0, MAX_WATCH),
    watchTotal: watch.length,
  };
}

// ── 품종별 종합 점수 (밭 전체, 최신 기록 기준) ─────────
// 개별 나무 점수의 단순 평균이 아니라, 품종 전체를 하나로 본 "종합 점수":
// 각 나무 최신 기록을 모아 평균 세력/균형/해충 → calcTreeScore로 종합점수 1개 산출.
// 반환: [{ name, score, count }] — 낮은 점수 순 (주의 품종 먼저)
export function getVarietyAverages(treeData, labels) {
  const groups = {};   // name -> [latest records]
  for (const id of Object.keys(treeData || {})) {
    const labelId = `Tree-${id}`;
    if (labels?.[labelId]?.disabled) continue;
    const name = (labels?.[labelId]?.name || '').trim();
    if (!name) continue;
    const { latest } = pickScored(treeData[id] || []);
    if (!latest) continue;
    (groups[name] = groups[name] || []).push(latest.rec);
  }
  return Object.entries(groups)
    .map(([name, recs]) => {
      const m = avgMetrics(recs);   // 품종 평균 세력/균형/해충
      return {
        name,
        score: calcTreeScore(m),    // → 종합점수
        count: recs.length,
        metrics: m ? { power: m.power, balance: m.balance, bugs: m.bugs } : null,
        reason: weakestReason(m),   // 점수를 가장 끌어내린 요인 (왜 낮은지)
      };
    })
    .filter(v => v.score != null)
    .sort((a, b) => a.score - b.score);
}

// 종합점수를 가장 끌어내린 요인 한 줄 ("왜 낮은지" — 호버/탭 설명용)
// 세력/균형/해충을 각각 0~5 기여도로 환산해 가장 낮은 것을 약점으로 본다.
function weakestReason(m) {
  if (!m) return null;
  const items = [];
  if (m.power != null) items.push({
    v: powerScore(m.power),
    label: m.power < POWER_IDEAL ? '세력 약함' : '세력 과함',
  });
  if (m.balance != null) items.push({ v: m.balance, label: '균형 낮음' });
  if (m.bugs != null) items.push({ v: 5 - m.bugs, label: '해충 많음' });
  if (items.length === 0) return null;
  items.sort((a, b) => a.v - b.v);
  return items[0].v >= 4 ? null : items[0].label;   // 다 양호하면 약점 없음
}

// ── 밭 전체 추세 (기간 비교) ──────────────────────────
// 최근 days일 평균 vs 그 직전 같은 기간 평균 → 방향(dir)
// 반환: { score, power, balance, bugs: {now, prev, delta, dir}, days }
export function getFarmTrend(treeData, todayIso, days = 7) {
  const recentFrom = addDays(todayIso, -days);
  const prevFrom = addDays(todayIso, -2 * days);
  const recent = recordsBetween(treeData, recentFrom, addDays(todayIso, 1));   // 오늘 포함
  const prev = recordsBetween(treeData, prevFrom, recentFrom);

  const rm = avgMetrics(recent), pm = avgMetrics(prev);
  const make = (now, was) => {
    if (now == null || was == null) return { now, prev: was, delta: null, dir: 0 };
    const delta = now - was;
    const dir = Math.abs(delta) < 0.1 ? 0 : (delta > 0 ? 1 : -1);
    return { now, prev: was, delta, dir };
  };
  return {
    score: make(avgScore(recent), avgScore(prev)),
    power: make(rm?.power, pm?.power),
    balance: make(rm?.balance, pm?.balance),
    bugs: make(rm?.bugs, pm?.bugs),
    days,
  };
}

// "YYYY-MM-DD" + n일
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// fromIso(포함) ~ toExclusive(미포함) 사이 기록 추출
function recordsBetween(treeData, fromIso, toExclusive) {
  const out = [];
  for (const id of Object.keys(treeData || {})) {
    for (const r of (treeData[id] || [])) {
      if (r.date && r.date >= fromIso && r.date < toExclusive) out.push(r);
    }
  }
  return out;
}

// 유심히 볼 나무 이유 코드(getFarmDiagnosis의 reasons) → 사람이 읽는 한 줄 (호버 툴팁용)
const WATCH_REASON_TEXT = {
  '평균↓': '밭 평균보다 낮음',
  '급락': '점수 급락',
  '해충': '해충 많음',
  '세력약': '세력 약함',
};
export function watchReasonText(reasons = []) {
  const parts = (reasons || []).map((r) => WATCH_REASON_TEXT[r] || r);
  return parts.length ? `유심히 볼 나무 — ${parts.join(' · ')}` : '유심히 볼 나무';
}
