// src/components/ManualMissionCard.jsx
// 메인 화면 진입 카드 — "📊 이번 달 포도 미션 N%". 누르면 미션 모달이 열린다.
// 달성률은 저장하지 않고 manual_items + manual_completions에서 계산(CLAUDE.md §10).

import { useEffect, useState, Suspense, lazy } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { logsByItem, monthProgress } from '../lib/manual';

const ManualMissionModal = lazy(() => import('./ManualMissionModal'));

export default function ManualMissionCard({ user }) {
  const month = parseInt(todayKST().split('-')[1], 10);
  const [prog, setProg] = useState(null);     // {done,total,pct} | null
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: its } = await supabase
        .from('manual_items').select('id').eq('month', month).eq('archived', false);
      const ids = (its || []).map((i) => i.id);
      if (!ids.length) { if (alive) setProg({ done: 0, total: 0, pct: 0 }); return; }
      const { data: comps } = await supabase
        .from('manual_completions').select('item_id,author,done_on').in('item_id', ids);
      if (!alive) return;
      setProg(monthProgress(its, logsByItem(comps || [])));
    })();
    return () => { alive = false; };
  }, [month, refresh]);

  const pct = prog ? prog.pct : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`이달의 포도 미션 ${month}월 ${prog ? pct + '%' : ''}`}
        style={{
          position: 'fixed', right: '12px', bottom: '100px', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 0.7rem 0.45rem 0.6rem',
          background: '#ffffff',
          color: '#3a382f', border: '1px solid #e3dcc9', borderRadius: '999px', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(80,70,40,0.18)',
        }}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>📊</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5a5446', lineHeight: 1 }}>{month}월 미션</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2f6b3c', lineHeight: 1 }}>{prog ? `${pct}%` : '··'}</span>
      </button>

      {open && (
        <Suspense fallback={null}>
          <ManualMissionModal
            user={user}
            onClose={() => { setOpen(false); setRefresh((k) => k + 1); }}
            onSaved={() => setRefresh((k) => k + 1)}
          />
        </Suspense>
      )}
    </>
  );
}
