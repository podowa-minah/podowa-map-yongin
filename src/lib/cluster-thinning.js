// src/lib/cluster-thinning.js
// 송이크기정리 / 알솎이 "최종완료" 마커 — 전밭 진행률 + 맵 테두리 색 계산.
//
// 왜: 송이크기정리·알솎이는 2~3일에 걸쳐 하기도 해서, "그날 했다"(체크박스)와
//     "이 나무는 끝냈다"(최종완료)는 다르다. 그래서 별도 '최종완료' 마커가 필요하다.
//
// 저장 위치(CLAUDE.md §10 2순위 — 기존 jsonb에 키 추가, 새 테이블 X):
//   trees.season_data[그시기].clusterTrimDone = true   // 송이크기정리 최종완료
//   trees.season_data[그시기].thinningDone    = true   // 알솎이 최종완료
//   (송이크기정리=착과기, 알솎이=착과기/경핵기/성숙기 — 어디서 눌러도 그 시기 칸에 저장)
//
// 진실(raw)은 trees 한 곳뿐 — 진행률/테두리는 매번 여기서 계산(저장 안 함, §10).
// 연도 필터: 올해 기록만 본다 → 해 바뀌면 자동 리셋.

export const CLUSTER_MARK = 'clusterTrimDone';
export const THINNING_MARK = 'thinningDone';

// ISO("YYYY-MM-DD") 또는 "MM/DD/YYYY" → 연도 숫자
function yearOf(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (s.includes('-')) return parseInt(s.slice(0, 4), 10);                    // ISO
  if (s.includes('/')) { const p = s.split('/'); return parseInt(p[2], 10); } // MM/DD/YYYY
  return null;
}

// 한 기록이 마커를 들고 있나 (어느 시기 칸이든 스캔). year 주면 그 해 기록만.
function recordHasMark(rec, markKey, year) {
  if (!rec) return false;
  if (year != null && yearOf(rec.date) !== year) return false;
  const sd = rec.season_data;
  if (!sd || typeof sd !== 'object') return false;
  for (const k of Object.keys(sd)) {
    const obj = sd[k];
    if (obj && typeof obj === 'object' && obj[markKey]) return true;
  }
  return false;
}

// 한 나무(기록 배열) → { cluster, thinning } 최종완료 여부
export function treeMarkStatus(records, year) {
  let cluster = false, thinning = false;
  for (const rec of records || []) {
    if (!cluster && recordHasMark(rec, CLUSTER_MARK, year)) cluster = true;
    if (!thinning && recordHasMark(rec, THINNING_MARK, year)) thinning = true;
    if (cluster && thinning) break;
  }
  return { cluster, thinning };
}

// 한 시기상태(season_data[season]) → 최종완료 라벨 배열 (히스토리/일지/가이드 공통).
export function markLabelsOf(seasonState) {
  if (!seasonState || typeof seasonState !== 'object') return [];
  const out = [];
  if (seasonState[CLUSTER_MARK]) out.push('송이크기정리 최종완료');
  if (seasonState[THINNING_MARK]) out.push('알솎이 최종완료');
  return out;
}

// 전밭 집계: 진행률(%) + 맵 테두리용 ID Set.
//   labels: { 'Tree-c-r': { name, disabled } }, treeData: { 'c-r': [records] }
//   테두리: 송이크기정리만 끝 → 노랑 / 알솎이까지 끝 → 파랑
//   전밭이 알솎이까지 100% → 안내 끝, 테두리 전부 제거.
export function clusterThinningStatus(treeData, labels, year, { rows = 25, cols = 8 } = {}) {
  const clusterTrimIds = new Set();   // 노랑: 송이크기정리만 끝(알솎이 아직)
  const thinningIds = new Set();      // 파랑: 알솎이 끝
  let total = 0, clusterDone = 0, thinningDone = 0;

  for (let c = 1; c <= cols; c++) {
    for (let r = 1; r <= rows; r++) {
      const lbl = labels[`Tree-${c}-${r}`] || {};
      if (lbl.disabled || !lbl.name) continue;   // 이름 있는 활성 나무만
      total++;
      const st = treeMarkStatus(treeData[`${c}-${r}`], year);
      // 알솎이는 송이크기정리 다음 단계 → thinning이면 cluster도 끝난 것으로 카운트(% 직관).
      if (st.cluster || st.thinning) clusterDone++;
      if (st.thinning) { thinningDone++; thinningIds.add(`${c}-${r}`); }
      else if (st.cluster) clusterTrimIds.add(`${c}-${r}`);
    }
  }

  const allThinningDone = total > 0 && thinningDone === total;
  if (allThinningDone) { clusterTrimIds.clear(); thinningIds.clear(); }  // 전밭 끝 → 테두리 제거

  return {
    total,
    clusterDone, thinningDone,
    clusterPct: total ? Math.round((clusterDone / total) * 100) : 0,
    thinningPct: total ? Math.round((thinningDone / total) * 100) : 0,
    clusterTrimIds, thinningIds,
    allThinningDone,
  };
}
