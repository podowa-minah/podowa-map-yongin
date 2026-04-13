import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import farmerSVG from '../assets/icons/farmer.svg';
import farmerRestSVG from '../assets/icons/farmer_rest.svg';

const EMOJIS = ['🎉', '✨', '🌟', '🎊', '🍇', '🌿'];
const BATCH = 20;
const TOTAL_CONFETTI = 60;

// 이모지 데이터를 미리 생성 (렌더 중 Math.random 방지)
function makeConfetti(startIdx) {
  return Array.from({ length: BATCH }, (_, i) => {
    const idx = startIdx + i;
    return {
      key: idx,
      left: `${5 + Math.random() * 90}%`,
      fontSize: `${12 + Math.random() * 16}px`,
      duration: `${2.5 + Math.random() * 1.5}s`,
      delay: `${idx * 0.03}s`,
      emoji: EMOJIS[Math.floor(Math.random() * 6)],
    };
  });
}

function ConfettiRain() {
  const [batches, setBatches] = useState(() => [makeConfetti(0)]);

  useEffect(() => {
    if (batches.length >= TOTAL_CONFETTI / BATCH) return;
    const timer = setTimeout(() => {
      setBatches(prev => [...prev, makeConfetti(prev.length * BATCH)]);
    }, 150);
    return () => clearTimeout(timer);
  }, [batches.length]);

  return batches.flat().map(c => (
    <span
      key={c.key}
      style={{
        position: 'absolute',
        top: '-10px',
        left: c.left,
        fontSize: c.fontSize,
        animation: `confetti ${c.duration} ease-out ${c.delay} forwards`,
        opacity: 0,
        willChange: 'transform, opacity',
      }}
    >
      {c.emoji}
    </span>
  ));
}

export default function ProgressBar({ completed, total, greenDots = 0, treeData = {} }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = total > 0 && completed >= total;
  const [showFanfare, setShowFanfare] = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (isComplete) {
      setShowFanfare(true);
      const timer = setTimeout(() => setShowFanfare(false), 7000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // 오늘 작업자별 나무 수 계산
  const workerStats = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstToday = kst.toISOString().slice(0, 10);
    const counts = {};

    Object.values(treeData).forEach(records => {
      records.forEach(rec => {
        if (rec.date === kstToday && rec.producer) {
          counts[rec.producer] = (counts[rec.producer] || 0) + 1;
        }
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [treeData]);

  // Empty state: no trees to care for today
  const isEmpty = total === 0;

  return (
    <div style={{
      padding: isEmpty ? '6px 0.85rem' : '4px 0.85rem',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'center',
      gap: isEmpty ? '10px' : '8px',
      position: 'relative',
    }}>
    {isEmpty ? (
      <>
        <img
          src={farmerRestSVG}
          alt="resting farmer"
          onClick={() => setShowLog(v => !v)}
          style={{ width: '44px', height: '32px', flexShrink: 0, cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4a5568', flex: 1 }}>
          오늘은 돌볼 나무가 없어요 🌿
        </span>
        {greenDots > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', color: '#4a5568', fontWeight: 600, flexShrink: 0 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>{greenDots}</span>
          </span>
        )}
      </>
    ) : (
      <>
      {/* 바 + 농부 (왼쪽, 넓게) */}
      <div style={{ position: 'relative', height: '38px', flex: 1, marginLeft: '6px', overflow: 'visible' }}>
        {/* 배경 바 */}
        <div style={{
          position: 'absolute',
          top: '24px',
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
            width: isComplete ? 'calc(100% - 10px)' : `${pct}%`,
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
            borderRadius: '5px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* 농부 캐릭터 */}
        <img
          src={farmerSVG}
          alt="farmer"
          onClick={() => setShowLog(v => !v)}
          style={{
            position: 'absolute',
            left: `clamp(-17px, calc(${pct}% - 17px), calc(100% - 22px))`,
            top: '0px',
            width: '30px',
            height: '34px',
            transition: 'left 0.5s ease',
            filter: isComplete ? 'drop-shadow(0 0 4px gold)' : 'none',
            zIndex: 1,
            cursor: 'pointer',
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
      </>
    )}

      {/* 오늘의 작업일지 팝업 */}
      {showLog && ReactDOM.createPortal(
        <div
          onClick={() => setShowLog(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              minWidth: '260px',
              maxWidth: '340px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowLog(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: '#888',
              }}
            >✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <img src={farmerRestSVG} alt="resting farmer" style={{ width: '40px', height: '28px' }} />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748' }}>오늘의 작업일지</span>
            </div>

            {workerStats.length === 0 ? (
              <div style={{ fontSize: '0.9rem', color: '#888' }}>아직 오늘 기록이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {workerStats.map(({ name, count }) => (
                  <div key={name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f7fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>{name}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#667eea' }}>{count}그루</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '14px', fontSize: '0.8rem', color: '#a0aec0', textAlign: 'center' }}>
              총 {workerStats.reduce((s, w) => s + w.count, 0)}그루 돌봄
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 팡파레 효과 — portal로 body에 렌더 */}
      {showFanfare && ReactDOM.createPortal(
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
          <ConfettiRain />
          <style>{`
            @keyframes fanfare {
              0% { transform: scale(0); opacity: 0; }
              20% { transform: scale(1.3); opacity: 1; }
              80% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.8); opacity: 0; }
            }
            @keyframes confetti {
              0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
              100% { transform: translate3d(0,120vh,0) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}
