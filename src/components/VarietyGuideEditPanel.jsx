// src/components/VarietyGuideEditPanel.jsx
// 품종별 재배 가이드 — 편집 패널 (자체 저장·업로드 포함)
// 두 가지 모드:
//   variety  : 품종 추가/수정/삭제(soft, archived) + 송이관리 스펙(cluster_spec)
//   cell     : (품종 × 월) 칸에 사진·영상·가이드 한 장 추가 + 기존 장 삭제
// - 사진 업로드는 TreeModal과 동일한 tree-images 버킷 + createThumbnail 재사용.
// - 셸 스타일(pvg-scrim/sheet/shead/manage)은 부모 모달의 <style>를 그대로 사용.
// - 저장 끝나면 onSaved()로 부모에게 "다시 불러와" 신호만 보낸다.

import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { createThumbnail } from '../utils/imageThumbnail';
import { stageOfMonth, mdLabel } from '../lib/variety-guide';

const CSS = `
.pvge-body{padding:12px 16px 4px;}
.pvge-f{margin-bottom:12px;}
.pvge-f>label{display:block; font-size:12px; font-weight:800; color:#5b5446; margin-bottom:5px;}
.pvge-in,.pvge-ta{width:100%; font:inherit; font-size:14px; color:#3a382f; background:#fff; border:1px solid #e0d8c6; border-radius:10px; padding:9px 11px;}
.pvge-ta{min-height:70px; resize:vertical; line-height:1.45;}
.pvge-row2{display:flex; gap:8px;}
.pvge-row2>.pvge-f{flex:1;}
.pvge-ox{display:flex; gap:5px;}
.pvge-ox button{flex:1; font:inherit; font-size:13px; font-weight:800; padding:8px 0; border-radius:9px; border:1px solid #e0d8c6; background:#fff; color:#a39a88; cursor:pointer;}
.pvge-ox button.on{background:#2f6b3c; color:#fff; border-color:#2f6b3c;}
.pvge-grp{font-size:11px; font-weight:800; color:#8a6d2a; margin:16px 0 7px; letter-spacing:.2px;}
.pvge-thumbs{display:flex; gap:7px; flex-wrap:wrap; margin-top:6px;}
.pvge-thumb{position:relative; width:74px; height:74px; border-radius:10px; overflow:hidden; border:1px solid #e0d8c6;}
.pvge-thumb img{width:100%; height:100%; object-fit:cover;}
.pvge-thumb .rm{position:absolute; top:2px; right:2px; width:20px; height:20px; border-radius:50%; border:none; background:rgba(0,0,0,.6); color:#fff; font-size:12px; line-height:1; cursor:pointer; padding:0;}
.pvge-add{display:inline-flex; align-items:center; justify-content:center; width:74px; height:74px; border-radius:10px; border:1.5px dashed #cdbf9e; background:#fff; color:#8a6d2a; font-size:24px; cursor:pointer;}
.pvge-add input{display:none;}
.pvge-vadd{display:flex; align-items:center; justify-content:center; width:100%; padding:13px; border:1.5px dashed #cdbf9e; background:#fff; color:#8a6d2a; font-weight:800; font-size:13px; border-radius:11px; cursor:pointer;}
.pvge-vadd.busy{opacity:.6;}
.pvge-vadd input{display:none;}
.pvge-vid{position:relative;}
.pvge-vid video{width:100%; border-radius:11px; background:#000; display:block;}
.pvge-vid .rm{position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; border:none; background:rgba(0,0,0,.6); color:#fff; font-size:13px; line-height:1; cursor:pointer; padding:0;}
.pvge-entry{display:flex; gap:9px; align-items:center; background:#fff; border:1px solid #ece6d8; border-radius:11px; padding:8px; margin-bottom:7px;}
.pvge-entry .th{width:46px; height:46px; border-radius:8px; object-fit:cover; flex:0 0 auto; background:#efe8da;}
.pvge-entry .meta{flex:1; min-width:0;}
.pvge-entry .meta .et{font-size:13px; font-weight:800; color:#3a382f; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.pvge-entry .meta .ed{font-size:11px; color:#8a8472; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.pvge-entry .del{flex:0 0 auto; font:inherit; font-size:12px; font-weight:800; color:#b9532f; background:#fbede7; border:none; border-radius:8px; padding:7px 10px; cursor:pointer;}
.pvge-bar{display:flex; gap:8px; padding:10px 16px 4px;}
.pvge-bar .b{flex:1; font:inherit; font-size:15px; font-weight:800; padding:13px; border-radius:12px; border:none; cursor:pointer;}
.pvge-bar .save{background:#2f6b3c; color:#fff;}
.pvge-bar .cancel{background:#efe8da; color:#6b6456; flex:0 0 92px;}
.pvge-del{display:block; width:calc(100% - 32px); margin:4px 16px 0; padding:11px; border:1px solid #e7c3b6; background:#fff; color:#b9532f; font:inherit; font-size:13px; font-weight:800; border-radius:11px; cursor:pointer;}
.pvge-bar .b:disabled,.pvge-del:disabled{opacity:.55;}
`;

const OX_OPTS = [
  { v: 'O', label: '함' },
  { v: 'X', label: '안 함' },
  { v: '-', label: '해당없음' },
];

function OX({ value, onChange }) {
  const cur = value === 'O' || value === 'X' ? value : '-';
  return (
    <div className="pvge-ox">
      {OX_OPTS.map((o) => (
        <button key={o.v} type="button" className={cur === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function VarietyGuideEditPanel({ target, existingEntries = [], nextVarietySort = 0, nextGuideSort = 0, onClose, onSaved }) {
  const isCell = target.mode === 'cell';
  const isGuide = target.mode === 'guide';
  const isNew = target.mode === 'newVariety';
  const v = target.v || null;

  // ── 품종 폼 상태 ──
  const c0 = (v && v.cluster_spec) || {};
  const [name, setName] = useState(v?.name || '');
  const [subtype, setSubtype] = useState(v?.subtype || '');
  const [cs, setCs] = useState({
    b7: c0.b7 || '', s: c0.s || '-', u: c0.u || '-', t: c0.t || '-',
    lf1: c0.lf1 || '', lf2: c0.lf2 || '', sz: c0.sz || '', sa: c0.sa || '-', ta: c0.ta || '-',
  });

  // ── 칸 폼 상태 ──
  const [title, setTitle] = useState('');                            // 사진 한 줄 메모
  const [detail, setDetail] = useState(target.guideRow?.detail || ''); // 이 시기 가이드(하나)
  const [video, setVideo] = useState(null);   // {url} | null — 직접 촬영/업로드
  const [vidBusy, setVidBusy] = useState(false);
  const [imgs, setImgs] = useState([]);       // {url, thumb}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setC = (k, val) => setCs((p) => ({ ...p, [k]: val }));

  // ── 사진 업로드 (tree-images 버킷 재사용) ──
  async function onPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      for (const file of files) {
        if (imgs.length >= 5) break;
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fileName = `variety/${stamp}.jpg`;
        const { error: upErr } = await supabase.storage.from('tree-images').upload(fileName, file);
        if (upErr) { setErr('사진 업로드 실패: ' + upErr.message); continue; }
        const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);
        let thumb = '';
        const tb = await createThumbnail(file);
        if (tb) {
          const tName = `thumb/${fileName}`;
          const { error: tErr } = await supabase.storage.from('tree-images').upload(tName, tb);
          if (!tErr) thumb = supabase.storage.from('tree-images').getPublicUrl(tName).data?.publicUrl || '';
        }
        setImgs((prev) => [...prev, { url: urlData.publicUrl, thumb: thumb || urlData.publicUrl }]);
      }
    } finally {
      setBusy(false);
    }
  }
  function rmImg(i) { setImgs((prev) => prev.filter((_, idx) => idx !== i)); }

  // ── 영상 업로드 (촬영/갤러리 → tree-images 버킷) ──
  async function onPickVideo(e) {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    setVidBusy(true); setErr('');
    try {
      const ext = ((file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'mp4';
      const fileName = `variety/vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('tree-images')
        .upload(fileName, file, { contentType: file.type || 'video/mp4' });
      if (upErr) { setErr('영상 업로드 실패: ' + upErr.message); return; }
      const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);
      setVideo({ url: urlData.publicUrl });
    } finally {
      setVidBusy(false);
    }
  }

  // ── 저장 ──
  async function saveVariety() {
    const nm = name.trim();
    if (!nm) { setErr('품종 이름을 입력하세요'); return; }
    setBusy(true); setErr('');
    const cluster_spec = {
      b7: cs.b7.trim(), s: cs.s, u: cs.u, t: cs.t,
      lf1: cs.lf1.trim(), lf2: cs.lf2.trim(), sz: cs.sz.trim(), sa: cs.sa, ta: cs.ta,
    };
    let res;
    if (isNew) {
      res = await supabase.from('varieties').insert({
        name: nm, subtype: subtype.trim() || null, cluster_spec, sort_order: nextVarietySort,
      });
    } else {
      res = await supabase.from('varieties').update({
        name: nm, subtype: subtype.trim() || null, cluster_spec, updated_at: new Date().toISOString(),
      }).eq('id', v.id);
    }
    setBusy(false);
    if (res.error) { setErr('저장 실패: ' + res.error.message); return; }
    onSaved();
  }

  async function deleteVariety() {
    if (!v) return;
    if (!window.confirm(`'${v.name}' 품종을 목록에서 숨길까요?\n(기록은 보관됩니다)`)) return;
    setBusy(true); setErr('');
    const res = await supabase.from('varieties')
      .update({ archived: true, updated_at: new Date().toISOString() }).eq('id', v.id);
    setBusy(false);
    if (res.error) { setErr('삭제 실패: ' + res.error.message); return; }
    onSaved();
  }

  // 사진·영상 한 묶음 추가 — 날짜는 created_at 자동. detail(가이드)은 여기서 안 씀.
  async function saveCell() {
    if (!imgs.length && !video) {
      setErr('사진이나 영상을 넣어주세요'); return;
    }
    setBusy(true); setErr('');
    const res = await supabase.from('variety_guides').insert({
      variety_id: target.vid,
      month: target.m,
      title: title.trim() || null,
      detail: null,
      image_urls: imgs.map((x) => x.url),
      thumbnails: imgs.map((x) => x.thumb),
      video_url: video?.url || null,
      sort_order: nextGuideSort,
    });
    setBusy(false);
    if (res.error) { setErr('저장 실패: ' + res.error.message); return; }
    onSaved();
  }

  // 이 시기 가이드(그 달에 하나) — 있으면 덮어쓰기, 없으면 새로. 사진 없는 글-전용 행.
  async function saveGuide() {
    setBusy(true); setErr('');
    const text = detail.trim();
    let res;
    if (target.guideRow?.id) {
      res = await supabase.from('variety_guides').update({ detail: text || null }).eq('id', target.guideRow.id);
    } else if (text) {
      res = await supabase.from('variety_guides').insert({
        variety_id: target.vid, month: target.m,
        title: null, detail: text,
        image_urls: [], thumbnails: [], video_url: null, sort_order: 0,
      });
    } else {
      setBusy(false); onSaved(); return;   // 쓸 내용 없고 기존도 없으면 그냥 닫기
    }
    setBusy(false);
    if (res.error) { setErr('저장 실패: ' + res.error.message); return; }
    onSaved();
  }

  async function deleteEntry(entry) {
    if (!window.confirm('이 사진/가이드 한 장을 지울까요? (되돌릴 수 없어요)')) return;
    setBusy(true); setErr('');
    // 스토리지 파일도 같이 정리 (tree-images 안 variety/ 경로만)
    const paths = [];
    for (const u of [...(entry.image_urls || []), ...(entry.thumbnails || []), entry.video_url].filter(Boolean)) {
      const m = String(u).match(/tree-images\/(.+)$/);
      if (m && m[1].startsWith('variety/')) { paths.push(m[1]); paths.push(`thumb/${m[1]}`); }
      else if (m && m[1].startsWith('thumb/variety/')) paths.push(m[1]);
    }
    if (paths.length) await supabase.storage.from('tree-images').remove(paths).catch(() => {});
    const res = await supabase.from('variety_guides').delete().eq('id', entry.id);
    setBusy(false);
    if (res.error) { setErr('삭제 실패: ' + res.error.message); return; }
    onSaved();
  }

  // ── 헤더 ──
  const stage = (isCell || isGuide) ? stageOfMonth(target.m) : null;
  const headTitle = isCell ? `${target.vname} · ${target.m}월 사진·영상`
    : isGuide ? `${target.vname} · ${target.m}월 가이드`
    : isNew ? '새 품종 추가' : `${v.name} 수정`;
  const headSub = isCell ? `${stage?.stage || ''} — 날짜 자동`
    : isGuide ? `${stage?.stage || ''} — 이 시기 설명 (하나)`
    : '품종 · 송이관리';

  return (
    <div className="pvg-scrim" onClick={onClose}>
      <style>{CSS}</style>
      <div className="pvg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pvg-shead">
          <div>
            <div className="t">{headTitle}</div>
            <div className="s">{headSub}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {isCell ? (
          <div className="pvge-body">
            {existingEntries.length > 0 && (
              <>
                <div className="pvge-grp">이미 올린 것</div>
                {existingEntries.map((e) => (
                  <div className="pvge-entry" key={e.id}>
                    {(e.thumbnails?.[0] || e.image_urls?.[0]) && <img className="th" src={e.thumbnails?.[0] || e.image_urls?.[0]} alt="" />}
                    <div className="meta">
                      <div className="et">{mdLabel(e.created_at)}{e.title ? ' · ' + e.title : ''}</div>
                      <div className="ed">{`사진 ${(e.image_urls || []).length}장${e.video_url ? ' · 영상' : ''}`}</div>
                    </div>
                    <button className="del" onClick={() => deleteEntry(e)} disabled={busy}>삭제</button>
                  </div>
                ))}
              </>
            )}

            <div className="pvge-grp">새로 추가</div>
            <div className="pvge-f">
              <label>사진 (최대 5장)</label>
              <div className="pvge-thumbs">
                {imgs.map((im, i) => (
                  <div className="pvge-thumb" key={i}>
                    <img src={im.thumb} alt="" />
                    <button className="rm" onClick={() => rmImg(i)} aria-label="빼기">✕</button>
                  </div>
                ))}
                {imgs.length < 5 && (
                  <label className="pvge-add">
                    +
                    <input type="file" accept="image/*" multiple onChange={onPick} />
                  </label>
                )}
              </div>
            </div>
            <div className="pvge-f">
              <label>영상 (선택 · 촬영 또는 갤러리)</label>
              {video ? (
                <div className="pvge-vid">
                  <video src={video.url} controls playsInline />
                  <button className="rm" onClick={() => setVideo(null)} aria-label="영상 빼기" disabled={busy}>✕</button>
                </div>
              ) : (
                <label className={'pvge-vadd' + (vidBusy ? ' busy' : '')}>
                  {vidBusy ? '올리는 중…' : '＋ 영상 추가 (촬영 / 갤러리)'}
                  <input type="file" accept="video/*" onChange={onPickVideo} disabled={vidBusy} />
                </label>
              )}
            </div>
            <div className="pvge-f">
              <label>한 줄 메모 (선택)</label>
              <input className="pvge-in" value={title} placeholder="예: 어깨송이 정리 후" onChange={(e) => setTitle(e.target.value)} />
            </div>
            <p style={{ fontSize: 11, color: '#a39a88', margin: '0 0 8px' }}>＊ 찍은 날짜는 자동으로 사진 밑에 들어가요. 시기 전체 설명은 아래 ‘이 시기 가이드’에서.</p>
            {err && <div style={{ color: '#b9532f', fontSize: 12, fontWeight: 700, padding: '0 0 8px' }}>{err}</div>}
            <div className="pvge-bar">
              <button className="b cancel" onClick={onClose} disabled={busy || vidBusy}>취소</button>
              <button className="b save" onClick={saveCell} disabled={busy || vidBusy}>{busy ? '저장 중…' : '추가'}</button>
            </div>
          </div>
        ) : isGuide ? (
          <div className="pvge-body">
            <div className="pvge-f">
              <label>이 시기에 무엇을 어떻게 (이 달에 하나)</label>
              <textarea
                className="pvge-ta" style={{ minHeight: 150 }} value={detail}
                placeholder={`예: ${target.m}월엔 …`}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>
            <p style={{ fontSize: 11, color: '#a39a88', margin: '0 0 8px' }}>＊ 이 글은 그 달에 하나만 있어요. 고치면 덮어써져요(쌓이지 않음).</p>
            {err && <div style={{ color: '#b9532f', fontSize: 12, fontWeight: 700, padding: '0 0 8px' }}>{err}</div>}
            <div className="pvge-bar">
              <button className="b cancel" onClick={onClose} disabled={busy}>취소</button>
              <button className="b save" onClick={saveGuide} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        ) : (
          <div className="pvge-body">
            <div className="pvge-row2">
              <div className="pvge-f">
                <label>품종 이름</label>
                <input className="pvge-in" value={name} placeholder="예: 샤인머스캣" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="pvge-f" style={{ flex: '0 0 110px' }}>
                <label>만생도 (선택)</label>
                <input className="pvge-in" value={subtype} placeholder="중·만생" onChange={(e) => setSubtype(e.target.value)} />
              </div>
            </div>

            <div className="pvge-grp">개화 7일 전</div>
            <div className="pvge-f">
              <label>가이드</label>
              <textarea className="pvge-ta" value={cs.b7} placeholder="예: 세력 강하게" onChange={(e) => setC('b7', e.target.value)} />
            </div>

            <div className="pvge-grp">개화 2~3일 전</div>
            <div className="pvge-f"><label>어깨송이 제거</label><OX value={cs.s} onChange={(x) => setC('s', x)} /></div>
            <div className="pvge-f"><label>윗지경 제거</label><OX value={cs.u} onChange={(x) => setC('u', x)} /></div>
            <div className="pvge-f"><label>송이끝단 제거</label><OX value={cs.t} onChange={(x) => setC('t', x)} /></div>
            <div className="pvge-row2">
              <div className="pvge-f"><label>잎수 · 1송이</label><input className="pvge-in" value={cs.lf1} placeholder="8잎" onChange={(e) => setC('lf1', e.target.value)} /></div>
              <div className="pvge-f"><label>잎수 · 2송이</label><input className="pvge-in" value={cs.lf2} placeholder="10잎" onChange={(e) => setC('lf2', e.target.value)} /></div>
            </div>

            <div className="pvge-grp">착과 후</div>
            <div className="pvge-f"><label>크기 (선택)</label><input className="pvge-in" value={cs.sz} placeholder="12cm" onChange={(e) => setC('sz', e.target.value)} /></div>
            <div className="pvge-f"><label>어깨송이 제거</label><OX value={cs.sa} onChange={(x) => setC('sa', x)} /></div>
            <div className="pvge-f"><label>송이끝단 제거</label><OX value={cs.ta} onChange={(x) => setC('ta', x)} /></div>

            {err && <div style={{ color: '#b9532f', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>{err}</div>}
            <div className="pvge-bar">
              <button className="b cancel" onClick={onClose} disabled={busy}>취소</button>
              <button className="b save" onClick={saveVariety} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
            </div>
            {!isNew && (
              <button className="pvge-del" onClick={deleteVariety} disabled={busy}>이 품종 숨기기 (목록에서 제거)</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
