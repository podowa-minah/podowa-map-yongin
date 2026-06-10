// src/components/VarietyGuideModal.jsx
// 품종별 재배 가이드 — 전체 화면 모달 (보여주기 v1: 연간 생육밴드 + 송이관리)
// - 진실: varieties(품종·송이관리 스펙) + variety_guides(품종×월 사진/영상/가이드).
// - 생육단계·색은 저장 안 하고 lib/variety-guide.js에서 month로 계산.
// - 편집(품종 추가/수정·사진 올리기)은 다음 단계. 여기선 읽기 전용 표시.
// 톤앤매너·포털 규약은 ManualMissionModal과 동일 (prefix: pvg-).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import {
  MONTH_STAGES, STAGE_COLORS, stageOfMonth, colorOfStage,
  indexGuides, cellPreview, mdLabel,
} from '../lib/variety-guide';
import VarietyGuideEditPanel from './VarietyGuideEditPanel';

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
.pvg-legend{display:flex; flex-wrap:wrap; gap:6px 10px; padding:12px 16px 2px;}
.pvg-lg{display:flex; align-items:center; gap:4px; font-size:10px; color:#6b6456; font-weight:600;}
.pvg-lg i{width:11px; height:11px; border-radius:3px; display:inline-block;}
.pvg-foot{text-align:center; font-size:11px; color:#b3ac9d; margin:18px 16px 0;}
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

export default function VarietyGuideModal({ user, initialMonth, onClose }) {
  const curMonth = initialMonth || parseInt(todayKST().split('-')[1], 10);

  const [varieties, setVarieties] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('band');     // 'band' | 'cluster'
  const [sheet, setSheet] = useState(null);   // {type:'cell',vid,m} | {type:'cluster',vid} | null
  const [lightbox, setLightbox] = useState(null);  // 확대해서 볼 사진 URL | null
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

  const idx = useMemo(() => indexGuides(guides), [guides]);
  const byId = useMemo(() => Object.fromEntries(varieties.map((v) => [v.id, v])), [varieties]);

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

  const nextVarietySort = varieties.reduce((mx, x) => Math.max(mx, x.sort_order || 0), 0) + 1;
  // 칸 편집 패널엔 사진·영상 행만 (글-전용 가이드 행은 제외)
  const editCellEntries = editTarget?.mode === 'cell'
    ? (idx[editTarget.vid]?.[editTarget.m] || []).filter((e) => (e.image_urls?.length) || e.video_url)
    : [];
  const nextGuideSort = editCellEntries.length
    ? Math.max(...editCellEntries.map((e) => e.sort_order || 0)) + 1 : 0;

  // ── 연간 생육밴드 ──
  function renderBand() {
    return (
      <div>
        <div className="pvg-band">
          <div className="pvg-mhead">
            {MONTH_STAGES.map((s) => (
              <div key={s.m} className={'pvg-mh' + (s.m === curMonth ? ' now' : '')}>
                {s.ab}<b>{s.m}</b>
              </div>
            ))}
          </div>
          {varieties.map((v) => (
            <div className="pvg-brow" key={v.id}>
              <div className="pvg-vl">{v.name}{v.subtype && <small>{v.subtype}</small>}</div>
              <div className="pvg-track">
                {MONTH_STAGES.map((s) => {
                  const entries = idx[v.id]?.[s.m] || [];
                  const pv = cellPreview(entries);
                  const color = colorOfStage(s.sc);
                  // 사진 있는 칸 → 탭하면 곧장 크게(맵처럼). 없으면 상세 시트.
                  const fullImg = entries.find((e) => e.image_urls?.length)?.image_urls?.[0] || null;
                  return (
                    <button
                      key={s.m}
                      className={'pvg-seg' + (s.m === curMonth ? ' now' : '')}
                      style={{ background: pv.thumb ? '#fff' : color, borderColor: color }}
                      onClick={() => fullImg
                        ? setLightbox({ url: fullImg, vid: v.id, m: s.m })
                        : setSheet({ type: 'cell', vid: v.id, m: s.m })}
                      aria-label={`${v.name} ${s.m}월 ${s.stage}`}
                    >
                      {pv.thumb && <img className="pvg-ph" src={pv.thumb} alt="" loading="lazy" />}
                      {pv.hasVideo && <span className="pvg-vbadge">▶</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="pvg-legend">
          {MONTH_STAGES.filter((s, i, a) => a.findIndex((x) => x.sc === s.sc) === i).map((s) => (
            <span className="pvg-lg" key={s.sc}><i style={{ background: colorOfStage(s.sc) }} />{s.stage}</span>
          ))}
        </div>
        <div className="pvg-foot">칸을 누르면 그 시기 사진·영상·가이드를 봐요. 빈 칸은 아직 안 채운 시기.</div>
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
                  <tr key={v.id} onClick={() => setSheet({ type: 'cluster', vid: v.id })}>
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
  function renderSheet() {
    if (!sheet) return null;
    const v = byId[sheet.vid];
    if (!v) return null;

    let inner;
    if (sheet.type === 'cell') {
      const s = stageOfMonth(sheet.m);
      const entries = idx[v.id]?.[sheet.m] || [];
      // 글-전용 가이드 행(그 달에 하나) vs 사진·영상 행(쌓임, 날짜별)
      const guideRow = entries.find((e) => !(e.image_urls?.length) && !e.video_url) || null;
      const photoRows = entries
        .filter((e) => (e.image_urls?.length) || e.video_url)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      inner = (
        <>
          <div className="pvg-shead">
            <div>
              <div className="t">{v.name} · {sheet.m}월</div>
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

          {photoRows.length === 0 && !guideRow?.detail ? (
            <div className="pvg-empty">아직 이 시기 사진·가이드가 없어요.</div>
          ) : (
            photoRows.map((e) => (
              <div className="pvg-shot" key={e.id}>
                <div className="pvg-shotcap">{mdLabel(e.created_at)}{e.title ? ' · ' + e.title : ''}</div>
                {e.video_url && (
                  <video src={e.video_url} controls playsInline style={{ width: '100%', borderRadius: 12, background: '#000', display: 'block' }} />
                )}
                {(e.image_urls?.length > 0) && (
                  <div className="pvg-gal">
                    {e.image_urls.map((u, i) => (
                      <img key={i} src={u} alt="" loading="lazy" onClick={() => setLightbox({ url: u })} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'cell', vid: v.id, m: sheet.m, vname: v.name })}>
            ＋ 사진·영상 추가
          </button>
          <button className="pvg-manage" onClick={() => requireAdmin({ mode: 'guide', vid: v.id, m: sheet.m, vname: v.name, guideRow })}>
            이 시기 가이드 {guideRow?.detail ? '고치기' : '쓰기'}
          </button>
        </>
      );
    } else {
      const c = v.cluster_spec || {};
      inner = (
        <>
          <div className="pvg-shead">
            <div>
              <div className="t">{v.name}</div>
              <div className="s">송이관리 가이드 · 2024 기준</div>
            </div>
            <button className="x" onClick={() => setSheet(null)}>✕</button>
          </div>
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
        <div className="pvg-lightbox" onClick={() => setLightbox(null)}>
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
          <button className="lbx" onClick={() => setLightbox(null)} aria-label="닫기">✕</button>
          <div className="lbhint">두 손가락으로 확대 · 두 번 톡 확대/축소 · 바깥/✕ 닫기</div>
          {lightbox.vid && (
            <button
              className="lbmore"
              onClick={(e) => {
                e.stopPropagation();
                const t = { type: 'cell', vid: lightbox.vid, m: lightbox.m };
                setLightbox(null);
                setSheet(t);
              }}
            >
              이 시기 자세히 · 사진·가이드 ›
            </button>
          )}
        </div>
      )}

      {toast && <div className="pvg-toast">{toast}</div>}
    </div>,
    document.body
  );
}
