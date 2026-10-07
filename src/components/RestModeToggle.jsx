// src/components/RestModeToggle.jsx
// 🌙 휴식모드 켜기/끄기 — 메뉴 드로어에 들어감. 저장은 App(app_settings.rest_mode).
//   켜기: 확인 후 시작. 끄기: 메뉴에서도 끌 수 있게(헤더 칩과 별개 경로).
export default function RestModeToggle({ active = false, days = 0, onStart, onEnd }) {
  const base = {
    width: '100%', padding: '0.7rem 0.9rem', borderRadius: '0.6rem', cursor: 'pointer',
    border: 'none', fontWeight: 800, fontSize: '1rem', textAlign: 'left',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  };

  if (active) {
    return (
      <button
        onClick={() => { if (window.confirm(`휴식 ${days}일째 — 평소 모드로 돌아갈까요?`)) onEnd?.(); }}
        style={{ ...base, background: '#e0e7ff', color: '#3730a3' }}
      >
        🌙 휴식 끝내기 <span style={{ fontWeight: 500, color: '#6366f1' }}>({days}일째 · 평소로)</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => { if (window.confirm('🌙 휴식모드를 시작할까요?\n\n수확 끝난 뒤 조용 모드예요 — 남은 그루·미달성 사유·불 알림이 멈춰요.\n기록(입력·영농일지·사진)은 평소처럼 다 됩니다.')) onStart?.(); }}
      style={{ ...base, background: '#1e293b', color: '#fff' }}
    >
      🌙 휴식모드 시작 <span style={{ fontWeight: 500, color: '#cbd5e1' }}>(수확 끝 · 조용 모드)</span>
    </button>
  );
}
