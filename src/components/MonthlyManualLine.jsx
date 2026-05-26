// src/components/MonthlyManualLine.jsx
// 헤더 아래 컴팩트 2행 × 3열 메뉴얼 위젯
//   Row 1: 💧 관수 ✏️    💊 방제 ✏️    ⚠️ 환경 ✏️
//   Row 2: 첫 줄 요약   첫 줄 요약    첫 줄 요약
// - 요약 호버하면 풀텍스트 툴팁 (title 속성)
// - ✏️ 클릭 → MonthlyManualEditModal (그 카테고리만 본문 편집)

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import MonthlyManualEditModal from './MonthlyManualEditModal';

const CATEGORIES = [
  { key: 'irrigation', icon: '💧', name: '관수', column: 'irrigation_note', color: '#0284c7' },
  { key: 'pest',       icon: '💊', name: '방제', column: 'pest_note',       color: '#d97706' },
  { key: 'env',        icon: '⚠️', name: '환경', column: 'env_note',        color: '#b91c1c' },
];

function firstLine(text) {
  if (!text) return null;
  return text.split('\n')[0].trim() || null;
}

export default function MonthlyManualLine({ refreshKey = 0 }) {
  const [row, setRow] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = todayKST();
      const [y, m] = today.split('-').map(Number);
      const { data } = await supabase
        .from('monthly_manuals')
        .select('*')
        .eq('year', y).eq('month', m)
        .maybeSingle();
      if (!alive) return;
      setRow(data || null);
    })();
    return () => { alive = false; };
  }, [refreshKey, localRefresh]);

  const today = todayKST();
  const [, m] = today.split('-').map(Number);

  return (
    <>
      <div style={{
        padding: '0.4rem 0.6rem',
        backgroundColor: '#faf7f0',
        borderTop: '1px solid #f0ebe0',
        borderBottom: '1px solid #f0ebe0',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.5rem',
        fontSize: '0.72rem',
      }}>
        {CATEGORIES.map((cat) => {
          const full = row?.[cat.column] || '';
          const summary = firstLine(full);
          return (
            <div
              key={cat.key}
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.15rem',
                minWidth: 0,  // grid 컬럼이 텍스트로 부풀지 않도록
              }}
            >
              {/* Row 1: 라벨 + 편집 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                fontWeight: 700, color: cat.color,
              }}>
                <span style={{ fontSize: '0.9rem' }}>{cat.icon}</span>
                <span>{m}월 {cat.name}</span>
                <button
                  onClick={() => setEditingCategory(cat.key)}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: 0, lineHeight: 1,
                    fontSize: '0.85rem', opacity: 0.7,
                  }}
                  title={summary ? '메뉴얼 편집' : '메뉴얼 추가'}
                >
                  ✏️
                </button>
              </div>
              {/* Row 2: 요약 (호버 시 풀텍스트) */}
              <div
                title={full || ''}
                onClick={() => setEditingCategory(cat.key)}
                style={{
                  color: summary ? '#4b5563' : '#cbd5e1',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  fontStyle: summary ? 'normal' : 'italic',
                }}
              >
                {summary || '(아직 메뉴얼 없음)'}
              </div>
            </div>
          );
        })}
      </div>

      {editingCategory && (
        <MonthlyManualEditModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => { setEditingCategory(null); setLocalRefresh(k => k + 1); }}
        />
      )}
    </>
  );
}
