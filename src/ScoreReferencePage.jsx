// src/ScoreReferencePage.jsx
// 점수기준 (정적 페이지) — 세력/균형/해충 등급표 + 종합점수 공식
// 디자인: 뉴스레터/잡지 풍 — 세리프 헤드라인 + 깔끔한 표

import { WEIGHTS } from './lib/scoring';

const POWER_LEVELS = [
  { num: 1, score: 1.0, name: '매우 약함', desc: '잎이 노랗거나 말라감. 즉시 원인 파악.' },
  { num: 2, score: 2.5, name: '약함',     desc: '잎 작거나 옅음. 뻗는 힘 부족.' },
  { num: 3, score: 5.0, name: '적정 ★',   desc: '힘 있되 과하지 않음. 결실에 양분 가는 상태.', highlight: true },
  { num: 4, score: 4.0, name: '셈',       desc: '살짝 과함. 가지치기로 조절 가능.' },
  { num: 5, score: 2.5, name: '매우 셈',  desc: '영양 과잉. 당도·향 영향.' },
];

const BALANCE_LEVELS = [
  { num: 1, score: 1.0, name: '심각 불균형', desc: '수형 무너짐. 시급.' },
  { num: 2, score: 2.0, name: '불균형',     desc: '한쪽 쏠림.' },
  { num: 3, score: 3.0, name: '보통',       desc: '다음 가지치기 때 교정.' },
  { num: 4, score: 4.0, name: '좋음',       desc: '살짝 치우침, 문제없음.' },
  { num: 5, score: 5.0, name: '매우 좋음 ★', desc: '사방 고르게, 손볼 게 없음.', highlight: true },
];

const BUG_LEVELS = [
  { num: 0, score: 5.0, name: '깨끗 ★', desc: '흔적 없음.', highlight: true },
  { num: 1, score: 4.0, name: '양호',   desc: '개미 몇 마리. 관찰만.' },
  { num: 2, score: 3.0, name: '주의',   desc: '소수 발견, 확산 안 됨.' },
  { num: 3, score: 2.5, name: '경계',   desc: '여러 잎·가지 피해. 부분방제 검토.' },
  { num: 4, score: 1.5, name: '심함',   desc: '나무 전체 확산. 부분방제 즉시.' },
  { num: 5, score: 0.5, name: '매우 심함', desc: '수세 악영향. 전체 방제.' },
];

function LevelTable({ title, subtitle, levels }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{
        fontFamily: 'Arvo, serif', fontSize: '1.4rem', fontWeight: 700,
        margin: '0 0 0.3rem', color: '#1f2937',
        borderBottom: '1.5px solid #1f2937', paddingBottom: '0.3rem',
      }}>{title}</h2>
      <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 0.8rem' }}>
        {subtitle}
      </p>
      <div>
        {levels.map(lv => (
          <div key={lv.num} style={{
            display: 'flex', alignItems: 'baseline', gap: '0.6rem',
            padding: '0.4rem 0.6rem', marginBottom: '0.15rem',
            background: lv.highlight ? '#f0fdf4' : 'transparent',
            borderRadius: '0.3rem',
          }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', width: '1rem', flexShrink: 0 }}>
              {lv.num}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af', width: '2.2rem', flexShrink: 0 }}>
              {lv.score.toFixed(1)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1f2937' }}>
                {lv.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.1rem' }}>
                {lv.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ScoreReferencePage() {
  return (
    <div style={{
      maxWidth: '560px', margin: '0 auto',
      padding: '1.5rem 1.2rem 4rem',
      color: '#1f2937',
    }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: 'Arvo, serif',
          fontSize: '2rem', fontWeight: 700, margin: '0 0 0.3rem',
        }}>점수 기준</h1>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
          Podowa Standard · 2026
        </p>
      </header>

      <LevelTable
        title="나무 세력"
        subtitle="줄기 굵기 · 잎 크기 · 잎 색 · 새 가지 뻗는 힘"
        levels={POWER_LEVELS}
      />

      <LevelTable
        title="나무 균형도"
        subtitle="가지 분포 · 수형 · 한쪽 치우침"
        levels={BALANCE_LEVELS}
      />

      <LevelTable
        title="해충관리"
        subtitle="작년 기록: 개미 활동은 깍지벌레를 약 2주 선행"
        levels={BUG_LEVELS}
      />

      {/* 종합점수 공식 */}
      <section style={{
        marginTop: '2rem', padding: '1rem',
        background: '#fffefb', border: '1.5px solid #d6c8a8',
        borderRadius: '0.5rem',
      }}>
        <h3 style={{
          fontFamily: 'Arvo, serif',
          fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#1f2937',
        }}>종합점수 공식</h3>
        <div style={{
          fontFamily: 'Arvo, serif',
          fontSize: '1rem', margin: '0.3rem 0 0.7rem',
          color: '#1f2937',
        }}>
          세력 × {WEIGHTS.power} + 균형 × {WEIGHTS.balance} + 해충 × {WEIGHTS.bugs}
        </div>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 0.8rem' }}>
          각 항목의 변환점수(위 표 기준)에 가중치를 곱해 합산. 최고 5.0점.
        </p>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem' }}>
          <div>
            <div style={{ color: '#1f2937', fontWeight: 700 }}>세력</div>
            <div style={{ color: '#9ca3af' }}>{WEIGHTS.power}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>수확 근본</div>
          </div>
          <div>
            <div style={{ color: '#1f2937', fontWeight: 700 }}>균형</div>
            <div style={{ color: '#9ca3af' }}>{WEIGHTS.balance}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>시각 품질</div>
          </div>
          <div>
            <div style={{ color: '#1f2937', fontWeight: 700 }}>해충</div>
            <div style={{ color: '#9ca3af' }}>{WEIGHTS.bugs}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>확산 위험</div>
          </div>
        </div>
      </section>
    </div>
  );
}
