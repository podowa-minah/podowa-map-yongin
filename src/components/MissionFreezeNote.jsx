// src/components/MissionFreezeNote.jsx
// 지난 달 미션이 100% 못 채우고 넘어갔을 때 — 그 달 화면 맨 위 "마감 기록" 카드.
//   달성률(%)은 그 시기(달 말일)까지의 완료로 이미 얼려져 있다 → 나중에 '했어요' 눌러도 안 올라감.
//   여기선 "왜 다 못했는지" 사유만 클릭해서 펼쳐 적는다. 저장하면 그 행 content에 남아 연도별 자료가 된다.
//   저장소: daily_notes (type='mission_freeze') — 미달일 사유(type='incomplete_reason')와 같은 방식, DB 변경 없음.
import { useState } from 'react';
import { supabase } from '../supabaseClient';

const STAGE_LABEL = { 2: '맹아기', 3: '맹아기', 4: '맹아기', 5: '개화기', 6: '경핵기', 7: '성숙기', 8: '성숙기', 9: '수확기', 12: '전정' };

export default function MissionFreezeNote({ freeze, authorName, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(freeze.reason || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const text = draft.trim();
    const { error } = await supabase
      .from('daily_notes')
      .update({ content: text, author: authorName || null })
      .eq('id', freeze.id);
    setSaving(false);
    if (!error) { setEditing(false); onSaved?.(text); }
  }

  const stage = STAGE_LABEL[freeze.month] || '';

  return (
    <div style={{
      margin: '10px 16px 0', background: '#fdf1df', border: '1.5px solid #f0d29a',
      borderRadius: 14, padding: '11px 13px', color: '#8a5a12',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800 }}>
        <span style={{ fontSize: 15 }}>🔒</span>
        <span>{freeze.month}월{stage ? ` · ${stage}` : ''} — {freeze.pct}%로 마감</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#b58a45' }}>
          {freeze.done}/{freeze.total}
        </span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#a9843f', lineHeight: 1.45 }}>
        이 달은 지나갔어요. 달성률은 그대로 남아요 — 지금 완료해도 이 %는 안 올라가요.
      </p>

      {!editing && freeze.reason && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 13, color: '#6b5a33', background: '#fff8ec',
            border: '1px solid #f0e0bd', borderRadius: 9, padding: '8px 10px', lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {freeze.reason}
          </div>
          <button onClick={() => setEditing(true)} style={btnGhost}>✏️ 사유 고치기</button>
        </div>
      )}

      {!editing && !freeze.reason && (
        <button onClick={() => setEditing(true)} style={{ ...btnGhost, marginTop: 8 }}>
          ✍️ 왜 다 못했는지 사유 쓰기
        </button>
      )}

      {editing && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예시) 6월 중순 장마로 방제 시기를 놓침"
            autoFocus
            style={{
              width: '100%', minHeight: 60, padding: 9, boxSizing: 'border-box',
              border: '1.5px solid #ecc877', borderRadius: 9, background: '#fff',
              fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45, resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
            <button onClick={() => { setEditing(false); setDraft(freeze.reason || ''); }} disabled={saving}
              style={{ ...btnBase, background: '#fff', color: '#8a6d2a', border: '1.5px solid #ecc877' }}>
              취소
            </button>
            <button onClick={save} disabled={saving}
              style={{ ...btnBase, background: '#e0912a', color: '#fff', border: 'none', flex: 1 }}>
              {saving ? '저장 중…' : '💾 사유 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnBase = {
  borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
  fontSize: 13, padding: '9px 12px',
};
const btnGhost = {
  ...btnBase, background: '#fff', color: '#a15e12', border: '1.5px solid #f0d29a',
};
