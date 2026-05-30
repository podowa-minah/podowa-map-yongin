// src/components/FarmDiagnosis.jsx
// 아침 브리핑 카드 — 밭 전체 진단을 한눈에 보고 "오늘 일 시작"
// CLAUDE.md §10 Layer 3: 계산은 lib/diagnosis·aiOpinion에서, 여기선 표시만
//
// props:
//   diagnosis   getFarmDiagnosis 결과 { score, scoredCount, totalCount, metrics, watchTrees, watchTotal }
//   varieties   getVarietyAverages 결과 [{ name, score, count }]
//   opinions    generateBriefingOpinions 결과 [{ label, text }]
//   checked     오늘 브리핑 확인했나 (bool)
//   checkedTime "06:42" 같은 확인 시각 (string|null)
//   saving      "오늘 일 시작" 저장 중
//   onStartDay  () => void   — "오늘 일 시작" 클릭
//   onOpenTree  (id) => void — 유심나무 칩 클릭 → 나무카드
//   C           컬러 토큰 (AnalysisPage와 공유)

import { useState } from 'react';
import { scoreBand } from '../lib/scoring';

export default function FarmDiagnosis({
  diagnosis, varieties = [], opinions = [],
  checked = false, checkedTime = null, saving = false,
  onStartDay, onOpenTree, C,
}) {
  const [expanded, setExpanded] = useState(!checked);
  const [openVar, setOpenVar] = useState(null);   // 펼친 품종 이름 (왜 낮은지 보기)
  const d = diagnosis || {};
  const hasData = d.score != null;
  const band = scoreBand(d.score);
  const watch = d.watchTrees || [];

  // 확인 완료 + 접힘 → 슬림 요약 바
  if (checked && !expanded) {
    return (
      <div style={confirmBar}>
        <span style={{ fontWeight: 700, color: '#15803d' }}>✓ 오늘 브리핑 확인</span>
        {checkedTime && <span style={{ color: '#a89968' }}>{checkedTime}</span>}
        <span style={{ color: '#d6c8a8' }}>·</span>
        {hasData && <span style={{ color: C.text }}>밭 {d.score.toFixed(1)}</span>}
        {watch.length > 0 && (
          <span style={{ color: '#b45309' }}>· 유심히 {d.watchTotal}그루</span>
        )}
        <button onClick={() => setExpanded(true)} style={linkBtn}>펼치기 ▾</button>
      </div>
    );
  }

  return (
    <div style={cardWrap}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: '0.9rem' }}>
        <span style={{ fontFamily: C.headlineFont, fontSize: '1.15rem', fontWeight: 700, color: C.text }}>
          ☀️ 오늘의 브리핑
        </span>
        <span style={{ fontSize: '0.72rem', color: '#a89968', marginLeft: 'auto' }}>
          밭 전체 · 지금 기준
        </span>
      </div>

      {/* 🍇 밭 종합점수 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.1rem' }}>
        <div style={{ fontSize: '1.9rem', flexShrink: 0 }}>🍇</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasData ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: C.headlineFont, fontSize: '1.7rem', fontWeight: 700, lineHeight: 1, color: C.text }}>
                {d.score.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#a89968' }}>/ 5.0</span>
              <span style={bandBadge(band)}>{band.label}</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.95rem', color: C.muted }}>점수 기록 없음</div>
          )}
          <div style={{ fontSize: '0.7rem', color: '#a89968', marginTop: '3px' }}>
            {d.scoredCount}/{d.totalCount}그루 평가
          </div>
        </div>
      </div>

      {/* 세력 / 균형 / 해충 — 밭 전체 */}
      <SubTitle>밭 전체 세력·균형·해충</SubTitle>
      <Bar label="세력" value={d.metrics?.power} hint="3.2~3.5 적당" ideal={3.35} C={C} />
      <Bar label="균형" value={d.metrics?.balance} hint="높을수록 좋음" C={C} />
      <Bar label="해충" value={d.metrics?.bugs} hint="낮을수록 좋음" reverse C={C} />

      {/* 품종별 종합 점수 */}
      {varieties.length > 0 && (
        <>
          <SubTitle>품종별 종합 점수 <span style={{ color: '#a89968', fontWeight: 400 }}>(낮은 순 · 눌러서 이유)</span></SubTitle>
          {varieties.map(v => {
            const vb = scoreBand(v.score);
            const m = v.metrics;
            const fmt = (x) => (x != null ? x.toFixed(1) : '–');
            const tip = m
              ? `세력 ${fmt(m.power)} · 균형 ${fmt(m.balance)} · 해충 ${fmt(m.bugs)}${v.reason ? ' → ' + v.reason : ''}`
              : '세부 값 없음';
            const open = openVar === v.name;
            return (
              <div key={v.name}>
                <button
                  type="button"
                  title={tip}
                  onClick={() => setOpenVar(open ? null : v.name)}
                  style={varietyRow}
                >
                  <div style={{ width: '4.6rem', flexShrink: 0, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{v.name}</div>
                  <div style={{ flex: 1, height: '7px', background: '#ede4ce', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v.score / 5) * 100}%`, background: vb.color, borderRadius: '4px' }} />
                  </div>
                  <div style={{ width: '3.4rem', textAlign: 'right', flexShrink: 0, fontWeight: 700, color: C.text }}>
                    {v.score.toFixed(1)}<span style={{ fontSize: '0.7rem', color: '#a89968', fontWeight: 400 }}> ·{v.count}</span>
                  </div>
                  <span style={{ width: '0.8rem', flexShrink: 0, textAlign: 'right', color: '#a89968', fontSize: '0.7rem' }}>{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div style={varietyDetail}>
                    {m ? (
                      <>
                        <span>세력 <b style={{ color: colIdeal(m.power, 3.35) }}>{fmt(m.power)}</b></span>
                        <span>균형 <b style={{ color: colHigher(m.balance) }}>{fmt(m.balance)}</b></span>
                        <span>해충 <b style={{ color: colBugs(m.bugs) }}>{fmt(m.bugs)}</b></span>
                        {v.reason
                          ? <span style={{ color: '#b45309', fontWeight: 700 }}>→ {v.reason}</span>
                          : <span style={{ color: '#15803d', fontWeight: 700 }}>→ 고른 편 👍</span>}
                      </>
                    ) : <span style={{ color: '#a89968' }}>세부 값 없음</span>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ⚠️ 유심히 볼 나무 */}
      <SubTitle>
        ⚠️ 유심히 볼 나무
        {d.watchTotal > 0 && <span style={{ color: '#b45309', marginLeft: 6 }}>{d.watchTotal}그루</span>}
      </SubTitle>
      {watch.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
            {watch.map(w => (
              <button key={w.id} onClick={() => onOpenTree?.(w.id)} style={watchChip} title="나무카드 열기">
                <b style={{ fontWeight: 700 }}>{w.id}</b>
                {w.name && <span style={{ color: '#7c6f4a' }}> {w.name}</span>}
                <span style={{ color: '#b45309', fontWeight: 700, marginLeft: 4 }}>{w.score.toFixed(1)}</span>
                <span style={{ color: '#a8794a', fontSize: '0.66rem', marginLeft: 3 }}>{w.reasons.join('·')}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#a89968' }}>
            번호를 누르면 그 나무 카드가 열려요 · 맵에도 표시됨
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.85rem', color: '#15803d', padding: '0.2rem 0' }}>
          오늘 특별히 처지는 나무는 없어요 👍
        </div>
      )}

      {/* AI 한마디 */}
      {opinions.length > 0 && (
        <>
          <SubTitle>AI 한마디 <span style={{ color: '#a89968', fontWeight: 400 }}>CLAUDE</span></SubTitle>
          {opinions.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.55rem', padding: '0.2rem 0' }}>
              <span style={opLabel}>{o.label}</span>
              <span style={{ fontSize: '0.88rem', lineHeight: 1.5, color: C.text }}>{o.text}</span>
            </div>
          ))}
        </>
      )}

      {/* 오늘 일 시작 / 확인됨 */}
      <button onClick={onStartDay} disabled={saving} style={startBtn(checked)}>
        {checked
          ? `✓ 브리핑 확인됨${checkedTime ? ' · ' + checkedTime : ''} (다시 시작)`
          : (saving ? '확인 중...' : '☀️ 오늘 일 시작')}
      </button>
      {checked && (
        <button onClick={() => setExpanded(false)} style={{ ...linkBtn, display: 'block', margin: '0.5rem auto 0' }}>
          접기 ▴
        </button>
      )}
    </div>
  );
}

// ── 작은 부품 ──────────────────────────────────
function SubTitle({ children }) {
  return (
    <div style={{
      fontSize: '0.78rem', fontWeight: 700, color: '#5f4a1f',
      margin: '1.1rem 0 0.5rem', paddingBottom: '0.25rem',
      borderBottom: '1px solid #ece0c4',
    }}>{children}</div>
  );
}

// ── 지표 색 (세 곳에서 공유: Bar, 품종 세부) ──
const GOOD = '#15803d', BAD = '#dc2626', MID = '#b8a169', NEUTRAL = '#a89968';
const colHigher = (v) => v == null ? NEUTRAL : v >= 3.5 ? GOOD : v >= 2.5 ? MID : BAD;   // 높을수록 좋음
const colBugs = (v) => v == null ? NEUTRAL : v >= 2.5 ? BAD : v >= 1.5 ? MID : GOOD;       // 낮을수록 좋음
const colIdeal = (v, ideal) => {                                                            // 이상점에 가까울수록 좋음
  if (v == null) return NEUTRAL;
  const dist = Math.abs(v - ideal);
  return dist <= 0.5 ? GOOD : dist <= 1.2 ? MID : BAD;
};

function Bar({ label, value, hint, reverse, ideal, C }) {
  const v = (value != null && Number.isFinite(value)) ? value : null;
  const pct = v != null ? Math.min(100, (v / 5) * 100) : 0;
  // 색: 해충(reverse)은 높을수록 빨강, 세력(ideal)은 이상점에서 멀수록 빨강, 나머지는 높을수록 초록
  let color = MID;
  if (v != null) {
    if (ideal != null) color = colIdeal(v, ideal);
    else if (reverse) color = colBugs(v);
    else color = colHigher(v);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
      <div style={{ width: '2.6rem', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem', color: '#5f4a1f' }}>{label}</div>
      <div style={{ flex: 1, height: '8px', background: '#ede4ce', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
        {ideal != null && (
          <div
            title="이상점"
            style={{
              position: 'absolute', top: 0, bottom: 0, left: `${(ideal / 5) * 100}%`,
              width: '2px', background: '#1f2937', opacity: 0.55, transform: 'translateX(-1px)',
            }}
          />
        )}
      </div>
      <div style={{ width: '2.2rem', textAlign: 'right', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem', color: C.text }}>
        {v != null ? v.toFixed(1) : '–'}
      </div>
      <div style={{ width: '4.6rem', flexShrink: 0, fontSize: '0.64rem', color: '#a89968', textAlign: 'right' }}>{hint}</div>
    </div>
  );
}

// ── 스타일 ──────────────────────────────────────
const cardWrap = {
  padding: '1.1rem 1.1rem 1.2rem',
  marginBottom: '1.2rem',
  background: 'linear-gradient(135deg, #fffefb 0%, #fdf6e3 100%)',
  border: '1.5px solid #1f2937',
  borderRadius: '0.7rem',
  boxShadow: '0 2px 8px rgba(120, 90, 30, 0.10)',
};

const confirmBar = {
  display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
  padding: '0.6rem 0.9rem', marginBottom: '1.2rem',
  background: '#f0f9f1', border: '1.5px solid #bbe6c4', borderRadius: '0.6rem',
  fontSize: '0.82rem',
};

const bandBadge = (band) => ({
  fontSize: '0.78rem', padding: '2px 9px',
  background: band.color + '18', color: band.color,
  border: `1px solid ${band.color}50`, borderRadius: '999px', fontWeight: 700,
});

const varietyRow = {
  display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem',
  fontSize: '0.9rem', width: '100%', background: 'none', border: 'none',
  padding: '0.1rem 0', cursor: 'pointer', fontFamily: 'inherit',
};

const varietyDetail = {
  display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center',
  margin: '-0.15rem 0 0.55rem 4.6rem', padding: '0.3rem 0.5rem',
  background: '#fbf6ea', border: '1px solid #ece0c4', borderRadius: '0.4rem',
  fontSize: '0.78rem', color: '#5f4a1f',
};

const watchChip = {
  display: 'inline-flex', alignItems: 'baseline',
  padding: '4px 9px', borderRadius: '999px',
  background: '#fff7ed', border: '1.5px solid #fed7aa',
  color: '#7c2d12', fontSize: '0.78rem', cursor: 'pointer',
  fontFamily: 'inherit', lineHeight: 1.2,
};

const opLabel = {
  fontSize: '0.68rem', padding: '2px 7px', alignSelf: 'flex-start',
  background: '#fffefb', border: '1px solid #d6c8a8', borderRadius: '0.3rem',
  fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, color: '#4b5563',
};

const startBtn = (checked) => ({
  width: '100%', marginTop: '1.1rem', padding: '0.85rem',
  background: checked ? '#f0f9f1' : 'linear-gradient(135deg, #15803d 0%, #047857 100%)',
  color: checked ? '#15803d' : '#fff',
  border: checked ? '1.5px solid #bbe6c4' : 'none',
  borderRadius: '0.6rem', fontSize: '0.98rem', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Arvo, serif',
});

const linkBtn = {
  background: 'none', border: 'none', color: '#a89968',
  fontSize: '0.74rem', cursor: 'pointer', marginLeft: 'auto',
  fontFamily: 'inherit', padding: '2px 4px',
};
