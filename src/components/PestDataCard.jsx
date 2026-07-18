// src/components/PestDataCard.jsx
// 병해충 데이터 진입 — 병해충 지도일 때 맵 우하단 플로팅 (일반 모드의 '이달의 미션' 자리, minari 제안).
//   ManualMissionCard와 같은 플로팅 스타일 — 레이아웃 높이 0, 지도 안 가림.
import { useState } from 'react';
import PestDataPopup from './PestDataPopup';
import { colorOf } from '../lib/pest-colors';

export default function PestDataCard({ dist, colors = {}, treeData = {}, labels = {}, onOpenTree }) {
  const [open, setOpen] = useState(false);
  const worst = dist?.worst || null;
  const c = worst ? colorOf(worst.name, colors) : '#9ca3af';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`병해충 데이터 ${worst ? `${worst.name} ${worst.pct}% 감염` : '깨끗'}`}
        style={{
          position: 'fixed', right: '12px', bottom: '100px', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 0.7rem 0.45rem 0.6rem',
          background: '#ffffff',
          color: '#3a382f', border: '1px solid #e3dcc9', borderRadius: '999px', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(80,70,40,0.18)',
        }}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>🔬</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>병해충 데이터</span>
        {worst && (
          <span style={{
            background: c, color: '#fff', borderRadius: 999,
            padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 800,
          }}>{worst.pct}%</span>
        )}
      </button>

      {open && (
        <PestDataPopup
          dist={dist} colors={colors} treeData={treeData} labels={labels}
          onClose={() => setOpen(false)}
          onOpenTree={(id) => { setOpen(false); onOpenTree?.(id); }}
        />
      )}
    </>
  );
}
