// src/components/PestMapOverlay.jsx
// 병해충 지도 모드 오버레이 — 맵 위 상단. 감염 막대 + 큰 % + 칩 + 색 범례 + 🎨.
//   · 통계 블록은 하나 — 칩 고르면 그 벌레, 안 고르면 밭 1순위. (두 줄로 나뉘어 있던 걸 합침, 가독성)
//   · 색은 벌레/병마다 다름(대표색), 진하기 = 점수. 범례로 바로 알 수 있게.
//   · 데이터는 pestDistribution 결과(dist)만 받아서 표시 (§10: 계산은 lib, 여기선 보여주기만).
import { colorOf, pestShade } from '../lib/pest-colors';

export default function PestMapOverlay({ dist, selected = '__ALL__', onSelect, colors = {}, onOpenColors }) {
  const list = dist?.list || [];
  const total = dist?.total || 0;
  const worst = dist?.worst || null;
  const sel = selected !== '__ALL__' ? list.find((x) => x.name === selected) : null;

  const show = sel || worst;          // 고른 게 있으면 그거, 없으면 밭 1순위
  const isTop = !sel && !!worst;
  const c = show ? colorOf(show.name, colors) : '#9ca3af';

  const chipStyle = (active, color) => ({
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '0.4rem 0.7rem', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? `2px solid ${color || '#6b7280'}` : '1.5px solid #e2e8f0',
    background: '#fff',
    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
    fontSize: '0.85rem', fontWeight: active ? 800 : 600, color: '#374151',
  });

  const paletteBtn = {
    flex: '0 0 auto', border: '1.5px solid #e2e8f0', background: '#fff',
    borderRadius: 999, padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.9rem',
  };

  return (
    <div style={{
      position: 'absolute', top: 3, left: 6, right: 6, zIndex: 95,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(3px)',
      border: '1px solid #e7e0d0', borderRadius: '0.9rem',
      boxShadow: '0 6px 18px rgba(0,0,0,0.14)', padding: '0.6rem 0.7rem',
    }}>
      {show ? (
        <>
          {/* 이름 줄 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 800, color: '#fff', background: c,
              padding: '0.15rem 0.5rem', borderRadius: 999, flex: '0 0 auto',
            }}>{isTop ? '1순위' : '선택'}</span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1f2937' }}>{show.name}</span>
            <button onClick={onOpenColors} title="벌레/병 색 정하기" aria-label="벌레·병 색 정하기"
              style={{ ...paletteBtn, marginLeft: 'auto' }}>🎨</button>
          </div>

          {/* 감염 막대 + 큰 % */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.3rem' }}>
            <div style={{ flex: 1, height: 12, borderRadius: 999, background: '#efece5', overflow: 'hidden' }}>
              <div style={{ width: `${show.pct}%`, height: '100%', background: c, borderRadius: 999, transition: 'width 0.2s ease' }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: c, minWidth: 56, textAlign: 'right' }}>{show.pct}%</span>
          </div>

          {/* 작은 숫자들 */}
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
            감염 <b style={{ color: '#3a382f' }}>{show.count}</b> / 전체 {total}그루
            {' · '}평균 <b style={{ color: '#3a382f' }}>{show.avgScore}</b>점
            {' · '}최고 <b style={{ color: '#3a382f' }}>{show.maxScore}</b>점
          </div>
          {/* %가 뭘 뜻하는지 — 밭에서 헷갈리지 않게 */}
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginBottom: '0.6rem' }}>
            0%에 가까울수록 밭이 깨끗합니다
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontWeight: 700, color: '#16a34a' }}>밭이 깨끗해요 · 병해충 없음</span>
          <button onClick={onOpenColors} title="벌레/병 색 정하기" style={{ ...paletteBtn, marginLeft: 'auto' }}>🎨</button>
        </div>
      )}

      {/* 칩 — 벌레/병마다 자기 색 */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => onSelect?.('__ALL__')} style={chipStyle(selected === '__ALL__')}>전체</button>
        {list.map((it) => {
          const ic = colorOf(it.name, colors);
          return (
            <button key={it.name} onClick={() => onSelect?.(it.name)} style={chipStyle(selected === it.name, ic)}>
              {it.name}
              <span style={{
                minWidth: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: 999,
                background: ic, color: '#fff', fontSize: '0.7rem', fontWeight: 800,
              }}>{it.count}</span>
            </button>
          );
        })}
      </div>

      {/* 색 범례 + 안내 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.55rem', fontSize: '0.68rem', color: '#9ca3af' }}>
        <span>연함</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} style={{ width: 13, height: 10, borderRadius: 2, background: pestShade(c, n), flex: '0 0 auto' }} />
        ))}
        <span>진함 = 1~5점</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: sel ? '#7c3aed' : '#9ca3af', whiteSpace: 'nowrap' }}>
          {sel ? '나무 누르면 점수 톡톡' : '나무 누르면 차트'}
        </span>
      </div>
    </div>
  );
}
