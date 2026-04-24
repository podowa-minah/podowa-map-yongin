// src/components/BottomBar.jsx
import React, { useState } from 'react';
import MiniMap from './MiniMap';
import farmerAnnounce from '../assets/icons/farmer_announce.svg';

const COLLAPSED_STORAGE_KEY = 'bottom_bar_collapsed_until';

// 다음 "한국 시간 04:00" 의 UTC ISO 문자열 반환
function getNextKSTResetISO() {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowKST = new Date(Date.now() + KST_OFFSET_MS);
  const y = nowKST.getUTCFullYear();
  const m = nowKST.getUTCMonth();
  const d = nowKST.getUTCDate();
  const h = nowKST.getUTCHours();
  // 이미 오늘 KST 04:00을 지났으면 내일 04:00이 리셋 시각
  const targetDate = h >= 4 ? d + 1 : d;
  const targetUTCms = Date.UTC(y, m, targetDate, 4, 0, 0) - KST_OFFSET_MS;
  return new Date(targetUTCms).toISOString();
}

function readInitialCollapsed() {
  try {
    const expiry = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!expiry) return false;
    if (new Date(expiry).getTime() > Date.now()) return true;
    // 만료된 값은 청소
    localStorage.removeItem(COLLAPSED_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

export default function BottomBar({ onAnnouncementClick, litTreeIds, pinnedItems = [], viewportInfo, hasRecent = false }) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);

  const handleCollapse = () => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, getNextKSTResetISO());
    } catch {}
    setCollapsed(true);
  };

  const handleExpand = () => {
    try {
      localStorage.removeItem(COLLAPSED_STORAGE_KEY);
    } catch {}
    setCollapsed(false);
  };

  // 빨간 점 뱃지 ("다 확인했어요" 누르기 전까지 표시)
  const redDot = hasRecent ? (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: '#ef4444',
      marginLeft: '4px',
      verticalAlign: 'middle',
    }} />
  ) : null;

  // 메가폰 농부 크기: "다 확인했어요" 누르기 전까지 → 크게 + 흔들림
  const farmerSizeExpanded = 70;
  const farmerSizeNormal = 45;
  const farmerSizeCollapsed = hasRecent ? 60 : 40;

  // 접힌 상태
  if (collapsed) {
    return (
      <div
        className="bottom-bar"
        style={{
          backgroundColor: '#fff',
          borderTop: '1px solid #e0e0e0',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: rotate(0deg); }
            15% { transform: rotate(-12deg); }
            30% { transform: rotate(10deg); }
            45% { transform: rotate(-8deg); }
            60% { transform: rotate(6deg); }
            75% { transform: rotate(-3deg); }
          }
        `}</style>
        <div
          onClick={handleExpand}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '44px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <img
              src={farmerAnnounce}
              alt=""
              style={{
                width: farmerSizeCollapsed,
                height: farmerSizeCollapsed,
                animation: hasRecent ? 'shake 0.8s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ fontFamily: "'Poor Story', cursive", fontSize: hasRecent ? '1rem' : '0.85rem', color: hasRecent ? '#d97706' : '#666', fontWeight: hasRecent ? 700 : 400 }}>
              농부님 주목!
            </span>
            {redDot}
          </span>
        </div>
      </div>
    );
  }

  // 펼친 상태
  return (
    <div
      className="bottom-bar"
      style={{
        backgroundColor: '#fff',
        borderTop: '1px solid #e0e0e0',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateY(-50%) rotate(0deg); }
          15% { transform: translateY(-50%) rotate(-12deg); }
          30% { transform: translateY(-50%) rotate(10deg); }
          45% { transform: translateY(-50%) rotate(-8deg); }
          60% { transform: translateY(-50%) rotate(6deg); }
          75% { transform: translateY(-50%) rotate(-3deg); }
        }
      `}</style>

      {/* 손잡이 탭 — 누르면 접기 */}
      <div
        onClick={handleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '20px',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          backgroundColor: '#ccc',
        }} />
      </div>

      {/* 콘텐츠 */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 12px 6px',
        gap: '10px',
      }}>
        {/* 미니맵 */}
        <div
          onClick={handleCollapse}
          style={{
            flexShrink: 0,
            padding: '4px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MiniMap litTreeIds={litTreeIds} viewportInfo={viewportInfo} />
        </div>

        {/* 게시판 */}
        <div
          onClick={onAnnouncementClick}
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid #ccc',
            borderRadius: '6px',
            backgroundColor: '#fafafa',
            cursor: 'pointer',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 10px',
          }}
        >
          {/* 타이틀 */}
          <div style={{
            textAlign: 'center',
            flexShrink: 0,
            lineHeight: 1,
          }}>
            <span style={{
              position: 'relative',
              display: 'inline-block',
              fontFamily: "'Poor Story', cursive",
              fontSize: hasRecent ? '1.1rem' : '0.95rem',
              color: hasRecent ? '#d97706' : '#666',
              fontWeight: hasRecent ? 700 : 400,
            }}>
              <img
                src={farmerAnnounce}
                alt=""
                style={{
                  position: 'absolute',
                  right: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: hasRecent ? farmerSizeExpanded : farmerSizeNormal,
                  height: hasRecent ? farmerSizeExpanded : farmerSizeNormal,
                  marginRight: '2px',
                  animation: hasRecent ? 'shake 0.8s ease-in-out infinite' : 'none',
                  transition: 'width 0.3s, height 0.3s',
                }}
              />
              농부님 주목!
              {redDot}
            </span>
          </div>

          {/* 핀된 항목 */}
          {pinnedItems.length > 0 && (
            <div style={{
              flex: 1,
              overflow: 'hidden',
              marginTop: '6px',
            }}>
              {pinnedItems.map((item) => (
                <div key={item.id} style={{
                  fontFamily: "'Poor Story', cursive",
                  fontSize: '0.85rem',
                  color: '#555',
                  lineHeight: '1.3',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  <span style={{ color: '#999', marginRight: '4px' }}>•</span>
                  {item.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
