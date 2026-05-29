// src/components/TabNav.jsx
// 상단 탭 네비게이션 — 밭지도 / 현황분석 / 점수기준

const TABS = [
  { key: 'map',      label: '밭지도' },
  { key: 'analysis', label: '현황분석' },
  { key: 'scores',   label: '점수기준' },
];

export default function TabNav({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #d6c8a8',
      background: '#fffefb',
      padding: '0 0.5rem',
      gap: '0.5rem',
    }}>
      {TABS.map(tab => {
        const on = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '0.75rem 1rem 0.65rem',
              background: 'transparent',
              border: 'none',
              borderBottom: on ? '3px solid #1f2937' : '3px solid transparent',
              color: on ? '#1f2937' : '#9ca3af',
              fontWeight: on ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
