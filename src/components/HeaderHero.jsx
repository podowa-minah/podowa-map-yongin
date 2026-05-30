// src/components/HeaderHero.jsx
// 그린 hero — PODOWA + 사용자 이름 + 알림 배너 + 큰 % + 농부

import farmerSVG from '../assets/icons/farmer.svg';
import farmerAnnounce from '../assets/icons/farmer_announce.svg';
import treeIconSVG from '../assets/icons/tree_icon_1.svg';

export default function HeaderHero({
  pct = 0,
  completed = 0,
  total = 0,
  userName,
  hasRecentAnnouncement,
  greenDots = 0,
  kindDots = 0,
  fakeDots = 0,
  missedCount = 0,
  onGoAnalysis,
  onFarmerClick,
  onAnnouncements,
  onIncompleteReasons,
}) {
  // 완료율(0~100)을 CSS 변수로 — 헤더 아래에서부터 차오르는 따뜻한 색 fill
  const fillPct = Math.min(100, Math.max(0, pct || 0));
  return (
    <div
      className={`hero-section${fillPct >= 100 ? ' is-complete' : ''}`}
      style={{ '--fill-pct': `${fillPct}%` }}
    >
      <style>{`
        @keyframes notifShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-7deg); }
          30% { transform: rotate(6deg); }
          45% { transform: rotate(-4deg); }
          60% { transform: rotate(3deg); }
        }
        @keyframes duckWaddle {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          25%      { transform: rotate(-4deg) translateY(-1px); }
          50%      { transform: rotate(0deg)  translateY(0); }
          75%      { transform: rotate(4deg)  translateY(-1px); }
        }
        @keyframes duckHeadBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.2px); }
        }
        @keyframes duckWingFlap {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-10deg); }
        }
        /* 좌우발 번갈아 들기 (걸음걸이) */
        @keyframes duckFootLeft {
          0%, 40%, 100% { transform: translateY(0) rotate(0deg); }
          20%           { transform: translateY(-3px) rotate(-8deg); }
        }
        @keyframes duckFootRight {
          0%, 100%      { transform: translateY(0) rotate(0deg); }
          60%           { transform: translateY(-3px) rotate(8deg); }
          80%           { transform: translateY(0) rotate(0deg); }
        }
      `}</style>

      {/* 상단: 브랜드 + 사용자 + 알림 배너 */}
      <div className="hero-top">
        <button className="brand-mark" onClick={onGoAnalysis} aria-label="현황분석으로 이동">
          PODOWA
        </button>
        <div className="hero-user-stack">
          {userName && (
            <div className="user-name">
              <span className="user-greeting">농부</span> {userName}
            </div>
          )}
          {/* 농부님 주목 알림 배너 */}
          <button
            className={`notif-banner ${hasRecentAnnouncement ? 'has-recent' : ''}`}
            onClick={onAnnouncements}
            aria-label="농부님 주목 (공지사항)"
          >
            <img
              src={farmerAnnounce}
              alt=""
              className="notif-farmer"
              style={{
                animation: hasRecentAnnouncement ? 'notifShake 1s ease-in-out infinite' : 'none',
              }}
            />
            <span className="notif-text">농부님 주목!</span>
            {hasRecentAnnouncement && <span className="notif-dot" />}
          </button>
        </div>
      </div>

      {/* ⚠️ 미달일 사유 미제출 경고 배너 — 사유 다 제출되면 사라짐 */}
      {missedCount > 0 && (
        <button
          className="incomplete-warn-banner"
          onClick={onIncompleteReasons}
          aria-label={`미달일 ${missedCount}건 사유 입력`}
        >
          <span className="iwb-icon">⚠️</span>
          <span className="iwb-text">미달일 사유 미제출 <b>{missedCount}건</b> · 입력 →</span>
        </button>
      )}

      {/* hero stat — 농부 + 큰 % + 점 indicator */}
      <div className="hero-stat">
        <img
          src={farmerSVG}
          alt="farmer"
          className="hero-farmer"
          draggable={false}
          onClick={onFarmerClick}
        />
        <div style={{ flex: 1 }}>
          <div className="hero-stat-num">
            {pct}<span className="pct-sign">%</span>
          </div>
          <div className="hero-stat-label">
            오늘 작업 진행 · {completed}/{total}그루
          </div>
          {/* 점 indicator — 헛돌봄(주황)/착한돌봄(파랑)/정돌봄(초록) */}
          {(greenDots > 0 || kindDots > 0 || fakeDots > 0) && (
            <div className="hero-dots">
              {fakeDots > 0 && (
                <span className="hero-dot-item">
                  <span className="dot dot-orange" />
                  {fakeDots}
                </span>
              )}
              {kindDots > 0 && (
                <span className="hero-dot-item">
                  <span className="dot dot-blue" />
                  {kindDots}
                </span>
              )}
              {greenDots > 0 && (
                <span className="hero-dot-item">
                  <img src={treeIconSVG} alt="" className="dot-tree" />
                  {greenDots}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🦆 흰 오리 — 우측 하단 (노란 웹발이 포인트!) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '14px',
          bottom: '20px',           /* 흰 카드 윗 모서리에 발 딱 붙음 (-20px overlap 맞춤) */
          width: '49px',
          height: '49px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <svg
          viewBox="0 0 80 80"
          width="49"
          height="49"
          style={{
            animation: 'duckWaddle 1.6s ease-in-out infinite',
            transformOrigin: '50% 92%',
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.22))',
          }}
        >
          <defs>
            <radialGradient id="duckBody" cx="40%" cy="35%" r="70%">
              <stop offset="0%"   stopColor="#ffffff" />
              <stop offset="60%"  stopColor="#fafbfd" />
              <stop offset="100%" stopColor="#dde3eb" />
            </radialGradient>
            <linearGradient id="duckBeak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#ea8a0a" />
            </linearGradient>
            <linearGradient id="duckFoot" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#fcd34d" />
              <stop offset="50%"  stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* ── 노란 웹발 (포인트!) ── */}
          {/* 왼발 */}
          <g style={{
            transformOrigin: '30px 70px',
            animation: 'duckFootLeft 1.6s ease-in-out infinite',
          }}>
            {/* 다리 */}
            <rect x="28" y="58" width="3.5" height="9" rx="1.5" fill="url(#duckFoot)" />
            {/* 웹발 — 부채꼴 3갈래 */}
            <path
              d="M 22 67
                 Q 20 71  23 73
                 L 30 71
                 L 37 73
                 Q 40 71  38 67
                 Q 35 70  30 70
                 Q 25 70  22 67 Z"
              fill="url(#duckFoot)"
              stroke="#d97706"
              strokeWidth="0.5"
            />
            {/* 발가락 구분 라인 */}
            <line x1="26" y1="68" x2="27" y2="71.5" stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
            <line x1="30" y1="68" x2="30" y2="72"   stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
            <line x1="34" y1="68" x2="33" y2="71.5" stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
          </g>

          {/* 오른발 */}
          <g style={{
            transformOrigin: '50px 70px',
            animation: 'duckFootRight 1.6s ease-in-out infinite',
          }}>
            <rect x="48.5" y="58" width="3.5" height="9" rx="1.5" fill="url(#duckFoot)" />
            <path
              d="M 42 67
                 Q 40 71  43 73
                 L 50 71
                 L 57 73
                 Q 60 71  58 67
                 Q 55 70  50 70
                 Q 45 70  42 67 Z"
              fill="url(#duckFoot)"
              stroke="#d97706"
              strokeWidth="0.5"
            />
            <line x1="46" y1="68" x2="47" y2="71.5" stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
            <line x1="50" y1="68" x2="50" y2="72"   stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
            <line x1="54" y1="68" x2="53" y2="71.5" stroke="#d97706" strokeWidth="0.5" opacity="0.5" />
          </g>

          {/* ── 몸체 ── */}
          <ellipse cx="40" cy="46" rx="24" ry="17" fill="url(#duckBody)" />
          {/* 꼬리 */}
          <path d="M 17 42 Q 8 38 10 46 Q 14 48 20 47 Z" fill="url(#duckBody)" />

          {/* 날개 (퍼덕거림) */}
          <g style={{
            transformOrigin: '40px 44px',
            animation: 'duckWingFlap 1.4s ease-in-out infinite',
          }}>
            <path
              d="M 30 42 Q 42 35 53 44 Q 46 50 32 48 Z"
              fill="#f1f5f9"
              stroke="#cbd5e1"
              strokeWidth="0.6"
            />
            {/* 날개 깃털 라인 */}
            <path d="M 36 44 Q 42 41 48 45" stroke="#cbd5e1" strokeWidth="0.5" fill="none" opacity="0.6" />
          </g>

          {/* ── 머리 (살짝 끄덕끄덕) ── */}
          <g style={{
            transformOrigin: '60px 30px',
            animation: 'duckHeadBob 2.2s ease-in-out infinite',
          }}>
            <circle cx="60" cy="28" r="13" fill="url(#duckBody)" />
            {/* 부리 */}
            <path d="M 71 28 L 79 30 L 71 34 Z" fill="url(#duckBeak)" />
            <path d="M 71 28 L 79 30 L 73 32 Z" fill="#fcd34d" opacity="0.6" />
            <line x1="72" y1="31" x2="78" y2="31" stroke="#b45309" strokeWidth="0.4" opacity="0.5" />
            {/* 눈 */}
            <circle cx="63" cy="25.5" r="2.4" fill="#fff" />
            <circle cx="63.2" cy="25.7" r="1.7" fill="#1e293b" />
            <circle cx="63.8" cy="25" r="0.55" fill="#fff" />
            {/* 볼터치 */}
            <circle cx="57" cy="30" r="2.6" fill="#fda4af" opacity="0.4" />
          </g>
        </svg>
      </div>
    </div>
  );
}
