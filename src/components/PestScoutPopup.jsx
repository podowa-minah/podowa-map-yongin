// src/components/PestScoutPopup.jsx
// 예찰 톡톡 — 병해충 지도에서 벌레/병 칩을 고른 상태로 나무를 누르면 뜨는 빠른 점수 입력.
//   차트 안 열고 지도에서 톡·톡·톡 (예찰 20그루가 차트 20번 여는 게 아니게). minari 요청.
//   · 저장은 TreeModal과 같은 패턴(오늘 active row 있으면 update, 없으면 insert).
//   · season_data의 다른 키(알솎이 마커 등)는 그대로 두고 pests/diseases만 갱신.
//   · 벌레불(bugs)은 주벌레(깍지)만 — 예찰이 깍지면 같이 갱신, 부벌레면 안 건드림.
//   · trees는 realtime 구독이라 저장하면 지도 색이 알아서 바뀜.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { getKSTToday } from '../utils/dailyStats';
import { mainPestScore, readPests } from '../lib/pests';
import { readDiseases } from '../lib/diseases';
import { colorOf, pestShade } from '../lib/pest-colors';

export default function PestScoutPopup({
  treeId, pestName, kind = 'pest',
  treeData = {}, labels = {}, colors = {}, user, onClose,
}) {
  const [saving, setSaving] = useState(false);

  const numericId = String(treeId || '').replace('Tree-', '');
  const lbl = labels[`Tree-${numericId}`] || {};
  const title = lbl.name ? `${numericId} ${lbl.name}` : numericId;
  const today = getKSTToday();
  const recs = treeData[numericId] || [];
  const todayRec = recs.find((r) => r.date === today);

  // 농부진단 — 차트의 '농부진단'과 같은 칸(trees.comments). 오늘 쓴 게 있으면 그대로 불러와서 이어 씀.
  const [comment, setComment] = useState(todayRec?.comments || '');

  // 지금 점수 — 오늘 기록 우선, 없으면 가장 최근 기록
  const latest = todayRec || [...recs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const cur = kind === 'disease'
    ? readDiseases(latest?.season_data || {})[pestName]
    : readPests(latest?.season_data || {}, latest?.bugs)[pestName];
  const base = colorOf(pestName, colors);

  async function save(score) {
    if (saving) return;
    setSaving(true);

    const sd = { ...(todayRec?.season_data || {}) };
    const key = kind === 'disease' ? 'diseases' : 'pests';
    const nextOfKind = { ...(sd[key] || {}), [pestName]: score };
    sd[key] = nextOfKind;

    const nextPests = kind === 'disease' ? (sd.pests || {}) : nextOfKind;
    const main = mainPestScore(nextPests);   // 깍지만 벌레불로

    const row = {
      id: numericId,
      date: today,
      season_data: sd,
      bugs: main == null ? null : main,
      comments: comment,                                        // 농부진단 (차트와 같은 칸 → AI도 읽음)
      producer: user?.user_metadata?.nickname || user?.email || '',
    };

    const { data: existing, error: e1 } = await supabase
      .from('trees').select('row_id')
      .eq('id', numericId).eq('date', today).is('archived_at', null).maybeSingle();
    if (e1) { console.error('예찰 조회 실패:', e1.message); setSaving(false); return; }

    const { error } = existing
      ? await supabase.from('trees').update(row).eq('row_id', existing.row_id)
      : await supabase.from('trees').insert(row);
    if (error) console.error('예찰 저장 실패:', error.message);

    setSaving(false);
    onClose?.();
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '1rem', padding: '1rem',
          width: '100%', maxWidth: 340, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}
          >✕</button>
        </div>

        <div style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '0.7rem' }}>
          <b style={{ color: base }}>{pestName}</b> 몇 점?
          {cur != null && <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: 5 }}>(지금 {cur}점)</span>}
        </div>

        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[0, 1, 2, 3, 4, 5].map((n) => {
            const on = Number(cur) === n;
            const bg = n === 0 ? '#f3f4f6' : pestShade(base, n);
            return (
              <button
                key={n}
                disabled={saving}
                onClick={() => save(n)}
                style={{
                  flex: '1 1 0', minWidth: 0, padding: '0.9rem 0', fontSize: '1.2rem',
                  fontWeight: on ? 800 : 600, borderRadius: '0.7rem',
                  cursor: saving ? 'default' : 'pointer',
                  border: on ? `3px solid ${n === 0 ? '#6b7280' : base}` : '2px solid #e2e8f0',
                  background: bg,
                  color: n >= 3 ? '#fff' : '#1f2937',
                }}
              >{n}</button>
            );
          })}
        </div>

        {/* 농부진단 — 차트의 농부진단과 같은 칸. 점수 누르면 같이 저장됨 */}
        <div style={{ marginTop: '0.7rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 600 }}>
            농부진단 <span style={{ color: '#b9b3a6', fontWeight: 400 }}>(선택)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="예: 잎 뒷면에 많음. 4번 줄로 번지는 중"
            rows={2}
            style={{
              display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem',
              border: '1px solid #e2e8f0', borderRadius: '0.5rem',
              fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical',
              backgroundColor: '#fafaf7', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center' }}>
          {saving ? '저장 중…' : '점수 누르면 농부진단까지 같이 저장 · 0점 = 없음(잡힘)'}
        </div>
      </div>
    </div>,
    document.body
  );
}
