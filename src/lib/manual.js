// src/lib/manual.js
// 이달의 포도 미션 — 순수 계산 함수 + 공유 상수 (CLAUDE.md §10 Layer 2)
// 규칙: DOM/React 안 씀. 입력이 같으면 출력이 같다 (side-effect 없음).
//   진실(raw) = manual_items + manual_completions.  횟수·달성률·도장은 전부 여기서 계산.

// 범주(카테고리) — 각자 색을 가진다. 미션을 깰수록 그 색이 카드에 채워진다.
export const CATS = {
  water: { name: '물관리', color: '#5b9bd5', tint: '#eef5fc' },
  pest:  { name: '방제관리', color: '#d99a3c', tint: '#fcf4e6' },
  grow:  { name: '재배관리', color: '#73a86a', tint: '#eef6ec' },
  env:   { name: '환경관리', color: '#c77b6b', tint: '#faeeeb' },
  soil:  { name: '토양관리', color: '#a98c6b', tint: '#f5efe7' },
};
export const ORDER = ['water', 'pest', 'grow', 'env', 'soil'];

// 월 ↔ 생육시기 (월이 척추, 생육시기는 라벨)
export const STAGE = { 2:'맹아기', 3:'맹아기', 4:'맹아기', 5:'개화기', 6:'경핵기', 7:'성숙기', 8:'성숙기', 9:'수확기', 12:'전정' };
export const STRIP_MONTHS = [2, 3, 4, 5, 6, 7, 8, 9, 12];

// 도장(stamp) 색 — 누가 했는지. 이름을 해시해 고정 팔레트에서 색을 고른다(사람마다 안정적).
const PERSON_PALETTE = [
  { bg: '#e9f4ec', bd: '#bfe0c6', tx: '#2f6b3c' },
  { bg: '#e7f0fa', bd: '#c2d8f0', tx: '#2f5d8c' },
  { bg: '#fbf2e0', bd: '#ecd9b0', tx: '#9a6a1c' },
  { bg: '#f4eafb', bd: '#ddc8ea', tx: '#7a4a86' },
  { bg: '#fbe9ec', bd: '#f0c5cd', tx: '#a23b53' },
  { bg: '#e6f5f3', bd: '#bfe3dd', tx: '#2f7a6e' },
];
export function personColor(name) {
  if (!name) return { bg: '#eeeeee', bd: '#cccccc', tx: '#555555' };
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PERSON_PALETTE[h % PERSON_PALETTE.length];
}

// 'YYYY-MM-DD' → 'M/D' (도장에 찍히는 짧은 날짜)
export function shortDate(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  if (p.length < 3) return String(iso);
  return `${parseInt(p[1], 10)}/${parseInt(p[2], 10)}`;
}

// 사람 이름 짧게 (도장에 표시) — 너무 길면 잘라준다
export function shortName(name) {
  if (!name) return '?';
  const base = String(name).includes('@') ? String(name).split('@')[0] : String(name);
  return base.length > 5 ? base.slice(0, 5) : base;
}

// completions(이벤트 로그) → { item_id: [{by, d, done_on}, ...] }  (날짜 오름차순)
export function logsByItem(completions = []) {
  const map = {};
  for (const c of completions) {
    if (!map[c.item_id]) map[c.item_id] = [];
    map[c.item_id].push({ by: c.author, d: shortDate(c.done_on), done_on: c.done_on });
  }
  for (const k in map) {
    map[k].sort((a, b) => (a.done_on < b.done_on ? -1 : a.done_on > b.done_on ? 1 : 0));
  }
  return map;
}

// 한 달 항목들의 진행률 (한 번이라도 한 항목 = 완료)
export function monthProgress(items = [], logs = {}) {
  const total = items.length;
  const done = items.filter((it) => (logs[it.id] || []).length > 0).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// 한 달 항목을 범주별 카드로 묶기 (ORDER 순서, 비어 있는 범주는 제외)
export function groupByCategory(items = []) {
  return ORDER
    .map((key) => ({
      key,
      cat: CATS[key],
      items: items
        .filter((it) => it.category === key)
        .slice()
        .sort((a, b) => (a.sort_order - b.sort_order) || ((a.created_at || '') < (b.created_at || '') ? -1 : 1)),
    }))
    .filter((g) => g.items.length > 0);
}

// 월별 항목 묶기 (전체 보기 등에서 사용)
export function itemsByMonth(allItems = []) {
  const by = {};
  for (const it of allItems) {
    if (!by[it.month]) by[it.month] = [];
    by[it.month].push(it);
  }
  return by;
}

// 전체 보기 — 월별 진행률 + 올해 평균
export function yearOverview(allItems = [], logs = {}) {
  const by = itemsByMonth(allItems);
  const rows = STRIP_MONTHS.map((m) => {
    const its = by[m] || [];
    if (!its.length) return { month: m, stage: STAGE[m] || '', pct: null, done: 0, total: 0, empty: true };
    return { month: m, stage: STAGE[m] || '', ...monthProgress(its, logs), empty: false };
  });
  const filled = rows.filter((r) => !r.empty);
  const avg = filled.length ? Math.round(filled.reduce((a, r) => a + r.pct, 0) / filled.length) : 0;
  return { rows, avg };
}

// app_settings 행들(key=manual_guide_<월>) → { 월: 메시지 }
export function parseGuides(rows = []) {
  const g = {};
  for (const r of rows) {
    const m = /^manual_guide_(\d{1,2})$/.exec(r.key || '');
    if (m) g[parseInt(m[1], 10)] = r.value || '';
  }
  return g;
}
