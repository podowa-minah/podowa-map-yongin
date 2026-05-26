// src/components/EnvCautionLine.jsx
// 헤더 아래 얇은 한 줄 — 이번 달 환경 주의사항
// - 메모 있으면 표시 (클릭하면 편집)
// - 메모 없으면 작은 "+ 이번 달 주의사항" 버튼 표시

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import EnvCautionModal from './EnvCautionModal';

export default function EnvCautionLine({ refreshKey = 0 }) {
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = todayKST();
      const [y, m] = today.split('-').map(Number);
      const { data } = await supabase
        .from('env_cautions')
        .select('note')
        .eq('year', y)
        .eq('month', m)
        .maybeSingle();
      if (!alive) return;
      setNote(data?.note || null);
    })();
    return () => { alive = false; };
  }, [refreshKey, localRefresh]);

  const today = todayKST();
  const [, m] = today.split('-').map(Number);

  return (
    <>
      {note ? (
        <div
          onClick={() => setEditing(true)}
          style={{
            padding: '0.25rem 0.7rem',
            backgroundColor: '#fef3c7',
            borderTop: '1px solid #fde68a',
            borderBottom: '1px solid #fde68a',
            fontSize: '0.7rem',
            color: '#7c2d12',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            lineHeight: 1.3,
            cursor: 'pointer',
          }}
        >
          <span>⚠️</span>
          <span style={{ fontWeight: 700 }}>{m}월:</span>
          <span style={{ flex: 1 }}>{note}</span>
          <span style={{ color: '#a16207', fontSize: '0.65rem' }}>편집 ✏️</span>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            padding: '0.2rem 0.7rem',
            backgroundColor: '#faf7f0',
            borderTop: '1px solid #f0ebe0',
            fontSize: '0.7rem',
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            cursor: 'pointer',
          }}
        >
          <span>+ {m}월 환경 주의사항 추가</span>
        </div>
      )}

      {editing && (
        <EnvCautionModal
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setLocalRefresh(k => k + 1); }}
        />
      )}
    </>
  );
}
