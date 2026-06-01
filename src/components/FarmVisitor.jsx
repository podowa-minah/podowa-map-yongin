// src/components/FarmVisitor.jsx
// 농장 방문자 — 하루 한 번 무작위 시간에 화면을 가로질러 날아감 (나비 or 벌)
// CLAUDE.md §11: 작은 컴포넌트 = 한 가지 표시. 인라인 SVG로 1KB 미만.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'podowa-visitor-seen-date';

export default function FarmVisitor() {
  const [active, setActive] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE_KEY) === today) return;

    // 페이지 마운트 후 30~150초 무작위 시점 등장
    const delay = 30000 + Math.random() * 120000;
    const t1 = setTimeout(() => {
      const variant = Math.random() < 0.55 ? 'butterfly' : 'bee';
      const y = 220 + Math.random() * 240;        // 헤더 아래쪽
      setActive({ variant, y });
      localStorage.setItem(STORAGE_KEY, today);
      // 6초 후 자연스럽게 사라짐
      const t2 = setTimeout(() => setActive(null), 6300);
      return () => clearTimeout(t2);
    }, delay);

    return () => clearTimeout(t1);
  }, []);

  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: active.y,
        left: 0,
        pointerEvents: 'none',
        zIndex: 60,
        animation: 'visitorFlyAcross 6s linear forwards',
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.15))',
      }}
    >
      {active.variant === 'butterfly' ? <Butterfly /> : <Bee />}
    </div>
  );
}

function Butterfly() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26"
         style={{ animation: 'visitorWingFlap 0.22s ease-in-out infinite' }}>
      {/* 윗날개 */}
      <ellipse cx="11" cy="9" rx="8" ry="6" fill="#f9a8d4" />
      <ellipse cx="23" cy="9" rx="8" ry="6" fill="#f9a8d4" />
      {/* 아랫날개 */}
      <ellipse cx="11" cy="17" rx="6" ry="5" fill="#fbcfe8" />
      <ellipse cx="23" cy="17" rx="6" ry="5" fill="#fbcfe8" />
      {/* 날개 무늬 */}
      <circle cx="11" cy="9" r="2" fill="#fff" opacity="0.7" />
      <circle cx="23" cy="9" r="2" fill="#fff" opacity="0.7" />
      {/* 몸통 */}
      <ellipse cx="17" cy="13" rx="1.3" ry="6.5" fill="#3a2410" />
      {/* 더듬이 */}
      <line x1="17" y1="6.5" x2="15" y2="3" stroke="#3a2410" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="17" y1="6.5" x2="19" y2="3" stroke="#3a2410" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

function Bee() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20"
         style={{ animation: 'visitorWingFlap 0.16s ease-in-out infinite' }}>
      {/* 몸 (노랑 + 검정 줄) */}
      <ellipse cx="13" cy="13" rx="10" ry="6" fill="#fbbf24" />
      <rect x="6" y="9" width="2" height="8" fill="#1f2937" />
      <rect x="11" y="9" width="2" height="8" fill="#1f2937" />
      <rect x="16" y="9" width="2" height="8" fill="#1f2937" />
      {/* 날개 */}
      <ellipse cx="9" cy="8" rx="4.5" ry="3" fill="#e0f2fe" opacity="0.92" />
      <ellipse cx="17" cy="8" rx="4.5" ry="3" fill="#e0f2fe" opacity="0.92" />
      {/* 머리 + 눈 */}
      <circle cx="22" cy="13" r="2.2" fill="#3a2410" />
      <circle cx="22.3" cy="12.5" r="0.6" fill="#fff" />
    </svg>
  );
}
