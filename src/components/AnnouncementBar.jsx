// src/components/AnnouncementBar.jsx
import React from 'react';

export default function AnnouncementBar({ latest, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 0,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        margin: '0 6px',
        border: '1px solid #ccc',
        borderRadius: '6px',
        fontSize: '0.78rem',
        color: '#333',
        backgroundColor: '#fafafa',
        cursor: 'pointer',
        overflow: 'hidden',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 8px',
      }}
    >
      {latest ? (
        <span style={{
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.4',
        }}>
          {latest.message}
        </span>
      ) : (
        <span style={{ color: '#aaa' }}>{'\u{1F48C}'}</span>
      )}
    </div>
  );
}
