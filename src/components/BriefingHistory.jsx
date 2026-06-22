// src/components/BriefingHistory.jsx
// 지난 아침 브리핑 모아보기 — daily_notes.journal_notes.briefing.snapshot 읽어서 표시(읽기 전용).
// 그날 보여준 그대로의 스냅샷이라 재계산하지 않는다. CLAUDE.md §10: 저장된 데이터 표시만.
//
// props:
//   history       AnalysisPage가 fetch한 daily_notes 배열 (journal_notes 포함)
//   C             컬러 토큰 (AnalysisPage와 공유)
//   onSelectDate  (date) => void  — 날짜 누르면 그날 보고로 이동

import { useState } from 'react';
import { scoreBand } from '../lib/scoring';

export default function BriefingHistory({ history = [], C, onSelectDate }) {
  const [showAll, setShowAll] = useState(false);
  const items = history.filter(h => h?.journal_notes?.briefing?.snapshot);

  if (items.length === 0) {
    return (
      <p style={{ color: C.muted, fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
        아직 저장된 브리핑이 없어요.<br />
        아침 브리핑에서 <b style={{ color: '#15803d' }}>“나무 돌보러 가기”</b>를 누르면<br />그날 브리핑(내 판단·AI 한마디)이 여기 쌓여요.
      </p>
    );
  }

  const shown = showAll ? items : items.slice(0, 3);

  return (
    <>
      {shown.map(entry => {
        const b = entry.journal_notes.briefing;
        const s = b.snapshot || {};
        const fieldScore = s.diagnosis?.score ?? s.score ?? null;
        const band = fieldScore != null ? scoreBand(fieldScore) : null;
        const time = b.checked_at
          ? new Date(b.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '';
        return (
          <div key={entry.id} style={card}>
            <div style={head}>
              <button onClick={() => onSelectDate?.(entry.date)} style={dateBtn} title="그날 보고로 이동">
                {entry.date}
              </button>
              {time && <span style={{ color: '#a89968', fontSize: '0.72rem' }}>{time} 확인</span>}
              {fieldScore != null && band && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: band.color, fontSize: '0.85rem' }}>
                  밭 {fieldScore.toFixed(1)} · {band.label}
                </span>
              )}
            </div>
            {s.eyeCheck && (
              <div style={{ fontSize: '0.82rem', color: '#1f2937', marginBottom: '0.3rem' }}>
                내 눈: 세력 <b>{s.eyeCheck.vigor ?? '–'}</b> · 해충 <b>{s.eyeCheck.pest ?? '–'}</b>
                {s.eyeCheck.note ? <span style={{ color: '#6b7280' }}> · “{s.eyeCheck.note}”</span> : null}
              </div>
            )}
            {s.diagnosis && (s.diagnosis.vigor != null || s.diagnosis.pest != null) && (
              <div style={{ fontSize: '0.82rem', color: '#1f2937', marginBottom: '0.3rem' }}>
                기록(데이터): 세력 <b>{s.diagnosis.vigor ?? '–'}</b> · 해충 <b>{s.diagnosis.pest ?? '–'}</b>
                {s.diagnosis.balance != null ? <span style={{ color: '#9ca3af' }}> · 균형 {s.diagnosis.balance}</span> : null}
              </div>
            )}
            {Array.isArray(s.varietyScores) && s.varietyScores.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.3rem', lineHeight: 1.5 }}>
                품종: {s.varietyScores.slice(0, 4).map((v) => `${v.name} ${v.score ?? '–'}`).join(' · ')}
                {s.varietyScores.length > 4 ? ' …' : ''}
              </div>
            )}
            {s.ai?.alert && (
              <div style={{ fontSize: '0.82rem', color: '#854f0b', marginBottom: '0.3rem', lineHeight: 1.5 }}>
                🚨 {s.ai.alert}
              </div>
            )}
            {s.ai && (s.ai.env || s.ai.growth || s.ai.pest) && (
              <div style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem', lineHeight: 1.55 }}>
                {s.ai.env ? <div><b style={{ color: '#0c447c' }}>환경</b> · {s.ai.env}</div> : null}
                {s.ai.growth ? <div><b style={{ color: '#27500a' }}>생육</b> · {s.ai.growth}</div> : null}
                {s.ai.pest ? <div><b style={{ color: '#a32d2d' }}>병해충</b> · {s.ai.pest}</div> : null}
              </div>
            )}
            {Array.isArray(s.doneTasks) && s.doneTasks.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#27500a', marginBottom: '0.3rem', lineHeight: 1.5 }}>
                {s.doneTasks.map((t, i) => {
                  const isField = t.kind === 'field';
                  return <div key={i}>✓ <b>{isField ? t.cat : t.treeId}</b>{!isField && t.name ? ` ${t.name}` : ''}{t.label ? ` — ${t.label}` : ''}</div>;
                })}
              </div>
            )}
            {(s.opinions || []).map((o, i) => (
              <div key={i} style={opRow}>
                <span style={opLabel}>{o.label}</span>
                <span style={{ fontSize: '0.85rem', lineHeight: 1.5, color: C.text }}>{o.text}</span>
              </div>
            ))}
            {s.watchTotal > 0 && (
              <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '0.35rem' }}>
                ⚠️ 유심히 볼 나무 {s.watchTotal}그루
              </div>
            )}
          </div>
        );
      })}
      {items.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} style={moreBtn(C)}>
          {showAll ? '접기 ▴' : `더보기 (${items.length - 3}건 더) ▾`}
        </button>
      )}
    </>
  );
}

const card = {
  padding: '0.75rem 0.85rem', marginBottom: '0.6rem',
  background: '#fffefb', border: '1px solid #ece0c4', borderRadius: '0.55rem',
};

const head = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  marginBottom: '0.45rem', flexWrap: 'wrap',
};

const dateBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: 'inherit', fontWeight: 700, color: '#1f2937',
  textDecoration: 'underline', textUnderlineOffset: '2px',
};

const opRow = { display: 'flex', gap: '0.55rem', padding: '0.18rem 0' };

const opLabel = {
  fontSize: '0.68rem', padding: '2px 7px', alignSelf: 'flex-start',
  background: '#fffefb', border: '1px solid #d6c8a8', borderRadius: '0.3rem',
  fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, color: '#4b5563',
};

const moreBtn = (C) => ({
  width: '100%', marginTop: '0.2rem', padding: '0.6rem',
  background: '#fffefb', border: `1px solid ${C.accentBorder}`,
  borderRadius: '0.5rem', color: '#6b7280', cursor: 'pointer',
  fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
});
