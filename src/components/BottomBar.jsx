// src/components/BottomBar.jsx
import React from 'react';
import MiniMap from './MiniMap';
import farmerAnnounce from '../assets/icons/farmer_announce.svg';

export default function BottomBar({ onAnnouncementClick, litTreeIds, pinnedItems = [] }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: '#fff',
      borderTop: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'stretch',
      padding: '6px 12px',
      gap: '10px',
      WebkitTransform: 'translateZ(0)',
      transform: 'translateZ(0)',
    }}>
      {/* 미니맵 */}
      <div style={{
        flexShrink: 0,
        padding: '4px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <MiniMap litTreeIds={litTreeIds} />
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          flexShrink: 0,
        }}>
          <img src={farmerAnnounce} alt="" style={{ width: 20, height: 20 }} />
          <span style={{
            fontFamily: "'Poor Story', cursive",
            fontSize: '0.95rem',
            color: '#666',
            fontWeight: 400,
          }}>
            농부님 주목!
          </span>
        </div>

        {/* 핀된 항목 */}
        {pinnedItems.length > 0 && (
          <div style={{
            flex: 1,
            overflow: 'hidden',
            marginTop: '2px',
          }}>
            {pinnedItems.map((item) => (
              <div key={item.id} style={{
                fontSize: '0.82rem',
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
  );
}
