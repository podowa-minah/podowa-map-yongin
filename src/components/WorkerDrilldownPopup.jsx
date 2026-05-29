// src/components/WorkerDrilldownPopup.jsx
// 작업자 클릭 → 그날 작업한 나무들 상세 (시간순)
// 각 나무 클릭 → 그 나무 모달로 이동

import ReactDOM from 'react-dom';
import { useMemo } from 'react';
import { calcTreeScore, scoreBand } from '../lib/scoring';

const SEASON_NAMES = {
  1: '맹아기', 2: '4-5엽기', 3: '개화기', 4: '착과기',
  5: '경핵기', 6: '성숙기', 7: '수확기',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function WorkerDrilldownPopup({
  workerName,
  date,
  treeData = {},
  labels = {},
  onClose,
  onTreeClick,
}) {
  const records = useMemo(() => {
    const out = [];
    for (const treeId of Object.keys(treeData)) {
      for (const r of treeData[treeId] || []) {
        if (r.date === date && r.producer === workerName) {
          out.push({ ...r, treeId });
        }
      }
    }
    return out.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [treeData, date, workerName]);

  const totalCount = records.length;
  const avgScore = useMemo(() => {
    const scores = records
      .map(r => calcTreeScore({ power: r.power, balance: r.balance, bugs: r.bugs }))
      .filter(s => s != null);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [records]);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 10001,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '4vh 1rem', overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px',
          maxWidth: '540px', width: '100%',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          fontFamily: '"Pretendard Variable", sans-serif',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '1rem 1.1rem 0.8rem',
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937', flex: 1 }}>
              {workerName}의 {date} 작업
            </h2>
            <button onClick={onClose} aria-label="닫기"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: '1px solid #e5e7eb', background: '#fff',
                color: '#6b7280', cursor: 'pointer', fontSize: '0.95rem',
              }}>✕</button>
          </div>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', fontSize: '0.82rem', color: '#6b7280' }}>
            <span><b style={{ color: '#1f2937' }}>{totalCount}</b>그루</span>
            {avgScore != null && (
              <>
                <span style={{ color: '#d1d5db' }}>·</span>
                <span>평균 점수 <b style={{ color: scoreBand(avgScore).color }}>{avgScore.toFixed(1)}</b></span>
              </>
            )}
          </div>
        </div>

        {/* 나무 리스트 */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0.5rem 0.5rem 1rem' }}>
          {records.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', textAlign: 'center', padding: '1.5rem' }}>
              이 날 기록이 없어요.
            </p>
          ) : (
            records.map((r, idx) => {
              const score = calcTreeScore({ power: r.power, balance: r.balance, bugs: r.bugs });
              const band = score != null ? scoreBand(score) : null;
              const labelName = labels[`Tree-${r.treeId}`]?.name || '';
              const seasonLabel = r.season ? SEASON_NAMES[r.season] || '' : '';
              return (
                <button
                  key={`${r.treeId}-${r.id || idx}`}
                  onClick={() => {
                    onTreeClick?.(`Tree-${r.treeId}`);
                    onClose();
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.7rem 0.85rem',
                    margin: '0.3rem 0.4rem',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 700, minWidth: '36px' }}>
                      {formatTime(r.created_at)}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1f2937' }}>
                      {r.treeId}
                    </span>
                    {labelName && (
                      <span style={{ fontSize: '0.85rem', color: '#374151' }}>
                        {labelName}
                      </span>
                    )}
                    {seasonLabel && (
                      <span style={{
                        fontSize: '0.7rem', padding: '1px 6px',
                        background: '#f3f4f6', color: '#6b7280',
                        borderRadius: '3px',
                      }}>{seasonLabel}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>
                      →
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    fontSize: '0.76rem', color: '#6b7280',
                    paddingLeft: '40px',
                  }}>
                    {r.power != null && <span>세력 <b style={{ color: '#374151' }}>{r.power}</b></span>}
                    {r.balance != null && <span>균형 <b style={{ color: '#374151' }}>{r.balance}</b></span>}
                    {r.bugs != null && <span>해충 <b style={{ color: '#374151' }}>{r.bugs}</b></span>}
                    {band && score != null && (
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: band.color }}>
                        {score.toFixed(1)}점 · {band.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 하단 안내 */}
        {records.length > 0 && (
          <div style={{
            padding: '0.55rem',
            borderTop: '1px solid #f3f4f6',
            fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center',
            background: '#fafafa',
          }}>
            💡 나무 클릭 → 그 나무 페이지로 이동
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
