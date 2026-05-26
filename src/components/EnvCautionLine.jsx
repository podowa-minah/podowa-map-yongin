// src/components/EnvCautionLine.jsx
// 헤더 아래 얇은 한 줄 — 이번 달 환경 주의사항
// 메모 없으면 아예 안 보임 (공간 안 차지)

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';

export default function EnvCautionLine({ refreshKey = 0 }) {
  const [note, setNote] = useState(null);

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
  }, [refreshKey]);

  if (!note) return null;

  const today = todayKST();
  const [, m] = today.split('-').map(Number);

  return (
    <div style={{
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
    }}>
      <span>⚠️</span>
      <span style={{ fontWeight: 700 }}>{m}월:</span>
      <span>{note}</span>
    </div>
  );
}
