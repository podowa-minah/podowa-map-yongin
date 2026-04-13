import React, { useState } from 'react';

export default function RenamePopup({ id, current = {}, onSave, onClose }) {
  const [name, setName] = useState(current.name || '');
  const [color, setColor] = useState(current.color || '#ffffff');
  const [disabled, setDisabled] = useState(current.disabled || false);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
    }}>
      <div style={{
        background: 'white', padding: '1rem', borderRadius: 6, minWidth: 220
      }}>
        <h3 style={{ marginBottom: 12 }}>{id}</h3>

        <label style={{ fontSize: 12 }}>Name (optional)</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '4px 0 12px 0' }}
        />

        <label style={{ fontSize: 12 }}>Background colour</label>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ display: 'block', width: '100%', height: 32, marginTop: 4, marginBottom: 12 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', fontSize: '1.2rem', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={disabled}
            onChange={e => setDisabled(e.target.checked)}
            style={{ marginRight: 8, width: 24, height: 24 }}
          />
          비활성화 (빈 자리)
        </label>

        <div style={{ marginTop: 16, display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '1rem 1.5rem', fontSize: '1.2rem', borderRadius: '0.5rem', border: '2px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => {
              onSave({ name: name.trim(), color, disabled });
              onClose();
            }}
            style={{ padding: '1rem 1.5rem', fontSize: '1.2rem', borderRadius: '0.5rem', background: '#0077ff', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}