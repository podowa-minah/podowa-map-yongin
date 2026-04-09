import React, { useState, useEffect } from 'react';
import farmerSVG from '../assets/icons/farmer.svg';

export default function ProgressBar({ completed, total, greenDots = 0 }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = total > 0 && completed >= total;
  const [showFanfare, setShowFanfare] = useState(false);

  useEffect(() => {
    if (isComplete) {
      setShowFanfare(true);
      const timer = setTimeout(() => setShowFanfare(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (total === 0) return null;

  return (
    <div style={{
      padding: '4px 0.85rem',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {/* 바 + 농부 (왼쪽, 넓게) */}
      <div style={{ position: 'relative', height: '38px', flex: 1, marginLeft: '6px' }}>
        {/* 배경 바 */}
        <div style={{
          position: 'absolute',
          top: '22px',
          left: 0,
          right: 0,
          height: '10px',
          background: '#e2e8f0',
          borderRadius: '5px',
          overflow: 'hidden',
        }}>
          {/* 채워진 바 */}
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
            borderRadius: '5px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* 농부 캐릭터 */}
        <img
          src={farmerSVG}
          alt="farmer"
          style={{
            position: 'absolute',
            left: `clamp(-17px, calc(${pct}% - 17px), calc(100% - 34px))`,
            top: '-2px',
            width: '34px',
            height: '38px',
            transition: 'left 0.5s ease',
            filter: isComplete ? 'drop-shadow(0 0 4px gold)' : 'none',
          }}
        />
      </div>

      {/* 오른쪽: 초록점(위) + 퍼센트(아래) */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '38px',
      }}>
        {greenDots > 0 ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, marginTop: '1px', marginRight: '1.4px' }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }} />
            <span>{greenDots}</span>
          </span>
        ) : <span />}
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#4a5568',
          whiteSpace: 'nowrap',
          marginBottom: '3.4px',
        }}>
          {`${pct}% (${completed}/${total})`}
        </span>
      </div>

      {/* 팡파레 효과 */}
      {showFanfare && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: '3rem',
            animation: 'fanfare 3s ease-out forwards',
          }}>
            🎉🎊🥳
          </div>
          {/* 떨어지는 컨페티 */}
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                top: '-10px',
                left: `${5 + Math.random() * 90}%`,
                fontSize: `${12 + Math.random() * 16}px`,
                animation: `confetti ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                opacity: 0,
              }}
            >
              {['🎉', '✨', '🌟', '🎊', '🍇', '🌿'][Math.floor(Math.random() * 6)]}
            </span>
          ))}
          <style>{`
            @keyframes fanfare {
              0% { transform: scale(0); opacity: 0; }
              20% { transform: scale(1.3); opacity: 1; }
              80% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.8); opacity: 0; }
            }
            @keyframes confetti {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(80vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
