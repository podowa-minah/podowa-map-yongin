// src/components/IrrigationGroups.jsx
// 전체관수 입력 — 동+시간을 그룹으로 담기.
//   "1·2동 60분 / 3·4동 50분"처럼 동마다 시간이 다를 때: 동 고르고 시간 정한 뒤 담기 → 다음 동 반복.
//   순수 표시/입력만. 상태(groups·draftBlocks·draftMinutes)는 부모(IrrigationModal)가 들고 콜백만 호출.
//   한 번만 관수하면 담기 없이 바로 저장해도 됨(부모 handleSave가 현재 선택을 자동 포함).
const BLOCKS = ['1', '2', '3', '4'];

export default function IrrigationGroups({
  groups = [], draftBlocks = [], draftMinutes = 30,
  onToggleBlock, onDraftMinutes, onCommit, onRemoveGroup, loading = false,
}) {
  const canCommit = draftBlocks.length > 0;

  return (
    <div style={{ marginBottom: '0.9rem' }}>
      {/* 담은 그룹 (장바구니) */}
      {groups.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#0c4a6e', fontWeight: 700, marginBottom: '0.35rem' }}>
            🧺 담은 관수 {groups.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {groups.map((g, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 999,
                padding: '0.3rem 0.4rem 0.3rem 0.7rem', fontSize: '0.85rem', color: '#1e3a8a', fontWeight: 600,
              }}>
                {g.blocks.join('·')}동 {g.minutes}분
                <button onClick={() => onRemoveGroup(i)} aria-label="빼기" style={{
                  border: 'none', background: 'transparent', color: '#7c9cc4',
                  fontSize: '0.95rem', lineHeight: 1, cursor: 'pointer', padding: '0 2px',
                }}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 동 선택 (지금 담을 것) */}
      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
        동 선택 (다중){groups.length > 0 && <span style={{ fontWeight: 500, color: '#6b7280' }}> — 다음 동</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.7rem' }}>
        {BLOCKS.map((b) => {
          const on = draftBlocks.includes(b);
          return (
            <button
              key={b}
              onClick={() => onToggleBlock(b)}
              disabled={loading}
              style={{
                padding: '0.85rem 0',
                border: on ? '2px solid #0ea5e9' : '2px solid #d6c8a8',
                background: on ? 'linear-gradient(180deg, #bae6fd 0%, #7dd3fc 100%)' : '#fffefb',
                color: on ? '#0c4a6e' : '#6b7280',
                fontSize: '1rem', fontWeight: 700, borderRadius: '0.6rem', cursor: 'pointer',
                boxShadow: on ? '0 3px 0 #0284c7, 0 4px 8px rgba(14, 165, 233, 0.25)' : '0 1px 2px rgba(120, 90, 40, 0.08)',
                transform: on ? 'translateY(-1px)' : 'none', transition: 'all 0.15s ease',
              }}
            >
              {b}동
            </button>
          );
        })}
      </div>

      {/* 시간 (분) */}
      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>시간 (분)</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', marginBottom: '0.6rem' }}>
        <button
          onClick={() => onDraftMinutes(Math.max(5, draftMinutes - 5))}
          style={{ width: 40, height: 40, flexShrink: 0, fontSize: '1.2rem', fontWeight: 700, border: '2px solid #d6c8a8', background: '#fffefb', borderRadius: '0.5rem', cursor: 'pointer' }}
        >−</button>
        <input
          type="number"
          value={draftMinutes}
          onChange={(e) => onDraftMinutes(Math.max(1, parseInt(e.target.value) || 0))}
          style={{ flex: 1, minWidth: 0, padding: '0.6rem', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#f0f9ff', color: '#0c4a6e', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => onDraftMinutes(Math.min(300, draftMinutes + 5))}
          style={{ width: 40, height: 40, flexShrink: 0, fontSize: '1.2rem', fontWeight: 700, border: '2px solid #d6c8a8', background: '#fffefb', borderRadius: '0.5rem', cursor: 'pointer' }}
        >+</button>
        <span style={{ fontSize: '0.85rem', color: '#6b7280', flexShrink: 0 }}>분</span>
      </div>

      {/* 담기 */}
      <button
        onClick={onCommit}
        disabled={!canCommit}
        style={{
          width: '100%', padding: '0.6rem', borderRadius: '0.6rem',
          border: canCommit ? '2px dashed #0ea5e9' : '2px dashed #cbd5e1',
          background: canCommit ? '#eff6ff' : '#f8fafc',
          color: canCommit ? '#0369a1' : '#94a3b8',
          fontSize: '0.9rem', fontWeight: 700, cursor: canCommit ? 'pointer' : 'not-allowed',
        }}
      >
        ＋ 이 시간으로 담기{canCommit ? ` (${draftBlocks.join('·')}동 ${draftMinutes}분)` : ''}
      </button>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem', textAlign: 'center' }}>
        동마다 시간이 다르면 담고 다음 동 선택 · 한 번만이면 바로 저장해도 돼요
      </div>
    </div>
  );
}
