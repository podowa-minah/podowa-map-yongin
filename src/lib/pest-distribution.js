// src/lib/pest-distribution.js
// 밭 전체 병해충 분포 — 개별 나무(trees.season_data)에서 계산해서 뽑기. (§10: 저장 안 함, treeData에서 계산)
//   · 각 나무의 '현재' 상태 = 가장 최근 기록의 pests+diseases.
//   · 전체 나무 수(total) = 활성 라벨(이름 있고 disabled 아님) 개수 — App의 activeLabelCount 기준과 동일.
//   · list: 벌레/병별 { 그루수(count), %, 평균점수, 최고점수, 나무 id들 }. worst = 1순위.
import { readPests } from './pests';
import { readDiseases } from './diseases';

// 지도 히트맵 색 — 0(없음/흐림) → 5(가장 심함). 진할수록 심함 (빨강 계열, 심각도 직관).
export const PEST_MAP_COLORS = ['#efe9df', '#f9d9c2', '#f4b183', '#ec7f45', '#d95a28', '#b01308'];
export const PEST_MAP_DIM = '#efe9df';   // 병해충 없는 나무(흐리게)

// 한 나무 기록들 중 '가장 최근' 것의 병해충 상태
export function latestPestState(records = []) {
  if (!records || records.length === 0) return { pests: {}, diseases: {} };
  let latest = records[0];
  for (const r of records) {
    if (!latest.date || (r.date && r.date > latest.date)) latest = r;
  }
  const sd = latest.season_data || {};
  return { pests: readPests(sd, latest.bugs), diseases: readDiseases(sd) };
}

// 전체 분포 (라벨 한 번 순회로 계산)
export function pestDistribution(treeData = {}, labels = {}) {
  const items = {};      // name → { name, kind, ids, scores, count, sum, maxScore }
  const perTree = {};    // numericId → { max, pests, diseases }
  let total = 0;

  for (const [labelId, lbl] of Object.entries(labels || {})) {
    if (!lbl || lbl.disabled || !lbl.name) continue;   // 활성 나무만
    total += 1;
    const numericId = labelId.replace('Tree-', '');
    const { pests, diseases } = latestPestState(treeData[numericId] || []);
    let max = 0;

    const add = (name, v, kind) => {
      const s = Number(v);
      if (!(s > 0)) return;
      if (s > max) max = s;
      if (!items[name]) items[name] = { name, kind, ids: [], scores: {}, count: 0, sum: 0, maxScore: 0 };
      const it = items[name];
      it.ids.push(numericId);
      it.scores[numericId] = s;
      it.count += 1;
      it.sum += s;
      if (s > it.maxScore) it.maxScore = s;
    };
    for (const [n, v] of Object.entries(pests)) add(n, v, 'pest');
    for (const [n, v] of Object.entries(diseases)) add(n, v, 'disease');

    perTree[numericId] = { max, pests, diseases };
  }

  const list = Object.values(items)
    .map((it) => ({
      name: it.name,
      kind: it.kind,
      ids: it.ids,
      scores: it.scores,
      count: it.count,
      maxScore: it.maxScore,
      avgScore: it.count ? Math.round((it.sum / it.count) * 10) / 10 : 0,
      pct: total ? Math.round((it.count / total) * 100) : 0,
    }))
    .sort((a, b) => (b.count - a.count) || (b.maxScore - a.maxScore));

  return { list, total, worst: list[0] || null, perTree };
}

// 지도 나무별 색 — 선택 항목 있으면 그 항목 있는 나무만(심각도색), 없으면(전체) 각 나무 최고 심각도색.
export function pestColorMap(dist, selectedName) {
  const colorById = {};
  if (!dist) return colorById;
  if (selectedName && selectedName !== '__ALL__') {
    const it = dist.list.find((x) => x.name === selectedName);
    if (it) for (const id of it.ids) colorById[id] = PEST_MAP_COLORS[it.scores[id]] || PEST_MAP_COLORS[1];
  } else {
    for (const [id, st] of Object.entries(dist.perTree || {})) {
      if (st.max > 0) colorById[id] = PEST_MAP_COLORS[st.max] || PEST_MAP_COLORS[1];
    }
  }
  return colorById;
}
