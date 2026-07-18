// src/components/PestGuideEdit.jsx
// 병해충 지식 카드 수정 (관리자) — 밭에서 실제 겪은 걸로 도감 설명을 다듬는 곳.
//   · 기본 지식(코드)은 그대로 두고, 수정본만 app_settings.pest_guide 에 덮어쓰기 저장.
//   · 관리자 비번 1234 (앱 공통 수정 게이트 — CLAUDE.md §4).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { guideFor, guideFields } from '../lib/pest-guide';

export default function PestGuideEdit({ name, kind = 'pest', overrides = {}, onSave, onClose }) {
  const merged = guideFor(name, overrides) || { kind, what: '', sign: '', watch: '', care: '' };
  const [form, setForm] = useState({ what: merged.what, sign: merged.sign, watch: merged.watch, care: merged.care });
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (pw !== '1234') { setErr('관리자 비밀번호가 틀렸어요'); return; }
    setSaving(true);
    await onSave?.(name, { ...form, kind: merged.kind || kind });
    setSaving(false);
    onClose?.();
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 400, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 34px rgba(0,0,0,0.3)', padding: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>✏️ {name} 설명 수정</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.7rem' }}>
          밭에서 실제로 겪은 걸로 다듬기 · 관리자용 · 빈 칸은 기본 설명 유지
        </div>

        {guideFields().map(([k, label]) => (
          <div key={k} style={{ marginBottom: '0.6rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 600 }}>{label}</label>
            <textarea
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
              rows={k === 'what' ? 3 : 2}
              style={{
                display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem',
                border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical',
                backgroundColor: '#fafaf7', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        <div style={{ marginTop: '0.3rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 600 }}>관리자 비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(''); }}
            placeholder="1234"
            style={{
              display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.6rem',
              border: `1px solid ${err ? '#ef4444' : '#e2e8f0'}`, borderRadius: '0.5rem',
              fontFamily: 'inherit', fontSize: '1rem', boxSizing: 'border-box',
            }}
          />
          {err && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 1, padding: '0.7rem', borderRadius: '0.6rem', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'default' : 'pointer', boxShadow: '0 3px 0 #14532d' }}
          >{saving ? '저장 중…' : '저장'}</button>
          <button
            onClick={onClose}
            style={{ flex: '0 0 auto', padding: '0.7rem 1.1rem', borderRadius: '0.6rem', border: '2px solid #e2e8f0', background: '#fff', color: '#6b7280', fontWeight: 700, cursor: 'pointer' }}
          >취소</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
