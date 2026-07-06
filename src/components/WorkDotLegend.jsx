// src/components/WorkDotLegend.jsx
// 나무 우측상단 '오늘 입력 점' 범례 — 작업 히스토리에 표시(HistoryPopup은 보호파일이라 여기 분리).
//   색은 지도(FarmMap)의 점과 똑같이 맞춤: 잘못돌봄(주황)·정돌봄(초록)·추가돌봄(파랑).
//   헤더에서 점 표시를 뺀 대신, 그 뜻을 여기서 설명한다.
const ITEMS = [
  { c: '#f97316', name: '잘못돌봄', desc: '켜진 걸 빠뜨리고 다른 것만 — 다시 확인' },
  { c: '#10b981', name: '정돌봄', desc: '켜진 걸 제대로 돌봄' },
  { c: '#667eea', name: '추가돌봄', desc: '안 켜졌는데 한 번 더 돌봄' },
];

export default function WorkDotLegend() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.35rem',
      padding: '0.6rem 0.75rem', marginBottom: '0.9rem',
      background: '#f6f8f4', border: '1px solid #e4ebe0', borderRadius: '0.6rem',
    }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#4b5563' }}>나무 점 색깔이란?</div>
      {ITEMS.map((it) => (
        <span key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: it.c, flexShrink: 0 }} />
          <b style={{ color: '#1f2937', fontWeight: 700 }}>{it.name}</b>
          <span style={{ color: '#6b7280' }}>— {it.desc}</span>
        </span>
      ))}
    </div>
  );
}
