// src/components/PestManager.jsx
// 나무 개별차트의 "해충관리" — 벌레별로 골라 0~5점. (TreeModal 보호파일 규칙 §2: 새 컴포넌트로 분리)
//   · 나무에 왔을 때: 어떤 벌레가 몇 점인지 큰 알림 (가장 센 놈 먼저) — 밭에서 덥게 봐도 색으로 바로.
//   · 입력 2탭: 벌레 카드 → 큰 0~5 숫자.  · 벌레 추가 가능.
//   · 값은 부모(treeData.season_data.pests)로 올리고, bugs = max(벌레점수)로 동기화(알고리즘 불변).
// 톤앤매너: TreeModal ratingBtnStyle/평가 카드와 동일.  점수 색만 심각도별(직관성, minari 요청).
import { useState } from 'react';
import {
  DEFAULT_PESTS, PEST_COLORS, PEST_SHADOWS, worstPest, pestAlertBand, pestSeverityText,
} from '../lib/pests';

export default function PestManager({ pests = {}, onChange }) {
  const [extra, setExtra] = useState([]);          // 이번에 새로 추가한 벌레 이름(0점이라도 화면엔 유지)
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [sel, setSel] = useState(() => {
    const w = worstPest(pests);
    return w ? w.name : DEFAULT_PESTS[0];
  });

  const names = [...new Set([...DEFAULT_PESTS, ...extra, ...Object.keys(pests)])];
  const scoreOf = (n) => (pests[n] == null ? null : Number(pests[n]));  // null=안 건드림, 0~5=눌러서 기록됨

  const setScore = (n, v) => {
    onChange?.({ ...pests, [n]: v });   // 0도 눌러서 기록('깨끗' 확인). 완전히 빼려면 removePest
  };
  const removePest = (n) => {
    const next = { ...pests };
    delete next[n];
    onChange?.(next);
  };
  const addPest = () => {
    const v = newName.trim();
    if (!v) return;
    if (!names.includes(v)) setExtra((e) => [...e, v]);
    setSel(v);
    setNewName('');
    setAdding(false);
  };

  const w = worstPest(pests);
  const band = pestAlertBand(w ? w.score : 0);
  const others = w
    ? names.filter((n) => n !== w.name && scoreOf(n) > 0).map((n) => `${n} ${scoreOf(n)}`)
    : [];

  const sc = scoreOf(sel);
  // 이 나무에 담긴 벌레(점수>0) — 장바구니처럼. 센 순서로.
  const cart = names.filter((n) => scoreOf(n) > 0).sort((a, b) => scoreOf(b) - scoreOf(a));

  return (
    <div style={{ marginBottom: '0.45rem' }}>
      <label style={{ color: '#4b5563', fontWeight: 500 }}>🐛 해충관리</label>

      {/* 나무에 왔을 때 알림 — 가장 센 벌레 먼저 */}
      <div style={{
        marginLeft: '0.5rem', marginTop: '0.35rem', marginBottom: '0.6rem',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        borderRadius: '0.9rem', padding: '0.7rem 0.8rem',
        border: `1.5px solid ${band.bd}`, background: band.bg, color: band.tx,
      }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1, flex: '0 0 auto' }}>{band.em}</span>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.15 }}>
            {w ? `${w.name} ${w.score}점 — ${pestSeverityText(w.score)}` : '이 나무는 깨끗해요'}
          </div>
          {w
            ? (others.length > 0 && <div style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>같이 볼 것 · {others.join(' · ')}</div>)
            : <div style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>오늘 급한 벌레 없음</div>}
        </div>
      </div>

      {/* 어떤 벌레? — 골라서 (자리 고정) */}
      <div style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.35rem' }}>
        어떤 벌레? <span style={{ color: '#b9b3a6' }}>(눌러서 고르기)</span>
      </div>
      <div style={{ marginLeft: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {names.map((n) => {
          const s = scoreOf(n);
          const on = n === sel;
          return (
            <button
              key={n}
              onClick={() => setSel(n)}
              style={{
                position: 'relative', flex: '1 1 0', minWidth: 64,
                padding: '0.6rem 0.3rem', borderRadius: '0.7rem',
                border: on ? '3px solid #16a34a' : '2px solid #e2e8f0',
                background: on ? '#f0fdf4' : '#fff',
                color: on ? '#14532d' : '#1f2937',
                fontSize: '1rem', fontWeight: on ? 700 : 500, cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              {n}
              {s > 0 && (
                <span style={{
                  position: 'absolute', top: -9, right: -6,
                  minWidth: 20, height: 20, lineHeight: '20px', padding: '0 3px',
                  borderRadius: 999, background: PEST_COLORS[s], color: '#fff',
                  fontSize: '0.72rem', fontWeight: 700,
                }}>{s}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => { setAdding((a) => !a); }}
          style={{
            flex: '0 0 auto', minWidth: 52, padding: '0.6rem 0.5rem', borderRadius: '0.7rem',
            border: '2px dashed #cdbdf0', background: '#faf7ff', color: '#7c3aed',
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
          }}
        >＋추가</button>
      </div>

      {adding && (
        <div style={{ marginLeft: '0.5rem', marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPest(); }}
            placeholder="새 벌레 이름 (예: 꽃매미)"
            maxLength={8}
            autoFocus
            style={{
              flex: 1, fontSize: '1rem', border: '2px solid #cdbdf0',
              borderRadius: '0.6rem', padding: '0.55rem 0.7rem', boxSizing: 'border-box',
            }}
          />
          <button onClick={addPest} style={{
            fontSize: '0.95rem', fontWeight: 700, border: 'none', borderRadius: '0.6rem',
            padding: '0 1rem', background: '#7c3aed', color: '#fff', cursor: 'pointer',
          }}>추가</button>
        </div>
      )}

      {/* 몇 점? — 큰 0~5 (심각도 색) */}
      <div style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: '#6b7280', margin: '0.7rem 0 0.35rem' }}>
        <b style={{ color: '#16a34a', fontWeight: 700 }}>{sel}</b> 몇 점?
      </div>
      <div style={{ marginLeft: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'nowrap' }}>
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const on = n === sc;   // sc=null(안 건드림)이면 아무것도 안 눌림, 눌러서 0~5 기록되면 그 버튼만
          return (
            <button
              key={n}
              onClick={() => setScore(sel, n)}
              style={{
                flex: '1 1 0', minWidth: 0, padding: '0.85rem 0', fontSize: '1.2rem', textAlign: 'center',
                borderRadius: '0.7rem', cursor: 'pointer', transition: 'all 0.1s ease',
                border: on ? `3px solid ${PEST_COLORS[n]}` : '2px solid #e2e8f0',
                background: on ? PEST_COLORS[n] : '#fff',
                color: on ? '#fff' : '#1f2937',
                fontWeight: on ? 700 : 400,
                boxShadow: on ? `0 4px 0 ${PEST_SHADOWS[n]}` : 'none',
              }}
            >{n}</button>
          );
        })}
      </div>
      <div style={{ marginLeft: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.35rem' }}>
        <span>0 · 깨끗</span><span>5 · 가장 심함 🔴</span>
      </div>

      {/* 이 나무에 담긴 벌레 — 장바구니처럼 쌓임 (센 순, ✕로 빼기) */}
      <div style={{ marginLeft: '0.5rem', marginTop: '0.8rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>
          🧺 오늘 이 나무에 담긴 벌레{cart.length > 0 && <b style={{ color: '#4b5563', fontWeight: 700, marginLeft: 4 }}>{cart.length}</b>}
        </div>
        {cart.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#b9b3a6' }}>아직 없어요 — 위에서 벌레 골라 점수 주면 여기 쌓여요</div>
        ) : (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {cart.map((n) => {
              const s = scoreOf(n);
              return (
                <span key={n} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  background: '#fff', border: `1.5px solid ${PEST_COLORS[s]}`,
                  borderRadius: 999, padding: '0.25rem 0.3rem 0.25rem 0.65rem',
                }}>
                  <span onClick={() => setSel(n)} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#3a382f', cursor: 'pointer' }}>{n}</span>
                  <span style={{
                    minWidth: 19, height: 19, lineHeight: '19px', textAlign: 'center',
                    borderRadius: 999, background: PEST_COLORS[s], color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                  }}>{s}</span>
                  <button onClick={() => removePest(n)} aria-label={`${n} 빼기`} style={{
                    border: 'none', background: 'transparent', color: '#b0a99a', fontSize: '0.9rem', lineHeight: 1, cursor: 'pointer', padding: '0 2px',
                  }}>✕</button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
