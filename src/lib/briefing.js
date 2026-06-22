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

import { getFarmDiagnosis, getVarietyAverages } from './diagnosis';

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
    // 작년 참고 — 데이터 쌓이면 같은 시기 요약을 여기에. 올해 숫자엔 합산 X.
    lastYear: null,
  };
}
