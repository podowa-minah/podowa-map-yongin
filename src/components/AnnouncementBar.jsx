// src/components/AnnouncementBar.jsx
import React from 'react';

export default function AnnouncementBar({ latest, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        margin: '0 8px',
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
        padding: '0 10px',
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
          <span style={{ color: '#888', marginRight: '6px' }}>{latest.author}</span>
          {latest.message}
        </span>
      ) : (
        <span style={{ color: '#aaa', margin: '0 auto' }}>{'\u{1F48C}'}</span>
      )}
    </div>
  );
}
