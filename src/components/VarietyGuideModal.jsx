// src/components/VarietyGuideModal.jsx
// 품종별 재배 가이드 — 전체 화면 모달 (보여주기 v1: 연간 생육밴드 + 송이관리)
// - 진실: varieties(품종·송이관리 스펙) + variety_guides(품종×월 사진/영상/가이드).
// - 생육단계·색은 저장 안 하고 lib/variety-guide.js에서 month로 계산.
// - 편집(품종 추가/수정·사진 올리기)은 다음 단계. 여기선 읽기 전용 표시.
// 톤앤매너·포털 규약은 ManualMissionModal과 동일 (prefix: pvg-).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { useLabels } from '../LabelContext';
import { todayKST } from '../lib/treatment-cycles';
import {
  MONTH_STAGES, stageOfMonth, colorOfStage,
  cellPreview, mdLabel,
} from '../lib/variety-guide';
import { aggregateVarietyPhotos, aggregateFarmMonthly, weekOfMonth, weekStartKo, yearOfDate, availableYears } from '../lib/variety-records';
import { resizedImageUrl } from '../utils/supabaseImage';
import VarietyGuideEditPanel from './VarietyGuideEditPanel';
import PinchZoomPane from './PinchZoomPane';

const CSS = `
.pvg-backdrop{position:fixed; inset:0; background:rgba(34,46,36,.6); z-index:9999; display:flex; align-items:flex-start; justify-content:center; overflow:auto; -webkit-overflow-scrolling:touch; padding:3vh 0;}
.pvg-wrap{--bg:#f3efe6; --ink:#3a382f; --line:#ece6d8; --green:#5aa36a; max-width:440px; width:100%; margin:0 auto; background:var(--bg); color:var(--ink); border-radius:22px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.35); padding-bottom:24px; font-family:'Apple SD Gothic Neo',system-ui,-apple-system,'Malgun Gothic',sans-serif; line-height:1.45;}
.pvg-wrap *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
.pvg-top{position:sticky; top:0; z-index:5; background:var(--bg); padding:16px 16px 8px; border-bottom:1px solid var(--line); display:flex; align-items:flex-start; gap:8px;}
.pvg-top h1{font-size:18px; margin:0; letter-spacing:-.3px;}
.pvg-top .sub{font-size:11px; color:#a08a6a; font-weight:700; margin-top:1px; letter-spacing:.3px;}
.pvg-x{margin-left:auto; flex:0 0 auto; width:30px; height:30px; border-radius:50%; border:1px solid var(--line); background:#fff; color:#8a8472; font-size:15px; font-weight:700; cursor:pointer; line-height:1; padding:0;}
.pvg-tabs{display:flex; gap:6px; padding:10px 16px 0;}
.pvg-tab{flex:1; font:inherit; font-weight:700; font-size:13px; padding:9px; border-radius:10px; border:1px solid var(--line); background:#fff; color:#8a8472; cursor:pointer;}
.pvg-tab.on{background:#2f6b3c; color:#fff; border-color:#2f6b3c;}
/* 연간 검색 — 연도 골라보기 */
.pvg-years{display:flex; align-items:center; gap:6px; padding:10px 16px 0; flex-wrap:wrap;}
.pvg-years .pvg-yrlb{font-size:11px; font-weight:800; color:#a08a6a; margin-right:2px;}
.pvg-yr{font:inherit; font-weight:800; font-size:12px; padding:5px 13px; border-radius:999px; border:1px solid var(--line); background:#fff; color:#8a8472; cursor:pointer;}
.pvg-yr.on{background:#2f6b3c; color:#fff; border-color:#2f6b3c;}
.pvg-hint{font-size:11px; color:#a39a88; margin:8px 16px 0;}
.pvg-load{padding:50px 16px; text-align:center; color:#a39a88; font-size:13px;}
/* 연간 생육밴드 */
.pvg-band{padding:10px 12px 2px;}
.pvg-mhead{display:flex; gap:2px; align-items:flex-end; margin:0 0 8px 52px;}
.pvg-mh{flex:1; text-align:center; font-size:9px; font-weight:700; color:#8a8472; line-height:1.15;}
.pvg-mh b{display:block; font-size:11px; color:#3a382f;}
.pvg-mh.now b{color:var(--green);}
.pvg-brow{display:flex; align-items:center; gap:6px; margin-bottom:6px;}
.pvg-vl{flex:0 0 46px; font-size:11px; font-weight:800; color:#3a382f; text-align:right; line-height:1.15; padding-right:2px;}
.pvg-vl small{display:block; font-size:8px; color:#a08a6a; font-weight:700;}
.pvg-track{display:flex; gap:2px; flex:1;}
.pvg-seg{flex:1; height:42px; border-radius:6px; border:2px solid transparent; position:relative; cursor:pointer; padding:0; overflow:hidden;}
.pvg-seg .pvg-ph{position:absolute; inset:0; width:100%; height:100%; object-fit:cover;}
.pvg-seg.now{outline:2.5px solid var(--green); outline-offset:-1px;}
.pvg-vbadge{position:absolute; right:2px; bottom:1px; font-size:8px; color:#fff; background:rgba(0,0,0,.55); border-radius:4px; padding:0 3px; line-height:1.5;}
.pvg-farmrow .pvg-vl{color:#2f6b3c;}
.pvg-farmrow{padding-bottom:8px; margin-bottom:8px; border-bottom:1px dashed #ddd3bf;}
.pvg-diagdot{position:absolute; left:2px; top:2px; width:8px; height:8px; border-radius:50%; box-shadow:0 0 0 1px rgba(255,255,255,.85);}
.pvg-legend{display:flex; flex-wrap:wrap; gap:6px 10px; padding:12px 16px 2px;}
.pvg-lg{display:flex; align-items:center; gap:4px; font-size:10px; color:#6b6456; font-weight:600;}
.pvg-lg i{width:11px; height:11px; border-radius:3px; display:inline-block;}
.pvg-foot{text-align:center; font-size:11px; color:#b3ac9d; margin:18px 16px 0;}
.pvg-namewarn{margin:10px 12px 0; background:#fff7e6; border:1px solid #f0e2b8; border-radius:12px; padding:10px 12px; font-size:11.5px; color:#8a6d2a; line-height:1.5;}
.pvg-namewarn b{font-size:12px; color:#a06a2a;}
.pvg-namewarn > div{margin-top:3px;}
.pvg-namewarn .t{display:inline-block; min-width:46px; font-weight:800; color:#a06a2a;}
/* 송이관리 표 */
.pvg-cwrap{overflow-x:auto; padding:8px 12px 2px; -webkit-overflow-scrolling:touch;}
table.pvg-ct{border-collapse:separate; border-spacing:0; font-size:11px; width:max-content; min-width:100%;}
table.pvg-ct th, table.pvg-ct td{padding:6px 7px; text-align:center; border-bottom:1px solid var(--line); white-space:nowrap;}
table.pvg-ct thead .grp{font-size:10px; font-weight:800; color:#5b5446; background:#efe8da;}
table.pvg-ct thead .sub{font-size:10px; font-weight:700; color:#8a8472; line-height:1.1; background:#f7f2e8;}
table.pvg-ct .vcol{position:sticky; left:0; background:#fff; z-index:2; text-align:left; font-weight:800; color:#3a382f; box-shadow:1px 0 0 var(--line);}
table.pvg-ct thead .vcol{background:#efe8da;}
table.pvg-ct tbody tr{cursor:pointer;}
table.pvg-ct tbody tr:active td{background:#f3eede;}
table.pvg-ct tbody tr:active .vcol{background:#f3eede;}
.pvg-dot{display:inline-block; width:18px; height:18px; line-height:18px; border-radius:50%; font-size:10px; font-weight:800;}
.pvg-dot.o{background:var(--green); color:#fff;}
.pvg-dot.x{background:#efece4; color:#c2bbab;}
.pvg-dot.dash{color:#cdbf9e; font-weight:700;}
.pvg-num{font-weight:800; color:#8a6d2a;}
.pvg-memocell{text-align:left; max-width:128px; min-width:96px;}
.pvg-memoclip{font-size:10.5px; line-height:1.3; color:#5b5446; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden;}
.pvg-leaf{display:flex; flex-direction:column; gap:1px; align-items:center; line-height:1.25;}
.pvg-leaf span{font-size:10px; font-weight:800; color:#3a382f; white-space:nowrap;}
/* 상세 시트 */
.pvg-scrim{position:fixed; inset:0; background:rgba(34,46,36,.5); z-index:10001; display:flex; align-items:flex-end; justify-content:center;}
.pvg-sheet{background:#f3efe6; width:100%; max-width:440px; border-radius:20px 20px 0 0; max-height:82vh; overflow:auto; padding-bottom:20px; box-shadow:0 -10px 40px rgba(0,0,0,.3); animation:pvg-rise .28s ease;}
@keyframes pvg-rise{from{transform:translateY(30px); opacity:.4;} to{transform:none; opacity:1;}}
.pvg-shead{position:sticky; top:0; background:#f3efe6; display:flex; align-items:flex-start; gap:8px; padding:16px 16px 10px; border-bottom:1px solid var(--line);}
.pvg-shead .t{font-size:17px; font-weight:800;}
.pvg-shead .s{font-size:11px; color:#a08a6a; font-weight:700; margin-top:2px;}
.pvg-shead .x{margin-left:auto; width:28px; height:28px; border-radius:50%; border:1px solid var(--line); background:#fff; color:#8a8472; font-size:14px; cursor:pointer; flex:0 0 auto;}
.pvg-kcards{padding:12px 16px;}
.pvg-kcard{background:#fff; border:1px solid var(--line); border-left:4px solid var(--cl,#ccc); border-radius:12px; padding:11px 13px; margin-bottom:9px;}
.pvg-kcard .kl{font-size:12px; font-weight:800; color:var(--cl,#6b6456); margin-bottom:4px;}
.pvg-kcard .kt{font-size:13px; color:#3a382f; white-space:pre-line; line-height:1.5;}
.pvg-gal{display:flex; gap:6px; flex-wrap:wrap; padding:0 16px 10px;}
.pvg-gal img{width:88px; height:88px; object-fit:cover; border-radius:10px; border:1px solid var(--line);}
.pvg-shot{padding:8px 16px 2px;}
.pvg-shotcap{font-size:11px; font-weight:800; color:#8a6d2a; margin-bottom:5px; letter-spacing:.2px;}
.pvg-shot .pvg-gal{padding:0;}
.pvg-empty{padding:30px 16px; text-align:center; color:#a39a88; font-size:13px;}
/* 상세 시트 — 기록 카드(나무사진/직접사진) */
.pvg-rec{background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin:0 16px 9px;}
.pvg-rechd{display:flex; align-items:center; gap:6px; margin-bottom:7px; flex-wrap:wrap;}
.pvg-tree{font-size:12px; font-weight:800; color:#2f6b3c; background:#eaf3ea; border-radius:7px; padding:2px 7px; display:inline-flex; align-items:center; gap:4px;}
.pvg-treeic{font-style:normal; font-size:9px; font-weight:800; color:#fff; background:#2f6b3c; border-radius:4px; padding:1px 4px; letter-spacing:.5px;}
.pvg-date{font-size:11px; font-weight:700; color:#a08a6a;}
.pvg-count{font-size:10.5px; font-weight:800; color:#7a6f57; background:#efe8da; border-radius:7px; padding:1px 7px;}
.pvg-weekhd{display:flex; align-items:center; gap:7px; margin:14px 16px 8px; padding:6px 11px; background:#eaf3ea; border-left:4px solid #2f6b3c; border-radius:8px;}
.pvg-weekhd b{font-size:13px; font-weight:800; color:#2f6b3c;}
.pvg-weekhd span{font-size:10.5px; font-weight:700; color:#7a9a7e;}
.pvg-weekhd .pvg-weekdt{color:#3a6b45; background:#dcebdd; border-radius:6px; padding:1px 7px;}
/* 기록 카드 — 가로 2장씩 (세로 스크롤 줄임) */
.pvg-recgrid{display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 16px;}
.pvg-recgrid .pvg-rec{margin:0;}
.pvg-recgrid .pvg-rec .pvg-gal img{width:100%; height:116px;}
.pvg-treebtn{font-family:inherit; border:none; cursor:pointer;}
.pvg-treebtn:active{filter:brightness(.92);}
.pvg-who{font-size:10px; font-weight:700; color:#8a7a5a; background:#f3eede; border-radius:6px; padding:1px 6px;}
.pvg-worklb{font-size:10px; font-weight:800; color:#8a6d2a; align-self:center; margin-right:2px;}
.pvg-diag{font-size:10.5px; font-weight:800; color:#fff; border-radius:7px; padding:1px 8px; margin-left:auto;}
.pvg-works{display:flex; flex-wrap:wrap; gap:4px; margin-bottom:7px;}
.pvg-work{font-size:10.5px; font-weight:700; color:#6b5a36; background:#f3ead2; border:1px solid #e7dcbf; border-radius:7px; padding:1px 7px;}
.pvg-rec .pvg-gal{padding:0;}
.pvg-rec .pvg-cmt{font-size:11.5px; color:#6b6456; line-height:1.4; margin-top:6px; white-space:pre-line;}
.pvg-manage{display:block; width:calc(100% - 32px); margin:4px 16px 8px; padding:12px; border:1.5px dashed #e3cf94; background:#fff7e6; color:#8a6d2a; font-weight:800; font-size:13px; border-radius:12px; cursor:pointer;}
.pvg-toast{position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#2f6b3c; color:#fff; padding:10px 18px; border-radius:24px; font-size:13px; font-weight:700; z-index:10002; box-shadow:0 6px 20px #2f6b3c55;}
.pvg-gal img{cursor:zoom-in;}
.pvg-lightbox{position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:10010; display:flex; align-items:center; justify-content:center; padding:16px; animation:pvg-fade .15s ease;}
@keyframes pvg-fade{from{opacity:0;} to{opacity:1;}}
.pvg-lightbox img{max-width:96vw; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 10px 50px rgba(0,0,0,.5); touch-action:none; transform-origin:center center; will-change:transform;}
.pvg-lightbox .lbx{position:absolute; top:14px; right:16px; width:38px; height:38px; border-radius:50%; border:none; background:rgba(255,255,255,.18); color:#fff; font-size:18px; font-weight:700; cursor:pointer; line-height:1; padding:0; z-index:2;}
.pvg-lightbox .lbhint{position:absolute; top:18px; left:16px; right:64px; text-align:left; color:rgba(255,255,255,.7); font-size:12px; pointer-events:none;}
.pvg-lightbox .lbmore{position:absolute; bottom:24px; left:50%; transform:translateX(-50%); border:none; background:rgba(255,255,255,.95); color:#2f6b3c; font:inherit; font-weight:800; font-size:14px; padding:12px 20px; border-radius:24px; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,.4);}
`;

// 송이관리 표 컬럼 묶음 (헤더 2줄 구성)
function ClusterDot({ v }) {
  if (v === 'O') return <span className="pvg-dot o">○</span>;
  if (v === 'X') return <span className="pvg-dot x">✗</span>;
  return <span className="pvg-dot dash">–</span>;
}
function clusterMarkLabel(v) {
  return v === 'O' ? '○ 함' : v === 'X' ? '✗ 안 함' : '— 해당없음';
}

export default function VarietyGuideModal({ user, initialMonth, treeData = {}, onClose, onOpenTree }) {
  const curMonth = initialMonth || parseInt(todayKST().split('-')[1], 10);
  const curYear = parseInt(todayKST().split('-')[0], 10);   // 2026
  const [year, setYear] = useState(curYear);                // 연간 검색: 보고 있는 연도 (기본=올해)
  const { labels } = useLabels();

  const [varieties, setVarieties] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('band');     // 'band' | 'cluster'
  const [sheet, setSheet] = useState(null);   // {type:'cell',vid,m} | {type:'cluster',vid} | null
  const [lightbox, setLightbox] = useState(null);  // 확대해서 볼 사진 URL | null
  const [zoomHi, setZoomHi] = useState(false);     // 표를 충분히 확대하면 칸 사진을 원본(선명)으로
  const [toast, setToast] = useState('');
  // ── 편집(관리자) ──
  const [admin, setAdmin] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePw, setGatePw] = useState('');
  const [pending, setPending] = useState(null);     // 게이트 통과 후 열 editTarget
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback(async () => {
    const [vRes, gRes] = await Promise.all([
      supabase.from('varieties').select('*').eq('archived', false).order('sort_order'),
      supabase.from('variety_guides').select('*'),
    ]);
    setVarieties(vRes.data || []);
    setGuides(gRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { resetZoom(); }, [lightbox]);  // 새 사진 열 때마다 확대 초기화

  // ── 진짜 데이터원: 나무(trees) 사진을 품종명으로 집계 (minari: 모든 건 나무 안에서 매칭) ──
  //   year 로 그 해 기록만 — 2027년에 2026년 사진을 골라보기 위함. (minari 요청)
  const treeAgg = useMemo(() => aggregateVarietyPhotos(treeData, labels, year), [treeData, labels, year]);
  const farm = useMemo(() => aggregateFarmMonthly(treeData, labels, year), [treeData, labels, year]);
  // 선택할 수 있는 연도 — 나무에 있는 연도들 + 올해(데이터 없어도 항상 고를 수 있게). 최신 먼저.
  const years = useMemo(() => {
    const ys = availableYears(treeData);
    if (!ys.includes(curYear)) ys.unshift(curYear);
    return ys;
  }, [treeData, curYear]);
  // 품종 설정/가이드(varieties·variety_guides)는 "이름"으로 나무에 붙는다
  const cfgByName = useMemo(() => Object.fromEntries(varieties.map((v) => [v.name, v])), [varieties]);
  const nameOfVid = useMemo(() => Object.fromEntries(varieties.map((v) => [v.id, v.name])), [varieties]);
  // variety_guides → { [품종명]: { [월]: entries[] } } (직접 올린 사진 + 글 가이드)
  const guidesByName = useMemo(() => {
    const out = {};
    for (const g of guides || []) {
      const nm = nameOfVid[g.variety_id];
      if (!nm) continue;
      (out[nm] ??= {});
      (out[nm][g.month] ??= []).push(g);
    }
    for (const months of Object.values(out))
      for (const m of Object.keys(months))
        months[m].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return out;
  }, [guides, nameOfVid]);
  // 표시할 품종 목록: 설정 순서(sort_order) 먼저 + 나무에만 있는 품종을 뒤에 붙임
  const displayNames = useMemo(() => {
    const ordered = varieties.map((v) => v.name);
    const extra = treeAgg.names.filter((n) => !ordered.includes(n)).sort((a, b) => a.localeCompare(b, 'ko'));
    return [...ordered, ...extra];
  }, [varieties, treeAgg]);

  // 맵 라벨(=진실)에 실제로 존재하는 품종 이름들. (사진 유무와 무관 — 매칭 점검용)
  const treeLabelNames = useMemo(() => {
    const set = new Set();
    for (const [k, v] of Object.entries(labels || {})) {
      if (!k.startsWith('Tree-')) continue;
      const nm = (v?.name || '').trim();
      if (nm) set.add(nm);
    }
    return set;
  }, [labels]);
  // 이름 점검 — 설정에만 있고 나무 라벨엔 없는 이름(=사진이 안 붙는 매칭 실수)만 경고.
  //   '나무에만' 쪽은 이미 밴드에 '나무' 줄로 자동으로 뜨므로 카드로 또 보여주지 않음 (minari 요청).
  const nameWarn = useMemo(() => {
    const cfg = new Set(varieties.map((v) => v.name));
    return {
      configOnly: [...cfg].filter((n) => !treeLabelNames.has(n)),   // 설정엔 있는데 맵엔 없음 → 매칭 실수
    };
  }, [varieties, treeLabelNames]);

  // 한 칸(품종·월)의 사진 엔트리 — 나무사진 + 직접올린 사진. 최신 먼저.
  const entryTime = (e) => new Date(e.kind === 'tree' ? e.date : (e.created_at || 0)).getTime();
  function cellEntries(name, month) {
    const tree = treeAgg.byName[name]?.[month] || [];   // 나무사진은 이미 year 로 걸러짐
    const manual = (guidesByName[name]?.[month] || []).filter(
      (e) => ((e.image_urls?.length) || e.video_url) && yearOfDate(e.created_at) === year,  // 직접올린 사진도 그 해만
    );
    return [...tree, ...manual].sort((a, b) => entryTime(b) - entryTime(a));
  }
  // 한 칸의 글-가이드 행 (그 달 하나)
  function guideTextOf(name, month) {
    const rows = guidesByName[name]?.[month] || [];
    return rows.find((e) => !(e.image_urls?.length) && !e.video_url) || null;
  }
  const vidOf = (name) => cfgByName[name]?.id || null;

  // 표를 2.5배 이상 당기면 보이는 칸만 원본으로 교체 → 확대 시 선명. (같은 값이면 리렌더 안 함)
  const handleScale = useCallback((s) => {
    const hi = s >= 2.5;
    setZoomHi((v) => (v === hi ? v : hi));
  }, []);

  function showToast(m) {
    setToast(m);
    clearTimeout(window._pvgTt);
    window._pvgTt = setTimeout(() => setToast(''), 1600);
  }

  // 편집 진입 — 비밀번호 임시 해제(minari 요청). 나중에 다시 켜려면 게이트 블록 복원.
  function requireAdmin(targetObj) {
    setEditTarget(targetObj);
  }
  function checkGate() {
    if (gatePw === '1234') {
      setAdmin(true);
      setGateOpen(false);
      setEditTarget(pending);
      setPending(null);
    } else {
      showToast('비밀번호가 달라요');
      setGatePw('');
    }
  }
  async function handleSaved() {
    setEditTarget(null);
    setSheet(null);
    await load();
    showToast('저장했어요');
  }

  // ── 사진 확대 화면 핀치-줌 (앱 전역 user-scalable=no 라서 자체 구현) ──
  //   두 손가락: 확대/축소 · 한 손가락(확대 상태): 이동 · 두 번 톡: 토글
  const lbImgRef = useRef(null);
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0, sd: 0, ss: 1, st: null, moved: false, tap: 0 });
  function applyZoom() {
    const g = zoomRef.current;
    if (lbImgRef.current) lbImgRef.current.style.transform = `translate(${g.tx}px,${g.ty}px) scale(${g.scale})`;
  }
  function resetZoom() {
    zoomRef.current = { scale: 1, tx: 0, ty: 0, sd: 0, ss: 1, st: null, moved: false, tap: 0 };
    applyZoom();
  }
  function touchDist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function onLbStart(e) {
    const g = zoomRef.current; g.moved = false;
    if (e.touches.length === 2) { g.sd = touchDist(e.touches[0], e.touches[1]); g.ss = g.scale; }
    else if (e.touches.length === 1) { g.st = { x: e.touches[0].clientX - g.tx, y: e.touches[0].clientY - g.ty }; }
  }
  function onLbMove(e) {
    const g = zoomRef.current;
    if (e.touches.length === 2) {
      const s = Math.max(1, Math.min(5, g.ss * (touchDist(e.touches[0], e.touches[1]) / (g.sd || 1))));
      g.scale = s; g.moved = true;
      if (s === 1) { g.tx = 0; g.ty = 0; }
      applyZoom();
    } else if (e.touches.length === 1 && g.scale > 1 && g.st) {
      g.tx = e.touches[0].clientX - g.st.x; g.ty = e.touches[0].clientY - g.st.y; g.moved = true;
      applyZoom();
    }
  }
  function onLbEnd(e) {
    const g = zoomRef.current;
    if (g.scale <= 1.02) { g.scale = 1; g.tx = 0; g.ty = 0; applyZoom(); }
    if (!g.moved && e.touches.length === 0) {            // 두 번 톡 → 확대/축소 토글
      const now = Date.now();
      if (now - g.tap < 300) { g.scale = g.scale > 1 ? 1 : 2.5; if (g.scale === 1) { g.tx = 0; g.ty = 0; } applyZoom(); g.tap = 0; }
      else g.tap = now;
    }
  }
  // 사진 닫기 → 칸에서 바로 연 사진이면 '이 시기 가이드'(시트)로 돌아간다 (그냥 끄지 않음)
  function closeLightbox() {
    const lb = lightbox;
    setLightbox(null);
    if (lb?.name) setSheet({ type: 'cell', name: lb.name, m: lb.m });
  }

  const nextVarietySort = varieties.reduce((mx, x) => Math.max(mx, x.sort_order || 0), 0) + 1;
  // 칸 편집 패널엔 "직접 올린" 사진·영상 행만 (나무사진·글가이드 제외 — 나무사진은 나무에서 관리)
  const editCellEntries = editTarget?.mode === 'cell'
    ? (guidesByName[editTarget.vname]?.[editTarget.m] || []).filter((e) => (e.image_urls?.length) || e.video_url)
    : [];
  const nextGuideSort = editCellEntries.length
    ? Math.max(...editCellEntries.map((e) => e.sort_order || 0)) + 1 : 0;

  // ── 연간 생육밴드 ──
  function renderBand() {
    return (
      <div>
        {/* 연간 검색 — 연도 골라보기 (예: 2027년에 2026년 사진 열람). 기본은 올해. */}
        <div className="pvg-years">
          <span className="pvg-yrlb">연도</span>
          {years.map((y) => (
            <button key={y} type="button" className={'pvg-yr' + (y === year ? ' on' : '')} onClick={() => setYear(y)}>
              {y}년
            </button>
          ))}
        </div>
        {/* 이름 점검 — 설정에만 있고 나무엔 없는 이름이면 사진이 안 붙는다(매칭 실수). 그것만 경고. */}
        {nameWarn.configOnly.length > 0 && (
          <div className="pvg-namewarn">
            <b>이름 점검</b> — 설정에만 있고 나무 라벨엔 없는 이름이에요. 같은 품종이면 이름을 똑같이 맞춰주세요.
            <div><span className="t">설정에만</span> {nameWarn.configOnly.join(', ')}</div>
          </div>
        )}
        {/* 포도맵처럼 — 두 손가락 핀치줌 · 끌어서 이동 (앱 전역 user-scalable=no 우회) */}
        <PinchZoomPane height="58vh" maxScale={6} onScale={handleScale}>
          <div className="pvg-band">
            <div className="pvg-mhead">
              {MONTH_STAGES.map((s) => (
                <div key={s.m} className={'pvg-mh' + (s.m === curMonth ? ' now' : '')}>
                  {s.ab}<b>{s.m}월</b>
                </div>
              ))}
            </div>

            {/* 1단 · 우리 농장 한 해 — 월별 대표 사진 + 그 달 진단 */}
            <div className="pvg-brow pvg-farmrow">
              <div className="pvg-vl">우리<br />농장<small>전체</small></div>
              <div className="pvg-track">
                {MONTH_STAGES.map((s) => {
                  const f = farm[s.m] || {};
                  const pv = cellPreview(f.entries || []);
                  const bandColor = f.band?.color || colorOfStage(s.sc);
                  return (
                    <button
                      key={s.m}
                      className={'pvg-seg' + (s.m === curMonth ? ' now' : '')}
                      style={{ background: pv.thumb ? '#fff' : colorOfStage(s.sc), borderColor: bandColor }}
                      onClick={() => setSheet({ type: 'farm', m: s.m })}
                      aria-label={`농장 전체 ${s.m}월`}
                    >
                      {pv.thumb && <img className="pvg-ph" src={pv.thumb} alt="" loading="lazy" decoding="async" />}
                      {f.count > 0 && <span className="pvg-vbadge">{f.count}</span>}
                      {f.band && <span className="pvg-diagdot" style={{ background: bandColor }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2단 · 품종 한 해 — 이름(=나무 라벨)으로 묶인 줄 */}
            {displayNames.map((name) => {
              const cfg = cfgByName[name];
              const onTree = treeAgg.names.includes(name);
              return (
                <div className="pvg-brow" key={name}>
                  <div className="pvg-vl">{name}{cfg?.subtype && <small>{cfg.subtype}</small>}{!cfg && onTree && <small>나무</small>}</div>
                  <div className="pvg-track">
                    {MONTH_STAGES.map((s) => {
                      const entries = cellEntries(name, s.m);
                      const pv = cellPreview(entries);
                      const color = colorOfStage(s.sc);
                      const fullImg = entries.find((e) => e.image_urls?.length)?.image_urls?.[0] || null;
                      const cnt = entries.reduce((n, e) => n + (e.image_urls?.length || 0), 0);
                      return (
                        <button
                          key={s.m}
                          className={'pvg-seg' + (s.m === curMonth ? ' now' : '')}
                          style={{ background: pv.thumb ? '#fff' : color, borderColor: color }}
                          onClick={() => setSheet({ type: 'cell', name, m: s.m })}
                          aria-label={`${name} ${s.m}월 ${s.stage} 사진 ${cnt}장`}
                        >
                          {pv.thumb && <img className="pvg-ph" src={(zoomHi && fullImg) ? resizedImageUrl(fullImg, { width: 400 }) : pv.thumb} alt="" loading="lazy" decoding="async" />}
                          {(cnt > 0 || pv.hasVideo) && (
                            <span className="pvg-vbadge">{pv.hasVideo ? '▶ ' : ''}{cnt > 0 ? cnt : ''}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </PinchZoomPane>
        <div className="pvg-legend">
          {MONTH_STAGES.filter((s, i, a) => a.findIndex((x) => x.sc === s.sc) === i).map((s) => (
            <span className="pvg-lg" key={s.sc}><i style={{ background: colorOfStage(s.sc) }} />{s.stage}</span>
          ))}
        </div>
        <div className="pvg-foot">사진은 나무 기록에서 자동으로 모임(2-3 · 6/10). 칸을 누르면 그 시기 사진·한일·진단·가이드.</div>
      </div>
    );
  }

  // ── 송이관리 표 ──
  function renderCluster() {
    return (
      <div>
        <p className="pvg-hint">＊ ○=함, ✗=안 함, 숫자=크기. 잎수·가이드는 표에서 바로. 품종 줄을 누르면 자세히.</p>
        <div className="pvg-cwrap">
          <table className="pvg-ct">
            <thead>
              <tr>
                <th className="vcol" />
                <th className="grp">개화 7일 전</th>
                <th className="grp" colSpan={4}>개화 2~3일 전</th>
                <th className="grp" colSpan={3}>착과 후</th>
              </tr>
              <tr>
                <th className="vcol sub">품종</th>
                <th className="sub">가이드</th>
                <th className="sub">어깨<br />송이</th><th className="sub">윗<br />지경</th><th className="sub">송이<br />끝단</th><th className="sub">잎수</th>
                <th className="sub">크기</th><th className="sub">어깨<br />송이</th><th className="sub">송이<br />끝단</th>
              </tr>
            </thead>
            <tbody>
              {varieties.map((v) => {
                const c = v.cluster_spec || {};
                return (
                  <tr key={v.id} onClick={() => setSheet({ type: 'cluster', name: v.name })}>
                    <td className="vcol">{v.name}</td>
                    <td className="pvg-memocell">
                      {c.b7 ? <div className="pvg-memoclip">{String(c.b7).replace(/\n/g, ' ')}</div> : <span className="pvg-dot dash">–</span>}
                    </td>
                    <td><ClusterDot v={c.s} /></td><td><ClusterDot v={c.u} /></td><td><ClusterDot v={c.t} /></td>
                    <td>
                      {c.lf1 || c.lf2
                        ? <div className="pvg-leaf"><span>1송이 {c.lf1 || '–'}</span><span>2송이 {c.lf2 || '–'}</span></div>
                        : <span className="pvg-dot dash">–</span>}
                    </td>
                    <td>{c.sz && c.sz !== '-' ? <span className="pvg-num">{c.sz}</span> : <span className="pvg-dot dash">–</span>}</td>
                    <td><ClusterDot v={c.sa} /></td><td><ClusterDot v={c.ta} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'newVariety' })}>＋ 품종 추가</button>
        <div className="pvg-foot">표 출처: 기본 송이관리 기술(2024). 세력 약하면 평균보다 작게, 세다고 크게 두면 안 익음.</div>
      </div>
    );
  }

  // ── 상세 시트 ──
  // 사진 기록 카드 (나무사진 / 직접사진 공통) — 나무번호·날짜·한일·진단 도장
  function renderRec(e, showVariety) {
    const treeName = e.kind === 'tree' && showVariety ? (labels?.[`Tree-${e.treeId}`]?.name || '') : '';
    const md = e.kind === 'tree' ? e.md : mdLabel(e.created_at);   // "6/10"
    const [mm, dd] = (md || '').split('/');
    const koDate = mm && dd ? `${mm}월 ${dd}일` : md;              // 날짜는 "6월 10일" — 나무번호와 헷갈리지 않게
    const photoN = e.image_urls?.length || 0;
    return (
      <div className="pvg-rec" key={e.id}>
        <div className="pvg-rechd">
          {e.kind === 'tree'
            ? <button type="button" className="pvg-tree pvg-treebtn" onClick={() => onOpenTree?.(e.treeId)} title="이 나무 열기">
                <i className="pvg-treeic">나무</i>{e.treeId}{treeName ? ' · ' + treeName : ''}
              </button>
            : <span className="pvg-tree" style={{ background: '#efe8da', color: '#8a6d2a' }}>직접 올림</span>}
          <span className="pvg-date">{koDate}{e.kind !== 'tree' && e.title ? ' · ' + e.title : ''}</span>
          {photoN > 0 && <span className="pvg-count">사진 {photoN}장</span>}
          {e.producer && <span className="pvg-who">{e.producer}</span>}
          {e.diag && (
            <span className="pvg-diag" style={{ background: e.diag.band.color }}>
              {e.diag.band.label}{e.diag.reasons?.length ? ' · ' + e.diag.reasons.join('·') : ''}
            </span>
          )}
        </div>
        {e.work?.length > 0 && (
          <div className="pvg-works"><span className="pvg-worklb">실행작업</span>{e.work.map((w, i) => <span className="pvg-work" key={i}>{w}</span>)}</div>
        )}
        {e.video_url && (
          <video src={e.video_url} controls playsInline style={{ width: '100%', borderRadius: 10, background: '#000', display: 'block', marginBottom: e.image_urls?.length ? 6 : 0 }} />
        )}
        {(e.image_urls?.length > 0) && (
          <div className="pvg-gal">
            {e.image_urls.map((u, i) => (
              // 기존 썸네일은 80px라 카드(≈190px)에서 흐릿 → 중간크기(500px) 리사이즈로 또렷+가볍게.
              // (확대 라이트박스만 원본 u · loading=lazy 라 보이는 사진만 받음)
              <img key={i} src={resizedImageUrl(u, { width: 500 })} alt="" loading="lazy" decoding="async" onClick={() => setLightbox({ url: u })} />
            ))}
          </div>
        )}
        {e.kind === 'tree' && e.comments && <div className="pvg-cmt">{e.comments}</div>}
      </div>
    );
  }

  // 기록들을 그 달의 주차(1~4)로 묶어서 — 첫째주~넷째주 헤더로 나눠 보여준다 (minari 요청)
  function renderRecs(recs, showVariety) {
    const byWeek = {};
    for (const e of recs) {
      const w = weekOfMonth(e.kind === 'tree' ? e.date : e.created_at);
      (byWeek[w] ??= []).push(e);
    }
    const WEEK_KO = { 1: '첫째주', 2: '둘째주', 3: '셋째주', 4: '넷째주' };
    return Object.keys(byWeek).map(Number).sort((a, b) => a - b).map((w) => {
      const start = weekStartKo(byWeek[w]);  // 그 주 첫 기록 날짜 ("26년 4월 6일")
      const shots = byWeek[w].reduce((n, e) => n + (e.image_urls?.length || 0), 0);
      return (
        <div key={w}>
          <div className="pvg-weekhd">
            <b>{WEEK_KO[w] || `${w}주차`}</b>
            {start && <span className="pvg-weekdt">{start}~</span>}
            <span>· 사진 {shots}장</span>
          </div>
          <div className="pvg-recgrid">
            {byWeek[w].map((e) => renderRec(e, showVariety))}
          </div>
        </div>
      );
    });
  }

  function renderSheet() {
    if (!sheet) return null;

    let inner;
    if (sheet.type === 'farm') {
      const s = stageOfMonth(sheet.m);
      const f = farm[sheet.m] || {};
      const recs = f.entries || [];
      inner = (
        <>
          <div className="pvg-shead">
            <div>
              <div className="t">우리 농장 · {sheet.m}월</div>
              <div className="s">{s?.stage || ''}{f.band ? ' · 진단 ' + f.band.label : ''}</div>
            </div>
            <button className="x" onClick={() => setSheet(null)}>✕</button>
          </div>
          {recs.length === 0
            ? <div className="pvg-empty">이 달 나무 사진이 아직 없어요.</div>
            : renderRecs(recs, true)}
        </>
      );
    } else if (sheet.type === 'cell') {
      const name = sheet.name;
      const vid = vidOf(name);
      const s = stageOfMonth(sheet.m);
      const guideRow = guideTextOf(name, sheet.m);
      const recs = cellEntries(name, sheet.m);
      inner = (
        <>
          <div className="pvg-shead">
            <div>
              <div className="t">{name} · {sheet.m}월</div>
              <div className="s">{s?.stage || ''}</div>
            </div>
            <button className="x" onClick={() => setSheet(null)}>✕</button>
          </div>

          {guideRow?.detail && (
            <div className="pvg-kcards">
              <div className="pvg-kcard" style={{ '--cl': '#6b8f5a' }}>
                <div className="kl">이 시기 가이드</div>
                <div className="kt">{guideRow.detail}</div>
              </div>
            </div>
          )}

          {recs.length === 0 && !guideRow?.detail ? (
            <div className="pvg-empty">아직 이 시기 사진·가이드가 없어요.{'\n'}나무에 사진을 넣으면 여기 자동으로 모여요.</div>
          ) : (
            renderRecs(recs, false)
          )}

          {vid ? (
            <>
              <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'cell', vid, m: sheet.m, vname: name })}>
                ＋ 직접 사진·영상 추가 (나무번호 없이 · 날짜만)
              </button>
              <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'guide', vid, m: sheet.m, vname: name, guideRow })}>
                이 시기 가이드 {guideRow?.detail ? '고치기' : '쓰기'}
              </button>
            </>
          ) : (
            <div className="pvg-foot">사진은 나무 기록에서 자동으로 모여요. 송이관리·가이드 설정을 만들려면 '송이관리' 탭 → ＋ 품종 추가.</div>
          )}
        </>
      );
    } else { // cluster
      const name = sheet.name;
      const v = cfgByName[name];
      const c = v?.cluster_spec || {};
      inner = (
        <>
          <div className="pvg-shead">
            <div>
              <div className="t">{name}</div>
              <div className="s">송이관리 가이드 · 2024 기준</div>
            </div>
            <button className="x" onClick={() => setSheet(null)}>✕</button>
          </div>
          {v ? (
            <>
              <div className="pvg-kcards">
                <div className="pvg-kcard" style={{ '--cl': '#2f6b3c' }}>
                  <div className="kl">개화 7일 전</div>
                  <div className="kt">{c.b7 || '— 따로 없음'}</div>
                </div>
                <div className="pvg-kcard" style={{ '--cl': '#b5763a' }}>
                  <div className="kl">개화 2~3일 전</div>
                  <div className="kt">{`어깨송이제거 · ${clusterMarkLabel(c.s)}\n윗지경제거 · ${clusterMarkLabel(c.u)}\n송이끝단제거 · ${clusterMarkLabel(c.t)}\n잎수 · 1송이 ${c.lf1 || '–'} / 2송이 ${c.lf2 || '–'}`}</div>
                </div>
                <div className="pvg-kcard" style={{ '--cl': '#6b4a8a' }}>
                  <div className="kl">착과 후</div>
                  <div className="kt">{`크기조절 · ${c.sz && c.sz !== '-' ? c.sz : '— 해당없음'}\n어깨송이제거 · ${clusterMarkLabel(c.sa)}\n송이끝단제거 · ${clusterMarkLabel(c.ta)}`}</div>
                </div>
              </div>
              <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'variety', v })}>
                이 품종 수정 · 송이관리 값 고치기
              </button>
            </>
          ) : (
            <div className="pvg-empty">이 품종은 송이관리 설정이 없어요.{'\n'}'＋ 품종 추가'로 만들 수 있어요.</div>
          )}
        </>
      );
    }

    return (
      <div className="pvg-scrim" onClick={() => setSheet(null)}>
        <div className="pvg-sheet" onClick={(e) => e.stopPropagation()}>{inner}</div>
      </div>
    );
  }

  return ReactDOM.createPortal(
    <div className="pvg-backdrop" onClick={onClose}>
      <style>{CSS}</style>
      <div className="pvg-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="pvg-top">
          <div>
            <h1>품종별 재배 가이드</h1>
            <div className="sub">연간 생육 · 송이관리</div>
          </div>
          <button className="pvg-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="pvg-tabs">
          <button className={'pvg-tab' + (tab === 'band' ? ' on' : '')} onClick={() => setTab('band')}>연간 생육</button>
          <button className={'pvg-tab' + (tab === 'cluster' ? ' on' : '')} onClick={() => setTab('cluster')}>송이관리</button>
        </div>

        {loading ? (
          <div className="pvg-load">불러오는 중…</div>
        ) : varieties.length === 0 ? (
          <div className="pvg-empty">품종이 없어요. (Supabase varieties 테이블을 확인하세요)</div>
        ) : tab === 'band' ? renderBand() : renderCluster()}
      </div>

      {renderSheet()}

      {editTarget && (
        <VarietyGuideEditPanel
          target={editTarget}
          existingEntries={editCellEntries}
          nextVarietySort={nextVarietySort}
          nextGuideSort={nextGuideSort}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {gateOpen && (
        <div className="pvg-scrim" style={{ alignItems: 'center', zIndex: 10003 }} onClick={() => setGateOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#f3efe6', borderRadius: 18, padding: '22px 20px', width: '86%', maxWidth: 320, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#3a382f', marginBottom: 4 }}>가이드 수정</div>
            <div style={{ fontSize: 12, color: '#8a8472', marginBottom: 14 }}>수정 비밀번호를 입력하세요</div>
            <input
              type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus value={gatePw}
              onChange={(e) => setGatePw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') checkGate(); }}
              style={{ width: '100%', textAlign: 'center', letterSpacing: '8px', fontSize: 20, padding: '10px', border: '1px solid #e0d8c6', borderRadius: 10, background: '#fff' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setGateOpen(false)} style={{ flex: '0 0 90px', padding: 11, borderRadius: 10, border: 'none', background: '#efe8da', color: '#6b6456', fontWeight: 800, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={checkGate} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#2f6b3c', color: '#fff', fontWeight: 800, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="pvg-lightbox" onClick={closeLightbox}>
          <img
            ref={lbImgRef}
            src={lightbox.url}
            alt=""
            className="lbimg"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onLbStart}
            onTouchMove={onLbMove}
            onTouchEnd={onLbEnd}
          />
          {/* onTouchEnd preventDefault: 닫은 직후 유령 탭이 뒤(시트)를 끄는 것 방지 */}
          <button
            className="lbx"
            onClick={closeLightbox}
            onTouchEnd={(e) => { e.preventDefault(); closeLightbox(); }}
            aria-label="닫기"
          >‹</button>
          <div className="lbhint">두 손가락으로 확대 · 두 번 톡 확대/축소 · ‹ 누르면 가이드로</div>
        </div>
      )}

      {toast && <div className="pvg-toast">{toast}</div>}
    </div>,
    document.body
  );
}
