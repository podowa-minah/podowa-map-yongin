// src/components/WorkerStatsPopup.jsx
// 농부 캐릭터 클릭 시 오늘 작업자별 그루수 표시

import ReactDOM from 'react-dom';
import { useMemo } from 'react';
import farmerRestSVG from '../assets/icons/farmer_rest.svg';

function getKSTToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function WorkerStatsPopup({ treeData = {}, onClose }) {
  const workerStats = useMemo(() => {
    const today = getKSTToday();
    const counts = {};
    Object.values(treeData).forEach(records => {
      records.forEach(r => {
        if (r.date === today && r.producer) {
          counts[r.producer] = (counts[r.producer] || 0) + 1;
        }
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [treeData]);

  const total = workerStats.reduce((s, w) => s + w.count, 0);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.2rem',
          minWidth: '260px',
          maxWidth: '340px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px', right: '12px',
            background: 'none', border: 'none',
            fontSize: '1.2rem', cursor: 'pointer', color: '#888',
          }}
        >✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <img src={farmerRestSVG} alt="" style={{ width: '40px', height: '28px' }} />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>
            오늘의 작업일지
          </span>
        </div>

        {workerStats.length === 0 ? (
          <div style={{ fontSize: '0.9rem', color: '#888', padding: '0.5rem 0' }}>
            아직 오늘 기록이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {workerStats.map(({ name, count }) => (
              <div key={name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#374151' }}>{name}</span>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1f2937' }}>{count}그루</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '14px', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
          총 {total}그루 돌봄
        </div>
      </div>
    </div>,
    document.body
  );
}
