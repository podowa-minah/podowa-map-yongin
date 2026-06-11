// src/components/HeaderHero.jsx
// 그린 hero — PODOWA + 사용자 이름 + 알림 배너 + 큰 % + 농부

import { useState, useRef, useEffect } from 'react';
import farmerSVG from '../assets/icons/farmer.svg';
import farmerAnnounce from '../assets/icons/farmer_announce.svg';
import treeIconSVG from '../assets/icons/tree_icon_1.svg';
import { playQuack } from '../utils/sounds';

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
  missionGap = null,                 // 지난달 미션 미완료 { month, pct } | null — 푸쉬 배너
  onOpenMission,                     // 배너 탭 → 지난달 미션 모달 열기
  clusterPct = 0,                    // 송이크기정리 최종완료 진행률(전밭 그루 대비 %)
  thinningPct = 0,                   // 알솎이 최종완료 진행률
  clusterDone = 0,                   // 송이크기정리 최종완료 그루 수
  thinningDone = 0,                  // 알솎이 최종완료 그루 수
  fieldTotal = 0,                    // 전체 활성 나무 수
  streak = 0,                      // 🔥 연속 출근 일수
  duckMessage = '오늘도 화이팅!',     // 🦆 오리 말풍선 — 항상 표시되는 오늘의 전달사항
  onSubmitDuckMessage,                // (text) => Promise<bool> — 새 메시지 저장
  onGoAnalysis,
  onFarmerClick,
  onAnnouncements,
  onIncompleteReasons,
}) {
  // 🦆 오리 말풍선 — 항상 표시. 누르면 꽥꽥 + 살짝 출렁
  const [duckWiggle, setDuckWiggle] = useState(0);
  const handleDuckClick = (e) => {
    e.stopPropagation();
    playQuack();
    setDuckWiggle((n) => n + 1);
  };

  // ✏️ 메시지 빠른 입력
  const [editingMsg, setEditingMsg] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const msgInputRef = useRef(null);
  useEffect(() => {
    if (editingMsg && msgInputRef.current) msgInputRef.current.focus();
  }, [editingMsg]);
  async function submitMsg() {
    const trimmed = msgInput.trim();
    if (!trimmed || msgSending) return;
    setMsgSending(true);
    const ok = onSubmitDuckMessage ? await onSubmitDuckMessage(trimmed) : false;
    setMsgSending(false);
    if (ok) {
      setMsgInput('');
      setEditingMsg(false);
    }
  }
  // 완료율(0~100)을 CSS 변수로 — 헤더 아래에서부터 차오르는 따뜻한 색 fill
  const fillPct = Math.min(100, Math.max(0, pct || 0));
  // 첫 로드 시 노랗게 차오르는 애니메이션 X — 데이터 들어온 직후 한 번은 transition 끔
  const [fillAnimEnabled, setFillAnimEnabled] = useState(false);
  useEffect(() => {
    if (pct != null && !fillAnimEnabled) {
      // 2 rAF로 fill이 그 자리에 박힌 다음 transition 켜기
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(() => setFillAnimEnabled(true));
        return () => cancelAnimationFrame(id2);
      });
      return () => cancelAnimationFrame(id1);
    }
  }, [pct, fillAnimEnabled]);
  const isStatsLoading = pct == null;
  return (
    <div
      className={`hero-section${fillPct >= 100 ? ' is-complete' : ''}${!fillAnimEnabled ? ' no-fill-anim' : ''}`}
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
        @keyframes duckBubbleWiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25%      { transform: rotate(-3deg) scale(1.06); }
          50%      { transform: rotate(2deg) scale(1.04); }
          75%      { transform: rotate(-1deg) scale(1.02); }
        }
      `}</style>

      {/* 상단: 브랜드 + 사용자 + 알림 배너 */}
      <div className="hero-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <button className="brand-mark" onClick={onGoAnalysis} aria-label="현황분석으로 이동">
            PODOWA
          </button>
          {/* 송이크기정리/알솎이 최종완료 진행률 — PODOWA 옆 흰 칩으로 또렷하게.
              전밭 그루 대비 %. 아무도 안 누른(0/0) 비시즌엔 숨김.
              전밭 알솎이까지 100% 끝나면(=둘 다 100%) 지도 테두리처럼 칩도 사라짐. */}
          {fieldTotal > 0 && (clusterDone > 0 || thinningDone > 0) && thinningPct < 100 && (
            <span
              style={{
                display: 'inline-flex', flexDirection: 'column', gap: '1px',
                padding: '0.25rem 0.55rem', borderRadius: '0.6rem',
                background: 'rgba(255,255,255,0.96)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
                lineHeight: 1.15, whiteSpace: 'nowrap',
              }}
              title={`송이크기정리 ${clusterDone}/${fieldTotal}그루 · 알솎이 ${thinningDone}/${fieldTotal}그루`}
            >
              <span style={{ color: '#ca8a04', fontWeight: 800, fontSize: '0.78rem' }}>송이크기정리 {clusterPct}%</span>
              <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.78rem' }}>알솎이 {thinningPct}%</span>
            </span>
          )}
        </div>
        <div className="hero-user-stack">
          {userName && (
            <div className="user-name">
              <span className="user-greeting">농부</span> {userName}
            </div>
          )}
          {/* (🔥 연속 출근 streak 표시 임시 제거) */}
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

      {/* 📋 지난달 미션 미완료 푸쉬 배너 — 지난달 미션 다 채우면 사라짐 (탭하면 그 달 모달) */}
      {missionGap && missionGap.pct < 100 && (
        <button
          className="incomplete-warn-banner mission-gap-banner"
          onClick={onOpenMission}
          aria-label={`${missionGap.month}월 포도 미션 ${missionGap.pct}% · 마저 입력`}
        >
          <span className="iwb-icon">📋</span>
          <span className="iwb-text">{missionGap.month}월 포도 미션 미완료 <b>{missionGap.pct}%</b> · 마저 하기 →</span>
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
          <div className="hero-stat-num" style={{ visibility: isStatsLoading ? 'hidden' : 'visible' }}>
            {pct ?? 0}<span className="pct-sign">%</span>
          </div>
          <div className="hero-stat-label" style={{ visibility: isStatsLoading ? 'hidden' : 'visible' }}>
            오늘 작업 진행 · {completed ?? 0}/{total ?? 0}그루
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

      {/* 🦆 오리 말풍선 — 오늘의 전달사항 (입력 모드 OR 표시 모드) */}
      {editingMsg ? (
        <div
          style={{
            position: 'absolute',
            right: '54px',
            bottom: '54px',
            width: '200px',
            background: '#fffefb',
            color: '#1f2937',
            padding: '6px 8px',
            borderRadius: '12px',
            boxShadow: '0 3px 8px rgba(0,0,0,0.28), 0 0 0 1.5px #1f2937',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <input
            ref={msgInputRef}
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value.slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitMsg();
              if (e.key === 'Escape') { setEditingMsg(false); setMsgInput(''); }
            }}
            placeholder="오늘 한 마디..."
            maxLength={80}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.72rem',
              fontFamily: 'inherit',
              background: 'transparent',
              color: '#1f2937',
              padding: '2px 4px',
            }}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); submitMsg(); }}
            disabled={!msgInput.trim() || msgSending}
            style={{
              border: 'none',
              background: msgInput.trim() ? '#1f2937' : '#9ca3af',
              color: '#fff',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: '0.66rem',
              fontWeight: 700,
              cursor: msgInput.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {msgSending ? '...' : '↵'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditingMsg(false); setMsgInput(''); }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#9ca3af',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '0 2px',
              fontFamily: 'inherit',
            }}
          >×</button>
        </div>
      ) : (
        <div
          key={`duck-bubble-${duckWiggle}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '54px',
            bottom: '54px',
            maxWidth: '160px',
            background: '#fffefb',
            color: '#1f2937',
            padding: '5px 10px',
            borderRadius: '12px',
            fontSize: '0.72rem',
            fontWeight: 700,
            lineHeight: 1.3,
            boxShadow: '0 2px 6px rgba(0,0,0,0.22), 0 0 0 1.5px #1f2937',
            animation: duckWiggle > 0 ? 'duckBubbleWiggle 0.5s ease' : undefined,
            zIndex: 3,
            pointerEvents: 'none',
            fontFamily: 'inherit',
            letterSpacing: '0.2px',
            wordBreak: 'keep-all',
            textAlign: 'center',
          }}
        >
        {duckMessage}
        {/* tail (bubble pointing to duck) */}
        <span style={{
          position: 'absolute',
          bottom: -5,
          right: 10,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #1f2937',
        }} />
        <span style={{
          position: 'absolute',
          bottom: -2.5,
          right: 11,
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '5px solid #fffefb',
        }} />
      </div>
      )}

      {/* ✏️ 메시지 빠른 입력 버튼 — 말풍선 위쪽에 작게 */}
      {!editingMsg && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setEditingMsg(true); }}
          aria-label="오리 메시지 적기"
          title="오리 한 마디 적기"
          style={{
            position: 'absolute',
            right: '50px',
            bottom: '90px',
            width: 22, height: 22,
            border: 'none',
            background: 'rgba(255,255,255,0.92)',
            color: '#1f2937',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 4,
            fontSize: '0.7rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.22), 0 0 0 1.2px #1f2937',
            WebkitTapHighlightColor: 'transparent',
            padding: 0,
          }}
        >✏️</button>
      )}

      {/* 🦆 흰 오리 — 우측 하단. 누르면 꽥꽥 🔊 + 말풍선 */}
      <button
        type="button"
        onClick={handleDuckClick}
        aria-label="오리 — 누르면 꽥꽥"
        style={{
          position: 'absolute',
          right: '14px',
          bottom: '20px',
          width: '49px',
          height: '49px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          zIndex: 2,
          WebkitTapHighlightColor: 'transparent',
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
      </button>
    </div>
  );
}
