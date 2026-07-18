// src/lib/pest-distribution.js
// 밭 전체 병해충 분포 — 개별 나무(trees.season_data)에서 계산해서 뽑기. (§10: 저장 안 함, treeData에서 계산)
//   · 각 나무의 '현재' 상태 = 가장 최근 기록의 pests+diseases.
//   · 전체 나무 수(total) = 활성 라벨(이름 있고 disabled 아님) 개수 — App의 activeLabelCount 기준과 동일.
//   · list: 벌레/병별 { 그루수(count), %, 평균점수, 최고점수, 나무 id들 }. worst = 1순위.
import { readPests } from './pests';
import { readDiseases } from './diseases';
import { colorOf, pestShade } from './pest-colors';

export const PEST_MAP_DIM = '#efe9df';   // 병해충 없는 나무(흐리게)

// 한 나무의 제일 센 벌레/병 { name, score } | null  (전체 보기에서 그 나무를 무슨 색으로 칠할지)
export function worstOfTree(st) {
  let best = null;
  for (const [n, v] of Object.entries(st?.pests || {})) {
    const s = Number(v); if (s > 0 && (!best || s > best.score)) best = { name: n, score: s };
  }
  for (const [n, v] of Object.entries(st?.diseases || {})) {
    const s = Number(v); if (s > 0 && (!best || s > best.score)) best = { name: n, score: s };
  }
  return best;
}

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

// 모든 나무의 진단 사진 모으기 → { 응애: { adult:[…], larva:[…], damage:[…] }, … }
//   각 사진에 어느 나무·언제 찍은 건지 붙여줌 (도감 = 우리 밭에서 실제로 찍힌 것들).
export function collectDiagPhotos(treeData = {}, labels = {}) {
  const byTag = {};
  for (const [labelId, lbl] of Object.entries(labels || {})) {
    if (!lbl || lbl.disabled || !lbl.name) continue;
    const id = labelId.replace('Tree-', '');
    for (const rec of (treeData[id] || [])) {
      const ph = rec?.season_data?.diag_photos;
      if (!Array.isArray(ph)) continue;
      for (const p of ph) {
        if (!p || !p.tag || !p.url) continue;
        const part = p.part || 'damage';
        if (!byTag[p.tag]) byTag[p.tag] = { adult: [], larva: [], damage: [] };
        if (!byTag[p.tag][part]) byTag[p.tag][part] = [];
        byTag[p.tag][part].push({ ...p, treeId: id, treeName: lbl.name || '', date: rec.date });
      }
    }
  }
  // 최신 사진이 앞으로
  for (const t of Object.values(byTag)) {
    for (const k of Object.keys(t)) t[k].sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  return byTag;
}

// 그 날짜 기준 감염 그루수 (그 날짜까지의 가장 최근 기록으로 판단) — 번짐 추이용
export function countAsOf(treeData = {}, labels = {}, name, asOfDate) {
  let n = 0;
  for (const [labelId, lbl] of Object.entries(labels || {})) {
    if (!lbl || lbl.disabled || !lbl.name) continue;
    const id = labelId.replace('Tree-', '');
    const recs = (treeData[id] || []).filter((r) => r.date && r.date <= asOfDate);
    if (!recs.length) continue;
    let latest = recs[0];
    for (const r of recs) if (r.date > latest.date) latest = r;
    const sd = latest.season_data || {};
    const v = readPests(sd, latest.bugs)[name] ?? readDiseases(sd)[name];
    if (Number(v) > 0) n++;
  }
  return n;
}

// 지도 나무별 색 — 벌레/병 "대표색" + 점수로 진하기 (1 연함 → 5 원색).
//   선택 항목 있으면 그 항목 있는 나무만. 없으면(전체) 각 나무의 제일 센 것의 색 → 색만 봐도 무슨 벌레인지.
export function pestColorMap(dist, selectedName, colors = {}) {
  const colorById = {};
  if (!dist) return colorById;
  if (selectedName && selectedName !== '__ALL__') {
    const it = dist.list.find((x) => x.name === selectedName);
    if (it) {
      const base = colorOf(it.name, colors);
      for (const id of it.ids) colorById[id] = pestShade(base, it.scores[id]);
    }
  } else {
    for (const [id, st] of Object.entries(dist.perTree || {})) {
      const w = worstOfTree(st);
      if (w) colorById[id] = pestShade(colorOf(w.name, colors), w.score);
    }
  }
  return colorById;
}
