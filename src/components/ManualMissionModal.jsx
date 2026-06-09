// src/components/ManualMissionModal.jsx
// 이달의 포도 미션 (월별 재배 매뉴얼 + 했어요 체크) — 전체 화면 모달
// - 진실: manual_items(원본) + manual_completions(이벤트 로그).  횟수·달성률·도장은 lib/manual.js에서 계산.
// - 색이 채워지는 모델: 항목 완료 → 그 줄이 범주색(연하게), 카드 전부 완료 → 헤더가 범주색으로 가득.
// - 농장 공통 진도 + 누가 했는지 도장. "했어요"는 누를 때마다 한 줄 쌓임(반복 가능).
// - 관리자 수정(1234) = 항목 추가/수정/삭제(soft) + 안내 한마디.  전체 보기 = 월별 달성률.
// 톤앤매너·포털 규약은 IrrigationModal과 동일.

import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import {
  CATS, ORDER, STAGE, STRIP_MONTHS,
  logsByItem, monthProgress, groupByCategory, itemsByMonth, yearOverview, parseGuides,
  personColor, shortDate, shortName,
} from '../lib/manual';
import ManualMissionEditPanel from './ManualMissionEditPanel';

const CSS = `
.pmm-backdrop{position:fixed; inset:0; background:rgba(34,46,36,.6); z-index:9999; display:flex; align-items:flex-start; justify-content:center; overflow:auto; -webkit-overflow-scrolling:touch; padding:3vh 0;}
.pmm-wrap{--bg:#f3efe6; --ink:#3a382f; --line:#ece6d8; --green:#5aa36a; --green-bg:#e9f4ec; --green-line:#bfe0c6; --pill-off:#efe9dc;
  max-width:430px; width:100%; margin:0 auto; background:var(--bg); color:var(--ink); border-radius:22px; overflow:hidden;
  box-shadow:0 24px 70px rgba(0,0,0,.35); padding-bottom:24px;
  font-family:'Apple SD Gothic Neo',system-ui,-apple-system,'Malgun Gothic',sans-serif; line-height:1.45;}
.pmm-wrap *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
.pmm-wrap .top{position:sticky; top:0; z-index:5; background:var(--bg); padding:16px 16px 8px; border-bottom:1px solid var(--line);}
.pmm-wrap .top h1{font-size:18px; margin:0; letter-spacing:-.3px;}
.pmm-wrap .top .subtitle{font-size:11px; color:#a08a6a; font-weight:700; margin-top:1px; letter-spacing:.3px;}
.pmm-wrap .toprow{display:flex; align-items:flex-start; gap:8px;}
.pmm-wrap .who{margin-left:auto; font-size:12px; color:#2f6b3c; font-weight:700; background:#fff; border:1px solid var(--line); border-radius:20px; padding:5px 11px; white-space:nowrap;}
.pmm-wrap .xclose{flex:0 0 auto; width:30px; height:30px; border-radius:50%; border:1px solid var(--line); background:#fff; color:#8a8472; font-size:15px; font-weight:700; cursor:pointer; line-height:1; padding:0;}
.pmm-wrap .hint{font-size:11px; color:#a39a88; margin:6px 0 0;}
.pmm-wrap .modes{display:flex; gap:6px; padding:10px 16px 0;}
.pmm-wrap .modes button{flex:1; font:inherit; font-weight:700; font-size:12px; padding:8px; border-radius:10px; border:1px solid var(--line); background:#fff; color:#8a8472; cursor:pointer;}
.pmm-wrap .modes button.on{background:#2f6b3c; color:#fff; border-color:#2f6b3c;}
.pmm-wrap .strip{display:flex; gap:5px; overflow-x:auto; padding:12px 16px 6px; margin:0;}
.pmm-wrap .strip::-webkit-scrollbar{display:none;}
.pmm-wrap .mon{flex:0 0 auto; width:40px; text-align:center; border-radius:12px; padding:7px 0; font-size:12px; font-weight:700; cursor:pointer; background:var(--pill-off); color:#b3ac9d; border:1.5px solid transparent; position:relative;}
.pmm-wrap .mon small{display:block; font-size:9px; font-weight:600; opacity:.8;}
.pmm-wrap .mon.done{background:var(--green-bg); color:var(--green);}
.pmm-wrap .mon.empty{opacity:.5;}
.pmm-wrap .mon.sel{background:#fff; color:var(--ink); border-color:var(--green); box-shadow:0 1px 6px #5aa36a33;}
.pmm-wrap .mon.done::after{content:"✓"; position:absolute; top:-6px; right:-2px; font-size:10px; background:var(--green); color:#fff; width:15px; height:15px; line-height:15px; border-radius:50%;}
.pmm-wrap .mhead{padding:10px 16px 4px; display:flex; align-items:center; gap:8px;}
.pmm-wrap .mhead .t{font-size:20px; font-weight:800;}
.pmm-wrap .mhead .stage{font-size:12px; color:#8a8472; font-weight:600;}
.pmm-wrap .mhead .edit{margin-left:auto; font-size:12px; font-weight:700; color:#6b6456; background:#fff; border:1px solid var(--line); border-radius:9px; padding:6px 11px; cursor:pointer;}
.pmm-wrap .bar{height:9px; background:#e7e1d3; border-radius:6px; overflow:hidden; margin:9px 16px 4px;}
.pmm-wrap .bar > i{display:block; height:100%; background:linear-gradient(90deg,#6bbb7b,#5aa36a); width:0; transition:width .4s ease;}
.pmm-wrap .barlabel{font-size:12px; color:#6b6456; display:flex; justify-content:space-between; padding:0 16px;}
.pmm-wrap .barlabel b{color:var(--green);}
.pmm-wrap .guide{margin:10px 16px 0; background:#fff7e6; border:1px solid #f0e2bf; color:#8a6d2a; border-radius:12px; padding:10px 12px; font-size:13px; font-weight:600; display:flex; gap:8px; align-items:flex-start; line-height:1.45;}
.pmm-wrap .guide b{font-size:15px; line-height:1.2;}
.pmm-wrap .catcard{margin:14px 16px 0; background:#fff; border:1px solid var(--line); border-top:4px solid var(--c,#ccc); border-radius:16px; overflow:hidden; box-shadow:0 1px 4px rgba(120,110,90,.05);}
.pmm-wrap .cathead{display:flex; align-items:center; gap:9px; padding:12px 15px; font-weight:800; font-size:15px; color:#3a382f; background:#fff; transition:background .35s ease, color .35s ease;}
.pmm-wrap .cathead .dot{width:11px; height:11px; border-radius:4px; flex:0 0 auto; background:var(--c); transition:background .35s ease;}
.pmm-wrap .cathead .cnt{margin-left:auto; font-size:12px; color:#9a917f; font-weight:800; transition:color .35s ease;}
.pmm-wrap .catcard.alldone .cathead{background:var(--c); color:#fff;}
.pmm-wrap .catcard.alldone .cathead .dot{background:#fff;}
.pmm-wrap .catcard.alldone .cathead .cnt{color:#fff;}
.pmm-wrap .catbody{padding:8px 11px 11px;}
.pmm-wrap .item{display:flex; align-items:flex-start; gap:10px; padding:11px; margin-top:7px; border-radius:12px; background:#faf8f3; transition:background .35s ease;}
.pmm-wrap .catbody > .item:first-child{margin-top:0;}
.pmm-wrap .item.done{background:var(--ctint,#eef3ec);}
.pmm-wrap .item .body{flex:1; min-width:0;}
.pmm-wrap .item .txt{display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; cursor:pointer; color:#7c7666;}
.pmm-wrap .item .txt .tt{flex:1; min-width:0;}
.pmm-wrap .item .tip{flex:0 0 auto; display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:700; color:#9a8f76; background:#f1ece0; border:1px solid #e3dcc9; border-radius:999px; padding:2px 8px; white-space:nowrap;}
.pmm-wrap .item.open .tip{color:#2f6b3c; background:#e9f4ec; border-color:#bfe0c6;}
.pmm-wrap .item .tip .arw{font-size:9px; transition:transform .2s ease;}
.pmm-wrap .item.open .tip .arw{transform:rotate(180deg);}
.pmm-wrap .item.done .txt{color:#3a382f;}
.pmm-wrap .item .detail{display:none; font-size:12px; color:#6b6456; margin-top:5px; padding:7px 9px; background:rgba(255,255,255,.65); border-radius:8px;}
.pmm-wrap .item.open .detail{display:block;}
.pmm-wrap .item .meta{font-size:11px; color:#a39a88; margin-top:3px;}
.pmm-wrap .stamps{display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; align-items:center;}
.pmm-wrap .stamp{display:inline-flex; flex-direction:column; align-items:center; line-height:1.12; border:1px solid; border-radius:9px; padding:3px 8px; font-size:9.5px;}
.pmm-wrap .stamp b{font-size:12px; font-weight:800; letter-spacing:-.3px;}
.pmm-wrap .stamp.new{animation:pmm-pop .45s cubic-bezier(.18,.9,.3,1.35);}
.pmm-wrap .stamps .cnt{font-size:11px; color:#9bb5a1; font-weight:700; margin-left:1px;}
@keyframes pmm-pop{0%{transform:scale(.2) translateY(6px); opacity:0;} 60%{transform:scale(1.15) translateY(0);} 100%{transform:scale(1); opacity:1;}}
.pmm-wrap .btn{flex:0 0 auto; border:none; border-radius:10px; cursor:pointer; font:inherit; font-weight:800; font-size:12px; padding:9px 12px; background:#2f6b3c; color:#fff; white-space:nowrap;}
.pmm-wrap .btn:active{transform:scale(.96);}
.pmm-wrap .btn:disabled{opacity:.55;}
.pmm-wrap .btn.again{background:#fff; color:#2f6b3c; border:1.5px solid #bfe0c6;}
.pmm-wrap .empty-note{margin:24px 16px; text-align:center; color:#a39a88; font-size:13px; background:#fff; border:1px dashed var(--line); border-radius:14px; padding:26px 16px;}
.pmm-wrap .ovhead{margin:14px 16px 8px; text-align:center;}
.pmm-wrap .ovhead .big{font-size:36px; font-weight:800; color:#2f6b3c; line-height:1;}
.pmm-wrap .ovhead .sub{font-size:12px; color:#8a8472; margin-top:4px;}
.pmm-wrap .ovcard{margin:0 16px 8px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:11px 13px; cursor:pointer; display:flex; align-items:center; gap:11px;}
.pmm-wrap .ovcard .nm{font-size:14px; font-weight:700; width:78px; flex:0 0 auto;}
.pmm-wrap .ovcard .nm small{color:#a39a88; font-weight:600; font-size:10px; display:block;}
.pmm-wrap .ovcard .pbar{flex:1; height:8px; background:#eee7d8; border-radius:5px; overflow:hidden;}
.pmm-wrap .ovcard .pbar i{display:block; height:100%; background:linear-gradient(90deg,#6bbb7b,#5aa36a);}
.pmm-wrap .ovcard .pv{font-size:13px; font-weight:800; color:#2f6b3c; width:48px; text-align:right; flex:0 0 auto;}
.pmm-wrap .ovcard.empty .pv{color:#c3bcab;}
.pmm-wrap .erow{background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px; margin:0 16px 8px; display:flex; gap:8px; align-items:flex-start;}
.pmm-wrap .erow select{font:inherit; font-size:12px; border:1px solid var(--line); border-radius:8px; padding:6px; background:#faf7f0;}
.pmm-wrap .erow .ef{flex:1; display:flex; flex-direction:column; gap:6px; min-width:0;}
.pmm-wrap .erow input{font:inherit; border:1px solid var(--line); border-radius:8px; padding:7px 9px; width:100%;}
.pmm-wrap .erow input.title{font-size:14px; font-weight:600;}
.pmm-wrap .erow input.det{font-size:12px; color:#6b6456;}
.pmm-wrap .erow .del{border:none; background:#f6e9e6; color:#b5524a; font-weight:700; font-size:11px; border-radius:8px; padding:7px 9px; cursor:pointer; flex:0 0 auto;}
.pmm-wrap .addbtn{display:block; width:calc(100% - 32px); margin:4px 16px 0; padding:11px; border:1.5px dashed var(--green-line); background:var(--green-bg); color:#2f6b3c; font-weight:800; font-size:13px; border-radius:12px; cursor:pointer;}
.pmm-wrap .ecat{margin:12px 16px 0; background:#fff; border:1px solid var(--line); border-top:4px solid var(--c,#ccc); border-radius:14px; overflow:hidden;}
.pmm-wrap .ecat-head{display:flex; align-items:center; gap:8px; padding:10px 13px 8px; font-weight:800; font-size:14px; color:#3a382f;}
.pmm-wrap .ecat-head .ecat-dot{width:10px; height:10px; border-radius:4px; background:var(--c); flex:0 0 auto;}
.pmm-wrap .ecat-head .ecat-cnt{margin-left:auto; font-size:12px; color:#9a917f; font-weight:800;}
.pmm-wrap .ecat .erow{margin:0 11px 8px;}
.pmm-wrap .emove{display:flex; flex-direction:column; gap:3px; flex:0 0 auto;}
.pmm-wrap .emove .mv{width:30px; height:22px; border:1px solid var(--line); background:#faf7f0; color:#6b6456; border-radius:7px; font-size:11px; line-height:1; cursor:pointer; padding:0;}
.pmm-wrap .emove .mv:disabled{opacity:.3; cursor:default;}
.pmm-wrap .ecat-add{display:block; width:calc(100% - 22px); margin:2px 11px 11px; padding:9px; border:1.5px dashed var(--c,#cfcabb); background:#faf8f3; color:#6b6456; font-weight:700; font-size:12px; border-radius:10px; cursor:pointer;}
.pmm-wrap .savebar{position:sticky; bottom:0; background:var(--bg); padding:12px 16px; display:flex; gap:8px; border-top:1px solid var(--line); margin-top:12px;}
.pmm-wrap .savebar .btn{flex:1; padding:13px;}
.pmm-wrap .foot{text-align:center; font-size:11px; color:#b3ac9d; margin:22px 16px 0;}
.pmm-wrap .loadnote{text-align:center; color:#a39a88; font-size:13px; padding:50px 16px;}
.pmm-toast{position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#2f6b3c; color:#fff; padding:10px 18px; border-radius:24px; font-size:13px; font-weight:700; z-index:10001; box-shadow:0 6px 20px #2f6b3c55;}
.pmm-overlay{position:fixed; inset:0; background:rgba(34,46,36,.55); display:flex; align-items:center; justify-content:center; z-index:10002; padding:24px; animation:pmm-fade .25s;}
.pmm-overlay .card{background:#fff; border-radius:22px; padding:30px 26px 24px; text-align:center; max-width:320px; width:100%; box-shadow:0 24px 70px rgba(0,0,0,.3); animation:pmm-rise .45s cubic-bezier(.2,.8,.2,1.25); font-family:'Apple SD Gothic Neo',system-ui,sans-serif;}
.pmm-overlay .ring{width:78px; height:78px; border-radius:50%; margin:0 auto 14px; background:#e9f4ec; border:3px solid #5aa36a; color:#5aa36a; font-size:42px; font-weight:800; line-height:74px;}
.pmm-overlay h2{margin:0 0 6px; color:#2f6b3c; font-size:22px;}
.pmm-overlay p{color:#6b6456; margin:0 0 18px; font-size:14px;}
.pmm-overlay input{width:100%; font:inherit; font-size:18px; text-align:center; letter-spacing:6px; border:1.5px solid #ece6d8; border-radius:12px; padding:12px; margin-bottom:14px;}
.pmm-overlay .row{display:flex; gap:8px;}
.pmm-overlay .btn{border:none; border-radius:10px; cursor:pointer; font:inherit; font-weight:800; font-size:14px; padding:13px; background:#2f6b3c; color:#fff;}
.pmm-overlay .btn.again{background:#fff; color:#2f6b3c; border:1.5px solid #bfe0c6;}
.pmm-overlay .row .btn{flex:1;}
@keyframes pmm-rise{from{transform:translateY(30px) scale(.92); opacity:0;} to{transform:none; opacity:1;}}
@keyframes pmm-fade{from{opacity:0;} to{opacity:1;}}
`;

export default function ManualMissionModal({ user, onClose, onSaved }) {
  const authorName = user?.user_metadata?.nickname || user?.email || '농부';
  const curMonth = parseInt(todayKST().split('-')[1], 10);

  const [items, setItems] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [guides, setGuides] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sel, setSel] = useState(curMonth);
  const [mode, setMode] = useState('month');     // 'month' | 'all'
  const [openItems, setOpenItems] = useState(() => new Set());
  const [justAddedId, setJustAddedId] = useState(null);

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftGuide, setDraftGuide] = useState('');
  const [saving, setSaving] = useState(false);

  const [gateOpen, setGateOpen] = useState(false);
  const [gatePw, setGatePw] = useState('');
  const [cele, setCele] = useState(null);        // {text} | null
  const [toast, setToast] = useState('');

  // ── 데이터 로드 ──
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [itRes, coRes, gRes] = await Promise.all([
        supabase.from('manual_items').select('*').eq('archived', false),
        supabase.from('manual_completions').select('*'),
        supabase.from('app_settings').select('key,value').like('key', 'manual_guide_%'),
      ]);
      if (!alive) return;
      setItems(itRes.data || []);
      setCompletions(coRes.data || []);
      setGuides(parseGuides(gRes.data || []));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  // ── Realtime — 다른 농부가 체크하면 내 화면도 갱신 ──
  useEffect(() => {
    const ch = supabase
      .channel('manual_completions_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manual_completions' }, (payload) => {
        setCompletions((prev) => (prev.some((c) => c.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const logs = useMemo(() => logsByItem(completions), [completions]);
  const byMonth = useMemo(() => itemsByMonth(items), [items]);
  const monthItems = useMemo(() => byMonth[sel] || [], [byMonth, sel]);
  const grouped = useMemo(() => groupByCategory(monthItems), [monthItems]);
  const prog = useMemo(() => monthProgress(monthItems, logs), [monthItems, logs]);
  const overview = useMemo(() => yearOverview(items, logs), [items, logs]);

  function showToast(m) {
    setToast(m);
    clearTimeout(window._pmmTt);
    window._pmmTt = setTimeout(() => setToast(''), 1500);
  }

  function toggleOpen(id) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doItem(id) {
    const today = todayKST();
    const wasDone = (logs[id] || []).length > 0;
    const optimistic = { id: `tmp-${Date.now()}`, item_id: id, author: authorName, done_on: today };
    setCompletions((prev) => [...prev, optimistic]);
    setJustAddedId(id);
    showToast(`${shortName(authorName)} · ${shortDate(today)} 도장`);
    clearTimeout(window._pmmPop);
    window._pmmPop = setTimeout(() => setJustAddedId(null), 700);

    // 완료 축하 — 이 항목이 마지막 하나였고, 이번에 처음 채워졌을 때만
    if (!wasDone) {
      const newProg = monthProgress(monthItems, logsByItem([...completions, optimistic]));
      if (newProg.total > 0 && newProg.done === newProg.total) {
        setTimeout(() => setCele({ text: `${sel}월 · ${STAGE[sel] || ''} 매뉴얼을\n전부 클리어했어요 🍇` }), 250);
      }
    }

    const { data, error } = await supabase
      .from('manual_completions')
      .insert({ item_id: id, author: authorName, done_on: today })
      .select()
      .single();
    if (error) {
      setCompletions((prev) => prev.filter((c) => c !== optimistic));
      showToast('저장 실패 — 다시 시도해주세요');
      return;
    }
    setCompletions((prev) => prev.map((c) => (c === optimistic ? data : c)));
    onSaved?.();
  }

  // ── 관리자 수정 ──
  function openGate() {
    if (edit) { setEdit(false); setDraft(null); return; }
    setGatePw('');
    setGateOpen(true);
  }
  function checkGate() {
    if (gatePw === '1234') {
      setGateOpen(false);
      enterEdit();
    } else {
      showToast('비밀번호가 달라요');
      setGatePw('');
    }
  }
  function enterEdit() {
    // 범주(ORDER) 순으로 묶고, 같은 범주 안에서는 sort_order 순으로 정렬
    const rank = (c) => { const i = ORDER.indexOf(c); return i < 0 ? 99 : i; };
    const ordered = (byMonth[sel] || []).slice().sort((a, b) =>
      (rank(a.category) - rank(b.category)) || (a.sort_order - b.sort_order));
    setDraft(ordered.map((it) => ({ id: it.id, cat: it.category, title: it.title, detail: it.detail || '', _key: it.id })));
    setDraftGuide(guides[sel] || '');
    setEdit(true);
  }
  function changeRow(i, field, val) {
    setDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function delRow(i) { setDraft((prev) => prev.filter((_, idx) => idx !== i)); }
  // 항목 추가 — 누른 범주의 같은 범주 마지막 줄 다음에 끼워 넣는다(그룹 유지)
  function addRow(cat = 'grow') {
    setDraft((prev) => {
      const arr = prev.slice();
      let at = arr.length;
      for (let k = arr.length - 1; k >= 0; k--) { if (arr[k].cat === cat) { at = k + 1; break; } }
      arr.splice(at, 0, { cat, title: '', detail: '', _key: `new-${Date.now()}` });
      return arr;
    });
  }
  // 순서 바꾸기 — 같은 범주 안에서 가장 가까운 이웃과 자리 교환 (dir: -1 위, +1 아래)
  function moveRow(i, dir) {
    setDraft((prev) => {
      const arr = prev.slice();
      const cat = arr[i].cat;
      let j = i + dir;
      while (j >= 0 && j < arr.length && arr[j].cat !== cat) j += dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  async function saveEdit() {
    setSaving(true);
    const existing = byMonth[sel] || [];
    const keptIds = new Set(draft.filter((d) => d.id).map((d) => d.id));
    const toArchive = existing.filter((it) => !keptIds.has(it.id)).map((it) => it.id);
    const valid = draft.filter((d) => d.title.trim());
    const nowIso = new Date().toISOString();

    const inserts = [];
    const updates = [];
    valid.forEach((d, idx) => {
      const detail = d.detail.trim() || null;
      if (d.id) updates.push({ id: d.id, category: d.cat, title: d.title.trim(), detail, sort_order: idx });
      else inserts.push({ month: sel, category: d.cat, title: d.title.trim(), detail, sort_order: idx });
    });

    try {
      const ops = [];
      if (toArchive.length) {
        ops.push(supabase.from('manual_items').update({ archived: true, updated_at: nowIso }).in('id', toArchive));
      }
      for (const u of updates) {
        ops.push(supabase.from('manual_items')
          .update({ category: u.category, title: u.title, detail: u.detail, sort_order: u.sort_order, updated_at: nowIso })
          .eq('id', u.id));
      }
      if (inserts.length) ops.push(supabase.from('manual_items').insert(inserts));
      ops.push(supabase.from('app_settings').upsert({ key: `manual_guide_${sel}`, value: draftGuide.trim() }, { onConflict: 'key' }));
      const results = await Promise.all(ops);
      const failed = results.find((r) => r && r.error);
      if (failed) throw failed.error;

      setSaving(false);
      setEdit(false);
      setDraft(null);
      showToast('저장됐어요');
      setRefreshKey((k) => k + 1);
      onSaved?.();
    } catch {
      setSaving(false);
      showToast('저장 실패 — 다시 시도해주세요');
    }
  }

  // ── 렌더 ──
  function renderStrip() {
    return (
      <div className="strip">
        {STRIP_MONTHS.map((m) => {
          const its = byMonth[m] || [];
          const done = its.length > 0 && its.every((i) => (logs[i.id] || []).length > 0);
          const cls = 'mon' + (done ? ' done' : '') + (!its.length ? ' empty' : '') + (m === sel ? ' sel' : '');
          return (
            <div key={m} className={cls} onClick={() => { setSel(m); setMode('month'); setEdit(false); setDraft(null); }}>
              {m}월<small>{STAGE[m] || ''}</small>
            </div>
          );
        })}
      </div>
    );
  }

  function renderView() {
    if (!monthItems.length) {
      return (
        <div className="empty-note">
          이 달 메뉴얼은 아직 비어 있어요.<br /><b>관리자 수정</b>으로 항목을 추가하세요.
        </div>
      );
    }
    return grouped.map((g) => {
      const doneN = g.items.filter((it) => (logs[it.id] || []).length > 0).length;
      const allDone = doneN === g.items.length;
      return (
        <div
          key={g.key}
          className={'catcard' + (allDone ? ' alldone' : '')}
          style={{ '--c': g.cat.color, '--ctint': g.cat.tint }}
        >
          <div className="cathead">
            <span className="dot" />{g.cat.name}
            <span className="cnt">{allDone ? '✓ 완료' : `${doneN}/${g.items.length}`}</span>
          </div>
          <div className="catbody">
            {g.items.map((it) => {
              const il = logs[it.id] || [];
              const isDone = il.length > 0;
              const isOpen = openItems.has(it.id);
              return (
                <div key={it.id} className={'item' + (isDone ? ' done' : '') + (isOpen ? ' open' : '')}>
                  <div className="body">
                    <div
                      className="txt"
                      onClick={() => it.detail && toggleOpen(it.id)}
                      style={it.detail ? undefined : { cursor: 'default' }}
                    >
                      <span className="tt">{isDone ? '✓ ' : ''}{it.title}</span>
                      {it.detail && (
                        <span className="tip">💡 노하우<span className="arw">▾</span></span>
                      )}
                    </div>
                    {it.detail && <div className="detail">{it.detail}</div>}
                    {isDone ? (
                      <div className="stamps">
                        {il.map((l, k) => {
                          const p = personColor(l.by);
                          const isNew = justAddedId === it.id && k === il.length - 1;
                          return (
                            <span key={k} className={'stamp' + (isNew ? ' new' : '')} style={{ background: p.bg, borderColor: p.bd, color: p.tx }}>
                              <b style={{ color: p.tx }}>{l.d}</b>{shortName(l.by)}
                            </span>
                          );
                        })}
                        <span className="cnt">총 {il.length}회</span>
                      </div>
                    ) : (
                      <div className="meta">아직 안 함</div>
                    )}
                  </div>
                  <button className={'btn' + (isDone ? ' again' : '')} onClick={() => doItem(it.id)}>
                    {isDone ? '한 번 더' : '✓ 했어요'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  function renderOverview() {
    return (
      <div>
        <div className="ovhead">
          <div className="big">{overview.avg}%</div>
          <div className="sub">올해 농장 매뉴얼 평균 달성</div>
        </div>
        {overview.rows.map((r) => (
          <div key={r.month} className={'ovcard' + (r.empty ? ' empty' : '')} onClick={() => { setSel(r.month); setMode('month'); }}>
            <div className="nm">{r.month}월<small>{r.stage || '—'}</small></div>
            <div className="pbar"><i style={{ width: `${r.empty ? 0 : r.pct}%` }} /></div>
            <div className="pv">{r.empty ? '없음' : `${r.pct}%`}</div>
          </div>
        ))}
      </div>
    );
  }

  const isAll = mode === 'all';

  return ReactDOM.createPortal(
    <div className="pmm-backdrop" onClick={onClose}>
      <style>{CSS}</style>
      <div className="pmm-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <div className="toprow">
            <div>
              <h1>이달의 포도 미션</h1>
              <div className="subtitle">주요 재배 프로그램</div>
            </div>
            <span className="who">👤 {shortName(authorName)}</span>
            <button className="xclose" onClick={onClose} aria-label="닫기" title="닫기">✕</button>
          </div>
          <p className="hint">＊ 달을 눌러 이동, 항목 글씨를 누르면 노하우가 펼쳐져요.</p>
        </div>

        <div className="modes">
          <button className={mode === 'month' ? 'on' : ''} onClick={() => { setMode('month'); setEdit(false); setDraft(null); }}>이번 달</button>
          <button className={mode === 'all' ? 'on' : ''} onClick={() => { setMode('all'); setEdit(false); setDraft(null); }}>📊 전체</button>
        </div>

        {loading ? (
          <div className="loadnote">불러오는 중…</div>
        ) : isAll ? (
          renderOverview()
        ) : (
          <>
            {renderStrip()}
            <div className="mhead">
              <span className="t">{sel}월</span>
              <span className="stage">{STAGE[sel] || ''}</span>
              <button className="edit" onClick={openGate}>{edit ? '취소' : '관리자 수정'}</button>
            </div>

            {edit ? (
              <ManualMissionEditPanel
                month={sel}
                draft={draft || []}
                draftGuide={draftGuide}
                saving={saving}
                onChangeGuide={setDraftGuide}
                onChangeRow={changeRow}
                onDelRow={delRow}
                onMoveRow={moveRow}
                onAddRow={addRow}
                onCancel={() => { setEdit(false); setDraft(null); }}
                onSave={saveEdit}
              />
            ) : (
              <>
                <div className="bar"><i style={{ width: `${prog.pct}%` }} /></div>
                <div className="barlabel">
                  <span>이번 달 진행</span>
                  <span><b>{prog.pct}%</b> · {prog.done}/{prog.total}</span>
                </div>
                {guides[sel] && (
                  <div className="guide"><b>💬</b><span>{guides[sel]}</span></div>
                )}
                {renderView()}
                <div className="foot">색칠된 달이 위 띠에 ✓로 쌓여요. 도장 색 = 누가 했는지.</div>
              </>
            )}
          </>
        )}
      </div>

      {/* 완료 축하 */}
      {cele && (
        <div className="pmm-overlay" onClick={() => setCele(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="ring">✓</div>
            <h2>잘했습니다!</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{cele.text}</p>
            <button className="btn" style={{ width: '100%' }} onClick={() => setCele(null)}>좋아요</button>
          </div>
        </div>
      )}

      {/* 관리자 수정 비밀번호 */}
      {gateOpen && (
        <div className="pmm-overlay" onClick={() => setGateOpen(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="ring" style={{ fontSize: 34, lineHeight: '74px' }}>🔒</div>
            <h2 style={{ fontSize: 18 }}>매뉴얼 수정</h2>
            <p>수정 비밀번호를 입력하세요</p>
            <input
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              autoFocus value={gatePw}
              onChange={(e) => setGatePw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') checkGate(); }}
            />
            <div className="row">
              <button className="btn again" onClick={() => setGateOpen(false)}>취소</button>
              <button className="btn" onClick={checkGate}>확인</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="pmm-toast">{toast}</div>}
    </div>,
    document.body
  );
}
