// src/components/SaveCelebration.jsx
// 저장 성공 시 농부가 자랑스럽게 등장하는 축하 오버레이.
// portal로 body에 렌더. pointer-events:none 이라 모달 자동 닫힘 흐름 방해 안 함.
//
// CLAUDE.md 규칙 준수:
//  - 새 기능 = 새 파일 (TreeModal에 인라인 X)
//  - 글자/버튼 크기 보존 (이 컴포넌트는 새로 만드는 거라 기존 크기 영향 X)

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import farmerProudSVG from '../assets/icons/farmer_proud.svg';

const CELEBRATION_MESSAGES = [
  '잘했어요! 🌱',
  '오늘도 수고했어요',
  '농부의 한 걸음 👏',
  '기록 완료!',
  '한 그루 더 돌봤어요',
];

// 친구 ProgressBar의 ConfettiRain과 같은 시각 언어 (작은 색종이 떨어짐)
function MiniConfetti() {
  const pieces = Array.from({ length: 30 });
  return (
    <>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.2 + Math.random() * 0.8;
        const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899'];
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-20px',
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              borderRadius: '2px',
              animation: `save-confetti ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
    </>
  );
}

export default function SaveCelebration({ show, durationMs = 1400 }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(CELEBRATION_MESSAGES[0]);

  useEffect(() => {
    if (!show) return;
    setMessage(CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)]);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs]);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 농부 (크게 + 살짝 점프) */}
      <img
        src={farmerProudSVG}
        alt="자랑스러운 농부"
        style={{
          width: '180px',
          height: 'auto',
          animation: 'save-farmer-pop 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.15))',
        }}
      />

      {/* 메시지 */}
      <div
        style={{
          marginTop: '12px',
          padding: '0.6rem 1.2rem',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '999px',
          fontSize: '1.3rem',
          fontWeight: 700,
          color: '#2d3748',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          animation: 'save-msg-fade 1.4s ease-out forwards',
        }}
      >
        {message}
      </div>

      {/* 색종이 비 */}
      <MiniConfetti />

      <style>{`
        @keyframes save-farmer-pop {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          40%  { transform: scale(1.15) rotate(5deg); opacity: 1; }
          60%  { transform: scale(0.95) rotate(-3deg); }
          80%  { transform: scale(1.05) rotate(0deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes save-msg-fade {
          0%   { transform: translateY(20px); opacity: 0; }
          30%  { transform: translateY(0); opacity: 1; }
          85%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
        @keyframes save-confetti {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
