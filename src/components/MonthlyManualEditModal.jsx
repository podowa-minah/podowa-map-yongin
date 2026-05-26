// src/components/MonthlyManualEditModal.jsx
// 월별 메뉴얼 한 카테고리 편집 모달
// - 카테고리: 'irrigation' | 'pest' | 'env'
// - 큰 textarea (긴 본문 입력 가능)
// - 저장: monthly_manuals 행 upsert

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';

const CATEGORY_INFO = {
  irrigation: { icon: '💧', name: '관수',  column: 'irrigation_note', border: '#7dd3fc', bg: '#f0f9ff' },
  pest:       { icon: '💊', name: '방제',  column: 'pest_note',       border: '#fcd34d', bg: '#fffbeb' },
  env:        { icon: '⚠️', name: '환경',  column: 'env_note',        border: '#fca5a5', bg: '#fef2f2' },
};

export default function MonthlyManualEditModal({ category, onClose, onSaved }) {
  const info = CATEGORY_INFO[category];
  const today = todayKST();
  const [y, m] = today.split('-').map(Number);

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingRow, setExistingRow] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('monthly_manuals')
        .select('*')
        .eq('year', y).eq('month', m)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setExistingRow(data);
        setNote(data[info.column] || '');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [y, m, info.column]);

  async function handleSave() {
    setSaving(true);
    const value = note.trim() || null;
    if (existingRow) {
      await supabase.from('monthly_manuals')
        .update({ [info.column]: value })
        .eq('id', existingRow.id);
    } else if (value !== null) {
      await supabase.from('monthly_manuals')
        .insert({ year: y, month: m, [info.column]: value });
    }
    setSaving(false);
    onSaved?.();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 0', zIndex: 999, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.2rem', borderRadius: '1.2rem',
          maxWidth: '540px', width: '92%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: `3px solid ${info.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.4rem' }}>{info.icon}</span>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{m}월 {info.name} 메뉴얼</h2>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.7rem' }}>
          이번 달 {info.name} 관련 메뉴얼/주의사항을 자세히 적어주세요. 길어도 됨.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`예시) ${m}월 ${info.name}에 대한 본인만의 메모...`}
          disabled={loading}
          style={{
            width: '100%', minHeight: '220px', padding: '0.8rem',
            borderRadius: '0.6rem', border: '1px solid #e2e8f0',
            backgroundColor: info.bg, fontFamily: 'inherit', fontSize: '1rem',
            resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
          }}
        />

        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.3rem 0 0.8rem' }}>
          💡 첫 줄이 헤더의 한 줄 요약으로 자동 표시됩니다
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              backgroundColor: '#facc15', color: '#1f2937',
              padding: '0.85rem 1rem',
              border: '3px solid #ca8a04', borderRadius: '0.8rem',
              cursor: saving ? 'wait' : 'pointer',
              fontSize: '1.05rem', fontWeight: 700,
              boxShadow: '0 5px 0 rgba(133, 77, 14, 0.5)',
            }}
          >
            저장하기
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              backgroundColor: '#fff', color: '#6b7280',
              padding: '0.85rem 1.2rem',
              border: '2px solid #d1d5db', borderRadius: '0.8rem',
              cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600,
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
