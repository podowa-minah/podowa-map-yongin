// src/components/AiUrgentTasks.jsx
// 보고(현황분석) 맨 위 "🤖 AI 긴급 오늘 할 일" — 좌표 없는 밭 AI 할 일 체크리스트.
//   오늘 daily_notes의 briefing.snapshot.tasks 중 scope=field(kind='field') 항목만.
//   체크 → snapshot.doneTasks에 그 항목(cat 포함) 저장 = 그 범주 "한 일" 히스토리로 누적(§10, 새 저장소 X).
//   나무 할 일은 맵 보라가 담당(여기 안 나옴). 다 체크하면 줄어듦(=오늘 끝).
//   체크는 일하는 중에도 가능 — 그날 row를 직접 업데이트(읽고-합치고-쓰기로 다른 필드 보존).
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function AiUrgentTasks({ today, onChange }) {
  const [snap, setSnap] = useState(null);
  const [rowId, setRowId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('daily_notes').select('id, journal_notes')
      .eq('date', today).eq('type', 'journal').maybeSingle();
    setRowId(data?.id || null);
    setSnap(data?.journal_notes?.briefing?.snapshot || null);
  }, [today]);
  useEffect(() => { load(); }, [load]);

  const tasks = (snap?.tasks || []).filter((t) => t.kind === 'field');
  const doneKeys = new Set((snap?.doneTasks || []).map((t) => t.key));
  if (!tasks.length) return null;   // 오늘 밭 할 일 없으면 숨김

  const toggle = async (task) => {
    if (busy || !rowId) return;
    setBusy(true);
    const isDone = doneKeys.has(task.key);
    const cur = snap?.doneTasks || [];
    const next = isDone ? cur.filter((t) => t.key !== task.key) : [...cur, task];
    // 읽고-합치고-쓰기: snapshot/journal의 다른 필드는 그대로 보존
    const { data: row } = await supabase.from('daily_notes').select('journal_notes').eq('id', rowId).maybeSingle();
    const jn = row?.journal_notes || {};
    const briefing = jn.briefing || {};
    const snapshot = { ...(briefing.snapshot || {}), doneTasks: next };
    const { error } = await supabase.from('daily_notes')
      .update({ journal_notes: { ...jn, briefing: { ...briefing, snapshot } } })
      .eq('id', rowId);
    if (!error) { setSnap(snapshot); onChange?.(); }
    setBusy(false);
  };

  const doneCount = tasks.filter((t) => doneKeys.has(t.key)).length;
  const allDone = doneCount === tasks.length;

  return (
    <div style={{ marginBottom: '1.4rem', background: '#f4f1fb', border: '1.5px solid #c9bdf0', borderRadius: '0.6rem', padding: '0.7rem 0.85rem' }}>
      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#5b3fb0', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        🤖 AI 긴급 오늘 할 일
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: allDone ? '#3c8a4e' : '#7c3aed' }}>{doneCount}/{tasks.length}</span>
        {allDone && <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3c8a4e' }}>✓ 다 했어요</span>}
      </div>
      {tasks.map((t) => {
        const on = doneKeys.has(t.key);
        return (
          <label key={t.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '0.32rem 0', cursor: busy ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={on} onChange={() => toggle(t)} disabled={busy} style={{ marginTop: 3, flexShrink: 0, accentColor: '#7c3aed' }} />
            <span style={{ fontSize: '0.86rem', lineHeight: 1.4, textDecoration: on ? 'line-through' : 'none', opacity: on ? 0.5 : 1 }}>
              {t.carried && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a6a1c', background: '#fdf3e3', border: '1px solid #f0d9b0', borderRadius: 4, padding: '0 4px', marginRight: 4 }}>이월</span>}
              <span style={{ fontWeight: 700, color: '#0c447c', marginRight: 4 }}>{t.cat}</span>{t.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
