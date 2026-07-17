// src/components/PestMapOverlay.jsx
// 병해충 지도 모드 오버레이 — 맵 위 상단에 떠 있는 칩 + 1순위 배지 + 선택 통계.
//   · 칩 고르면 onSelect(name) → App이 지도 색 다시 계산(pestColorMap).
//   · 데이터는 pestDistribution 결과(dist)만 받아서 표시 (§10: 계산은 lib, 여기선 보여주기만).
import { PEST_MAP_COLORS } from '../lib/pest-distribution';

const sevColor = (s) => PEST_MAP_COLORS[s] || PEST_MAP_COLORS[1];

export default function PestMapOverlay({ dist, selected = '__ALL__', onSelect }) {
  const list = dist?.list || [];
  const total = dist?.total || 0;
  const worst = dist?.worst || null;
  const sel = selected !== '__ALL__' ? list.find((x) => x.name === selected) : null;

  const chipStyle = (active, color) => ({
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '0.4rem 0.7rem', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? `2px solid ${color || '#c0392b'}` : '1.5px solid #e2e8f0',
    background: '#fff',
    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
    fontSize: '0.85rem', fontWeight: active ? 800 : 600, color: '#374151',
  });

  return (
    <div style={{
      position: 'absolute', top: 3, left: 6, right: 6, zIndex: 95,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(3px)',
      border: '1px solid #e7e0d0', borderRadius: '0.9rem',
      boxShadow: '0 6px 18px rgba(0,0,0,0.14)', padding: '0.6rem 0.7rem',
    }}>
      {/* 1순위 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {worst ? (
          <>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: sevColor(worst.maxScore),
              padding: '0.15rem 0.5rem', borderRadius: 999,
            }}>1순위</span>
            <span style={{ fontWeight: 800, color: '#1f2937' }}>{worst.name}</span>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {worst.count}그루 / {total} · <b style={{ color: '#c0140f' }}>{worst.pct}% 감염</b> · 평균 {worst.avgScore}점
            </span>
          </>
        ) : (
          <span style={{ fontWeight: 700, color: '#16a34a' }}>밭이 깨끗해요 · 병해충 없음</span>
        )}
      </div>

      {/* 칩 스크롤 */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => onSelect?.('__ALL__')} style={chipStyle(selected === '__ALL__')}>전체</button>
        {list.map((it) => (
          <button key={it.name} onClick={() => onSelect?.(it.name)} style={chipStyle(selected === it.name, sevColor(it.maxScore))}>
            {it.name}
            <span style={{
              minWidth: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: 999,
              background: sevColor(it.maxScore), color: '#fff', fontSize: '0.7rem', fontWeight: 800,
            }}>{it.count}</span>
          </button>
        ))}
      </div>

      {/* 선택 통계 / 안내 */}
      {sel ? (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
          <b>{sel.name}</b> · {sel.count}그루 / {total} · <b style={{ color: '#c0140f' }}>{sel.pct}% 감염</b> · 평균 {sel.avgScore}점 · 최고 {sel.maxScore}점
        </div>
      ) : (
        worst && (
          <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: '#9ca3af' }}>
            색이 진할수록 심함 · 나무 누르면 그 나무 차트로
          </div>
        )
      )}
    </div>
  );
}
