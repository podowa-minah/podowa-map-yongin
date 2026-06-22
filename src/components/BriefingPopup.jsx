// src/components/BriefingPopup.jsx
// 아침 브리핑 — 하루 한 번. 순서:
//   ① 보고 보기: 유심히 볼 나무 + 품종별 점수 + AI 한마디
//   ② "나무를 돌보세요!" 강조 + 확인
//   ③ "오늘 세력 어때 보여요?" 예측(세력·해충·걱정) → 저장
//   ※ 오늘 이미 했으면 → 요약만 보여줌(예측 다시 안 물음).
// 저장(히스토리): daily_notes.journal_notes.briefing.snapshot (§10, 새 테이블 없음)
//   - 걱정 코멘트는 snapshot.eyeCheck.note 에 저장된다.

import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { buildBriefingContext } from '../lib/briefing';
import { getVarietyAverages } from '../lib/diagnosis';

const GREEN = '#2f6b3c';

export default function BriefingPopup({ treeData = {}, labels = {}, user, onChecked, onClose }) {
  const today = todayKST();
  const [doneToday, setDoneToday] = useState(undefined);   // undefined=확인중 | true | false
  const [savedSnap, setSavedSnap] = useState(null);        // 오늘 이미 한 경우의 스냅샷
  const [step, setStep] = useState('report');              // 'report' | 'predict'
  const [vigor, setVigor] = useState(null);
  const [pest, setPest] = useState(null);
  const [note, setNote] = useState('');
  const [ai, setAi] = useState('loading');                 // 'loading' | 'error' | {alert,checks,info}
  const [saving, setSaving] = useState(false);

  const ctx = useMemo(() => buildBriefingContext({ treeData, labels, todayIso: today }), [treeData, labels, today]);
  const varietyScores = useMemo(() => getVarietyAverages(treeData, labels), [treeData, labels]);

  // 오늘 이미 브리핑 했나? → 했으면 요약만
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('daily_notes').select('journal_notes')
        .eq('date', today).eq('type', 'journal').maybeSingle();
      if (!alive) return;
      const b = data?.journal_notes?.briefing;
      if (b?.checked_at) { setSavedSnap(b.snapshot || null); setDoneToday(true); }
      else setDoneToday(false);
    })();
    return () => { alive = false; };
  }, [today]);

  // AI 한마디 — 아직 안 한 날만 새로 받아온다 (요약 모드는 저장된 글 사용)
  useEffect(() => {
    if (doneToday !== false) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/briefing', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ctx),
        });
        if (!r.ok) { if (alive) setAi('error'); return; }
        const data = await r.json();
        if (alive) setAi(data && data.alert ? data : 'error');
      } catch { if (alive) setAi('error'); }
    })();
    return () => { alive = false; };
  }, [doneToday, ctx]);

  async function startDay() {
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const snapshot = {
      eyeCheck: { vigor, pest, note: note.trim() },
      diagnosis: ctx.diagnosis,
      varietyScores: varietyScores.map((v) => ({ name: v.name, score: v.score == null ? null : Math.round(v.score * 10) / 10 })),
      watchTrees: ctx.watchTrees,
      watchTotal: ctx.watchCount,
      ai: (ai && typeof ai === 'object') ? ai : null,
    };
    const { data: existing } = await supabase
      .from('daily_notes').select('id, journal_notes')
      .eq('date', today).eq('type', 'journal').maybeSingle();
    const journal_notes = {
      ...(existing?.journal_notes || {}),
      briefing: { ...(existing?.journal_notes?.briefing || {}), checked_at: new Date().toISOString(), snapshot },
    };
    let result;
    if (existing) result = await supabase.from('daily_notes').update({ journal_notes }).eq('id', existing.id);
    else result = await supabase.from('daily_notes').insert({ date: today, type: 'journal', journal_notes, author, content: '' });
    setSaving(false);
    if (result?.error) { alert('저장 실패: ' + result.error.message); return; }
    onChecked?.();
    onClose?.();
  }

  // 요약에서 "처음부터 다시 작성" — 보고→나무 돌보세요→예측 흐름을 다시 (저장하면 오늘 기록 덮어씀)
  function redo() {
    setSavedSnap(null);
    setVigor(null); setPest(null); setNote('');
    setAi('loading');
    setStep('report');
    setDoneToday(false);   // → AI 다시 받아오고 보고 흐름 표시
  }

  const canStart = vigor != null && pest != null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 700 }}>
            {shortDate(today)} 아침 브리핑{doneToday ? ' · 요약' : step === 'predict' ? ' · 오늘 세력' : ''}
          </span>
          <button onClick={onClose} aria-label="닫기" title="닫기" style={closeBtn}>✕</button>
        </div>

        <div style={body}>
          {doneToday === undefined && <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>불러오는 중…</p>}

          {/* ── 요약 모드: 오늘 이미 함 ── */}
          {doneToday === true && (
            <SummaryView snap={savedSnap} onClose={onClose} onRedo={redo} />
          )}

          {/* ── ① 보고 + 나무 돌보세요 ── */}
          {doneToday === false && step === 'report' && (
            <>
              <WatchSection watchTrees={ctx.watchTrees} watchCount={ctx.watchCount} />
              <VarietySection list={varietyScores} />
              <SectionTitle>AI 한마디</SectionTitle>
              <AiView ai={ai} />
              <div style={careBanner}>
                🍇 꼭 포도밭을 한 바퀴 돌고<br />포도나무 컨디션을 체크한 후 나무를 돌보세요!
              </div>
              <button onClick={() => setStep('predict')} style={primaryBtn}>확인 — 오늘 세력 보기</button>
            </>
          )}

          {/* ── ② 오늘 세력 예측 ── */}
          {doneToday === false && step === 'predict' && (
            <>
              <SectionTitle>오늘 밭 상태 어때 보여요?</SectionTitle>
              <Field label="전체 세력" hint="1 약함 — 5 강함">
                <Pills opts={[1, 2, 3, 4, 5]} value={vigor} onPick={setVigor} />
              </Field>
              <Field label="해충 정도" hint="0 없음 — 5 심함">
                <Pills opts={[0, 1, 2, 3, 4, 5]} value={pest} onPick={setPest} />
              </Field>
              <Field label="걱정 구역 · 한마디" hint="선택 (기록에 저장돼요)">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="예: 매니큐어 세력 강함, 함부르크 진딧물 시작" style={textareaStyle} />
              </Field>
              <button disabled={!canStart || saving} onClick={startDay}
                style={{ ...primaryBtn, opacity: (canStart && !saving) ? 1 : 0.45, cursor: (canStart && !saving) ? 'pointer' : 'not-allowed' }}>
                {saving ? '저장 중…' : '나무 돌보러 가기'}
              </button>
              <p style={hintLine}>세력·해충 찍어야 시작돼요 · 보고·세력·걱정 모두 기록에 저장</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 요약(읽기 전용) ──
function SummaryView({ snap, onClose, onRedo }) {
  if (!snap) {
    return (
      <>
        <p style={{ fontSize: '0.9rem', color: '#5f5e5a' }}>오늘 브리핑을 이미 확인했어요. ✅</p>
        <button onClick={onClose} style={primaryBtn}>닫기</button>
      </>
    );
  }
  const e = snap.eyeCheck || {};
  const d = snap.diagnosis || {};
  return (
    <>
      {/* 내 눈(아침 예측) vs 실제(기록 데이터) — 눈 훈련 비교 */}
      <SectionTitle>오늘 세력·해충 — 내 눈 vs 기록</SectionTitle>
      <div style={cmpTable}>
        <div style={{ ...cmpRow, color: '#9ca3af', fontSize: '0.74rem', fontWeight: 700 }}>
          <span style={cmpLabel} /><span style={cmpCol}>내 눈</span><span style={cmpCol}>기록(데이터)</span>
        </div>
        <CmpRow label="세력" mine={e.vigor} real={d.vigor} />
        <CmpRow label="해충" mine={e.pest} real={d.pest} />
      </div>
      {d.score != null && (
        <div style={{ fontSize: '0.82rem', color: '#1f2937', margin: '0 0 12px' }}>
          밭 종합 점수 <b style={{ color: GREEN }}>{d.score}</b>
          {d.balance != null && <span style={{ color: '#9ca3af' }}> · 균형 {d.balance}</span>}
        </div>
      )}
      {e.note ? (
        <div style={{ fontSize: '0.85rem', color: '#5f5e5a', margin: '0 0 14px' }}>걱정 메모: “{e.note}”</div>
      ) : null}
      {snap.watchTrees?.length > 0 && (
        <WatchSection watchTrees={snap.watchTrees} watchCount={snap.watchTotal ?? snap.watchTrees.length} />
      )}
      {snap.varietyScores?.length > 0 && (
        <VarietySection list={snap.varietyScores} />
      )}
      {snap.ai && (<><SectionTitle>AI 한마디</SectionTitle><AiView ai={snap.ai} /></>)}
      <button onClick={onClose} style={{ ...primaryBtn, marginTop: 6 }}>닫기</button>
      {onRedo && (
        <button onClick={onRedo} style={redoBtn}>✏️ 오늘 브리핑 처음부터 다시 작성</button>
      )}
    </>
  );
}

// 내 눈 vs 기록 한 줄 — 차이가 크면 노랑 강조(눈이 빗나간 항목)
function CmpRow({ label, mine, real }) {
  const diff = (mine != null && real != null) ? Math.abs(mine - real) : null;
  const off = diff != null && diff >= 1.5;
  return (
    <div style={cmpRow}>
      <span style={cmpLabel}>{label}</span>
      <span style={{ ...cmpCol, fontWeight: 700, color: '#1f2937' }}>{mine ?? '–'}</span>
      <span style={{ ...cmpCol, fontWeight: 700, color: off ? '#b45309' : GREEN }}>
        {real ?? '–'}{off ? ' ⚠️' : ''}
      </span>
    </div>
  );
}

function WatchSection({ watchTrees = [], watchCount = 0 }) {
  if (!watchCount) return null;
  return (
    <>
      <SectionTitle><span style={{ color: '#854f0b' }}>⚠️ 유심히 볼 나무 {watchCount}그루</span></SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {watchTrees.map((w, i) => (
          <div key={i} style={{ fontSize: '0.82rem', color: '#1f2937' }}>
            {w.name} <span style={{ color: '#9a6a1c' }}>— {(w.reasons || []).join('·')}</span>
          </div>
        ))}
        {watchCount > watchTrees.length && (
          <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>외 {watchCount - watchTrees.length}그루</div>
        )}
      </div>
    </>
  );
}

function VarietySection({ list = [] }) {
  if (!list.length) return null;
  return (
    <>
      <SectionTitle>품종별 점수 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(낮은 순)</span></SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
        {list.map((v) => {
          const sc = v.score == null ? null : Math.round(v.score * 10) / 10;
          const col = sc == null ? '#9ca3af' : sc <= 2.5 ? '#e24b4a' : sc <= 3.5 ? '#eab308' : GREEN;
          return (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', flex: '0 0 4.5rem', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
              <span style={{ flex: 1, height: 7, background: '#ece9e0', borderRadius: 999, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (sc || 0) / 5 * 100)}%`, background: col }} />
              </span>
              <span style={{ fontSize: '0.8rem', flex: '0 0 1.7rem', textAlign: 'right', color: col, fontWeight: 700 }}>{sc ?? '–'}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AiView({ ai }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {ai === 'loading' && <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>클로드가 메모 읽는 중…</p>}
      {ai === 'error' && <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>AI 글은 배포본에서 보여요</p>}
      {ai && typeof ai === 'object' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Band color="#854f0b" bg="#faeeda" title="🚨 경각심">{ai.alert}</Band>
          {Array.isArray(ai.checks) && ai.checks.length > 0 && (
            <Band color="#27500a" bg="#eaf3de" title="✅ 오늘 체크">{ai.checks.map((c, i) => <div key={i}>· {c}</div>)}</Band>
          )}
          {ai.info && <Band color="#042c53" bg="#e6f1fb" title="📊 정보">{ai.info}</Band>}
        </div>
      )}
    </div>
  );
}

// ── 작은 부품 ──
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 7, color: '#1f2937' }}>
        {label} {hint && <span style={{ fontWeight: 400, color: '#b4b2a9', fontSize: '0.72rem' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Pills({ opts, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map((n) => {
        const on = value === n;
        return (
          <button key={n} onClick={() => onPick(n)} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
            border: on ? `1.5px solid ${GREEN}` : '1.5px solid #d3d1c7',
            background: on ? GREEN : '#fff', color: on ? '#fff' : '#5f5e5a', fontWeight: 600, fontSize: '0.9rem',
          }}>{n}</button>
        );
      })}
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>{children}</div>;
}
function Band({ color, bg, title, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, background: bg, borderRadius: '0 8px 8px 0', padding: '9px 11px' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '0.9rem', color, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${dow})`;
}

// ── 스타일 ──
const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,16,8,0.55)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.1rem 0.8rem', overflowY: 'auto',
};
const sheet = { width: '100%', maxWidth: '420px', margin: 'auto' };
const header = {
  background: GREEN, color: '#fff', padding: '13px 16px', borderRadius: '14px 14px 0 0',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const body = { background: '#fff', borderRadius: '0 0 14px 14px', padding: '15px 16px' };
const closeBtn = {
  background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none',
  borderRadius: 8, width: 30, height: 30, fontSize: '0.95rem',
  cursor: 'pointer', lineHeight: 1, flexShrink: 0,
};
const textareaStyle = {
  width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: '0.9rem',
  padding: 8, borderRadius: 8, border: '1px solid #d3d1c7', resize: 'none',
};
const primaryBtn = {
  width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 10,
  padding: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
};
const hintLine = { textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', margin: '8px 0 0' };
const careBanner = {
  background: '#eef6ec', border: '1px solid #cfe3cc', borderRadius: 10,
  padding: '10px 12px', margin: '2px 0 10px', fontSize: '0.85rem',
  color: '#27500a', lineHeight: 1.5, fontWeight: 600, textAlign: 'center',
};
const cmpTable = {
  border: '1px solid #ece0c4', borderRadius: 10, overflow: 'hidden', marginBottom: 10,
};
const cmpRow = {
  display: 'flex', alignItems: 'center', padding: '8px 12px',
  borderTop: '1px solid #f0ece2', fontSize: '0.9rem',
};
const cmpLabel = { flex: '0 0 3.5rem', color: '#5f5e5a', fontSize: '0.85rem' };
const cmpCol = { flex: 1, textAlign: 'center' };
const redoBtn = {
  width: '100%', marginTop: 8, padding: '9px', background: 'none',
  border: '1px solid #d3d1c7', borderRadius: 10, color: '#6b7280',
  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};
