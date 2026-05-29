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
  return (
    <div className="hero-section">
      <style>{`
        @keyframes notifShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-7deg); }
          30% { transform: rotate(6deg); }
          45% { transform: rotate(-4deg); }
          60% { transform: rotate(3deg); }
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
    </div>
  );
}
