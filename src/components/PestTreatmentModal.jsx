// src/components/PestTreatmentModal.jsx
// 전체방제 입력 모달 — placeholder (3단계에서 full UI 구현)

export default function PestTreatmentModal({ user, onClose, onSaved }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.5rem', borderRadius: '1rem',
          maxWidth: '500px', width: '90%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem' }}>💊 전체방제 기록</h2>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          (3단계에서 입력 UI 구현 예정)
        </p>
        <button
          onClick={onClose}
          style={{
            padding: '0.6rem 1.2rem',
            border: '2px solid #d1d5db', borderRadius: '0.5rem',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '1rem',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
