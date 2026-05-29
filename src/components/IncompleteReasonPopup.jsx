// src/components/IncompleteReasonPopup.jsx
// 미달일 사유 입력 popup — 모든 미제출 사유 한 번에 입력
// daily_notes.type='incomplete_reason' 으로 저장
// 모두 제출되면 헤더 경고도 자동으로 사라짐

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';

export default function IncompleteReasonPopup({ missedDays = [], authorName, onClose, onSubmitted }) {
  const [reasons, setReasons] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 각 미달일에 빈 사유 초기화
    const init = {};
    for (const d of missedDays) init[d.date] = '';
    setReasons(init);
  }, [missedDays]);

  async function handleSubmitAll() {
    const filled = Object.entries(reasons).filter(([, v]) => v.trim().length > 0);
    if (filled.length === 0) {
      alert('하나라도 사유를 입력해주세요.');
      return;
    }
    setSaving(true);
    let successCount = 0;
    for (const [date, content] of filled) {
      const { error } = await supabase.from('daily_notes').insert({
        date,
        type: 'incomplete_reason',
        author: authorName || null,
        content: content.trim(),
      });
      if (!error) successCount += 1;
      else console.error('Save reason error:', error, date);
    }
    setSaving(false);
    onSubmitted?.(successCount);
    onClose();
  }

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 1rem', overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px',
          maxWidth: '520px', width: '100%',
          padding: '1.2rem 1.2rem 1.1rem',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
          border: '3px solid #fca5a5',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.4rem' }}>⚠️</span>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: 1, color: '#7f1d1d' }}>
            미달일 사유 입력
            <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 500, marginLeft: '0.4rem' }}>
              {missedDays.length}건
            </span>
          </h2>
          <button onClick={onClose} aria-label="닫기" style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid #e5e7eb', background: '#fff',
            color: '#6b7280', cursor: 'pointer', fontSize: '0.95rem',
          }}>✕</button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 0.9rem' }}>
          100% 달성 못 한 날의 이유를 적어주세요. 모두 입력되면 헤더 경고가 사라집니다.
        </p>

        {/* 미달일별 입력 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto' }}>
          {missedDays.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', textAlign: 'center', padding: '1rem' }}>
              미달일이 없어요! 👏
            </p>
          ) : (
            missedDays.map(d => {
              const pct = d.total > 0 ? Math.round(d.completed / d.total * 100) : 0;
              return (
                <div key={d.date} style={{
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  background: '#fff5f5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#7f1d1d' }}>
                      {d.date}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#9ca3af' }}>
                      {pct}% ({d.completed}/{d.total})
                    </span>
                  </div>
                  <textarea
                    value={reasons[d.date] || ''}
                    onChange={(e) => setReasons(prev => ({ ...prev, [d.date]: e.target.value }))}
                    placeholder="예시) 비가 너무 많이 와서 오전만 작업"
                    style={{
                      width: '100%', minHeight: '52px', padding: '0.55rem',
                      border: '1px solid #fca5a5', borderRadius: '0.35rem',
                      background: '#fff', fontFamily: 'inherit', fontSize: '0.88rem',
                      resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.4,
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 저장 */}
        <button
          onClick={handleSubmitAll}
          disabled={saving || missedDays.length === 0}
          style={{
            width: '100%', marginTop: '0.9rem',
            padding: '0.85rem',
            background: missedDays.length === 0 ? '#d1d5db' : 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff', border: 'none', borderRadius: '0.6rem',
            cursor: saving || missedDays.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem', fontWeight: 700,
          }}
        >
          {saving ? '저장 중...' : '입력한 사유 저장'}
        </button>
      </div>
    </div>,
    document.body
  );
}
