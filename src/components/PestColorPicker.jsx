// src/components/PestColorPicker.jsx
// 벌레/병 대표색 고르기 — 병해충 지도 오버레이의 🎨에서 열림.
//   고른 색은 App이 app_settings.pest_colors 에 저장 (기기/사람 상관없이 같은 색).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { COLOR_CHOICES, colorOf } from '../lib/pest-colors';

export default function PestColorPicker({ items = [], colors = {}, onPick, onClose }) {
  const [sel, setSel] = useState(null);   // 지금 색 고르는 중인 이름

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '1rem', padding: '1rem',
          width: '100%', maxWidth: 360, maxHeight: '70vh', overflowY: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>🎨 병해충 색 정하기</span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}
          >✕</button>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
          지도에서 이 색으로 표시돼요 · 점수 높을수록 진하게
        </div>

        {items.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: '#b9b3a6', padding: '0.6rem 0' }}>아직 기록된 벌레/병이 없어요</div>
        )}

        {items.map((it) => {
          const cur = colorOf(it.name, colors);
          const open = sel === it.name;
          return (
            <div key={it.name} style={{ borderTop: '1px solid #f1efe9', padding: '0.6rem 0' }}>
              <button
                onClick={() => setSel(open ? null : it.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 6, background: cur, border: '2px solid #fff', boxShadow: '0 0 0 1px #d6d0c4', flex: '0 0 auto' }} />
                <span style={{ fontWeight: 700, color: '#3a382f' }}>{it.name}</span>
                <span style={{ marginLeft: 'auto', color: '#7c3aed', fontWeight: 700, fontSize: '0.85rem' }}>{open ? '접기' : '색 바꾸기'}</span>
              </button>
              {open && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { onPick?.(it.name, c); setSel(null); }}
                      aria-label={`${it.name} 색 ${c}`}
                      style={{
                        width: 34, height: 34, borderRadius: 8, background: c, cursor: 'pointer',
                        border: c === cur ? '3px solid #1f2937' : '2px solid #fff',
                        boxShadow: '0 0 0 1px #d6d0c4',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
