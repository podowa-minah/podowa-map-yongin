// src/components/RemainingTreesPopup.jsx
// 헤더 '남은' 카운트다운에서 종류(세력/해충/시계)를 누르면 뜨는 목록.
//   그 종류가 아직 안 된 나무 번호+이름을 작은 상자 안에 담아 보여준다(스크롤 — 화면에 다 안 깔리게).
//   지도 카드 배경은 손대면 꺼지므로(헛돌봄이 안 보임) 여기서 번호로 콕 집어준다.
import ReactDOM from 'react-dom';

const CAT_LABEL = { power: '세력', bugs: '해충', clock: '시계' };
const CAT_COLOR = { power: '#2f6b3c', bugs: '#b42318', clock: '#a15e12' };

export default function RemainingTreesPopup({ category, trees = [], onClose }) {
  const label = CAT_LABEL[category] || '';
  const color = CAT_COLOR[category] || '#1f2937';

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 1rem 1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 430, width: '100%', maxHeight: '64vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.85rem 1rem 0.55rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <b style={{ fontSize: '1rem', color: '#1f2937' }}>{label} 남은 나무</b>
          <span style={{ color, fontWeight: 800 }}>{trees.length}</span>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%',
              border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
              cursor: 'pointer', fontSize: '0.95rem', flexShrink: 0,
            }}
          >✕</button>
        </div>
        <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.76rem', color: '#6b7280' }}>
          {label} 신호 켜졌는데 오늘 {label} 아직 안 넣은 나무예요.
        </div>
        <div style={{ overflowY: 'auto', padding: '0.2rem 0.8rem 1rem' }}>
          {trees.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '1rem' }}>없어요 👍</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
              {trees.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 6,
                    padding: '0.4rem 0.6rem', background: '#f7f8f6',
                    border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 0,
                  }}
                >
                  <b style={{ color, fontWeight: 800, fontSize: '0.86rem', flexShrink: 0 }}>{t.id}</b>
                  <span style={{ color: '#4b5563', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
