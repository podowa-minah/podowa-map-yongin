// src/components/EnvCautionModal.jsx
// 환경 주의사항 입력/편집 모달 (이번 달 기준)
// 디자인: 포도와 톤 (크림 배경, 보라 액센트, LEGO 저장 버튼)

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';

export default function EnvCautionModal({ onClose, onSaved }) {
  const today = todayKST();
  const [y, m] = today.split('-').map(Number);

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('env_cautions')
        .select('*')
        .eq('year', y).eq('month', m)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setExisting(data);
        setNote(data.note || '');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [y, m]);

  async function handleSave() {
    setSaving(true);
    if (existing) {
      await supabase.from('env_cautions').update({ note }).eq('id', existing.id);
    } else if (note.trim()) {
      await supabase.from('env_cautions').insert({ year: y, month: m, note });
    }
    setSaving(false);
    onSaved?.();
  }

  async function handleDelete() {
    if (!existing) { onClose(); return; }
    if (!confirm('이번 달 주의사항을 삭제할까요?')) return;
    setSaving(true);
    await supabase.from('env_cautions').delete().eq('id', existing.id);
    setSaving(false);
    onSaved?.();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.2rem', borderRadius: '1.2rem',
          maxWidth: '460px', width: '92%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '2px solid #fde68a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{m}월 환경 주의사항</h2>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.7rem' }}>
          이번 달 농장에서 신경 쓸 점 (예: 폭염주간, 응애·총채 집중 연무기, 장마주간)
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="이번 달 주의사항을 적어주세요…"
          disabled={loading}
          style={{
            width: '100%', minHeight: '90px', padding: '0.7rem',
            borderRadius: '0.6rem', border: '1px solid #e2e8f0',
            backgroundColor: '#fafaf7', fontFamily: 'inherit', fontSize: '1rem',
            resize: 'vertical', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              backgroundColor: '#facc15',
              color: '#1f2937',
              padding: '0.85rem 1rem',
              border: '3px solid #ca8a04',
              borderRadius: '0.8rem',
              cursor: saving ? 'wait' : 'pointer',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 5px 0 rgba(133, 77, 14, 0.5)',
            }}
          >
            저장하기
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              backgroundColor: '#fff',
              color: '#6b7280',
              padding: '0.85rem 1.2rem',
              border: '2px solid #d1d5db',
              borderRadius: '0.8rem',
              cursor: 'pointer',
              fontSize: '1.05rem',
              fontWeight: 600,
            }}
          >
            취소
          </button>
        </div>

        {existing && (
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{
              marginTop: '0.7rem', width: '100%',
              backgroundColor: 'transparent', color: '#dc2626',
              padding: '0.5rem', border: 'none',
              cursor: 'pointer', fontSize: '0.85rem',
              textDecoration: 'underline',
            }}
          >
            이번 달 주의사항 삭제
          </button>
        )}
      </div>
    </div>
  );
}
