// src/components/MonthlyStats.jsx
// 이번 달 요약 아래 "더보기" — 달별 평균 달성률 + 농부별 돌본 그루수(전체).
//   작업 히스토리(HistoryPopup은 보호파일)에 import해서 씀. summaries = daily_summaries(+오늘).
//   계산은 lib/historyStats(monthlyAverages, workerTotals) — 순수함수(§10).
import { useState } from 'react';
import { monthlyAverages, workerTotals } from '../lib/historyStats';

const pctColor = (avg) => (avg >= 90 ? '#16a34a' : avg >= 70 ? '#65a30d' : avg >= 50 ? '#ca8a04' : '#dc2626');

export default function MonthlyStats({ summaries = [] }) {
  const [open, setOpen] = useState(false);
  const months = open ? monthlyAverages(summaries) : [];
  const workers = open ? workerTotals(summaries) : [];

  return (
    <div style={{ marginTop: '0.6rem' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '0.45rem', border: '1px dashed #86efac',
          background: '#fff', color: '#15803d', fontSize: '0.75rem', fontWeight: 700,
          borderRadius: '0.5rem', cursor: 'pointer',
        }}
      >
        {open ? '접기 ▲' : '📈 달별·농부별 통계 더보기 ▾'}
      </button>

      {open && (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {/* 달별 평균 달성률 */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d', marginBottom: '0.35rem' }}>
              달별 평균 달성률
            </div>
            {months.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>아직 기록 없음</div>
            ) : months.map((m) => (
              <div key={`${m.year}-${m.month}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.22rem 0' }}>
                <span style={{ width: 62, fontSize: '0.78rem', color: '#4b5563', fontWeight: 600, flexShrink: 0 }}>{m.year}.{m.month}월</span>
                <div style={{ flex: 1, height: 7, background: '#eef2ee', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${m.avg}%`, height: '100%', background: pctColor(m.avg) }} />
                </div>
                <span style={{ width: 74, textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: pctColor(m.avg), flexShrink: 0 }}>
                  {m.avg}%<span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.66rem' }}> ·{m.days}일</span>
                </span>
              </div>
            ))}
          </div>

          {/* 농부별 돌본 그루수 (전체) */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.35rem' }}>
              농부별 돌본 그루수 <span style={{ color: '#9ca3af', fontWeight: 400 }}>(전체)</span>
            </div>
            {workers.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>아직 기록 없음</div>
            ) : workers.map((w, i) => (
              <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.22rem 0', fontSize: '0.8rem' }}>
                <span style={{ width: 18, color: '#9ca3af', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, color: '#1f2937', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                <span style={{ fontWeight: 700, color: '#0369a1', flexShrink: 0 }}>{w.count}그루</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
