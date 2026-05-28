// src/components/TreatmentIcons.jsx
// 헤더의 관수/방제 아이콘 + 아이콘 아래 작은 사이클 상태 텍스트
// - SVG 인라인 아이콘 (색상 동적 변경 가능)
// - 평소: 회색 차분
// - 불 켜짐 (간격 도래): 컬러 + 드롭섀도우 글로우 + 펄스 애니메이션
// - 라벨 색도 같이 변화

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { evaluateCycle, formatMD } from '../lib/treatment-cycles';

// ─────────────────────────────────────────────
// 물방울 SVG — 평소 회색, 불 켜짐 시 파랑
// ─────────────────────────────────────────────
function WaterDropIcon({ lit, size = 38 }) {
  const main   = lit ? '#0ea5e9' : '#d1d5db';
  const shine  = lit ? '#bae6fd' : '#f3f4f6';
  const stroke = lit ? '#0369a1' : '#9ca3af';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={shine} />
          <stop offset="100%" stopColor={main}  />
        </linearGradient>
      </defs>
      {/* 물방울 본체 */}
      <path
        d="M20 3.5 C20 3.5, 7.5 16, 7.5 26 C7.5 32.8, 13 36.5, 20 36.5 C27 36.5, 32.5 32.8, 32.5 26 C32.5 16, 20 3.5, 20 3.5 Z"
        fill="url(#dropGrad)"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* 하이라이트 (귀여운 반짝임) */}
      <ellipse cx="14.5" cy="22" rx="2.6" ry="4.5" fill="#ffffff" opacity={lit ? 0.55 : 0.35} />
      <circle cx="13" cy="16" r="1.2" fill="#ffffff" opacity={lit ? 0.7 : 0.4} />
    </svg>
  );
}

// ─────────────────────────────────────────────
// 약병 SVG — 평소 회색, 불 켜짐 시 황금색
// ─────────────────────────────────────────────
function PestBottleIcon({ lit, size = 38 }) {
  const main   = lit ? '#fbbf24' : '#d1d5db';
  const top    = lit ? '#fde68a' : '#e5e7eb';
  const cap    = lit ? '#b45309' : '#9ca3af';
  const accent = lit ? '#ffffff' : '#f9fafb';
  const stroke = lit ? '#92400e' : '#9ca3af';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bottleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={top} />
          <stop offset="100%" stopColor={main} />
        </linearGradient>
      </defs>
      {/* 뚜껑 */}
      <rect x="12.5" y="3.5" width="15" height="6.5" rx="2" fill={cap} />
      {/* 목 */}
      <rect x="15" y="9.5" width="10" height="3" fill={cap} opacity="0.85" />
      {/* 병 본체 — 둥근 어깨 */}
      <path
        d="M9 16 Q9 13, 13 13 L27 13 Q31 13, 31 16 L31 33 Q31 36.5, 27.5 36.5 L12.5 36.5 Q9 36.5, 9 33 Z"
        fill="url(#bottleGrad)"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* 라벨 영역 (흰 배경) */}
      <rect x="12" y="18" width="16" height="14" rx="1.5" fill="#ffffff" opacity={lit ? 0.85 : 0.7} />
      {/* + 십자가 */}
      <rect x="18.6" y="21" width="2.8" height="8" rx="0.5" fill={lit ? '#dc2626' : '#9ca3af'} />
      <rect x="16" y="23.6" width="8" height="2.8" rx="0.5" fill={lit ? '#dc2626' : '#9ca3af'} />
    </svg>
  );
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function TreatmentIcons({ refreshKey = 0, onClickIrrigation, onClickPest }) {
  const [latestIrrDate, setLatestIrrDate] = useState(null);
  const [latestPestDate, setLatestPestDate] = useState(null);
  const [irrCycle, setIrrCycle] = useState(3);
  const [pestCycle, setPestCycle] = useState(7);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [irrRes, pestRes, settingsRes] = await Promise.all([
        supabase.from('daily_notes')
          .select('date').not('irrigation', 'is', null)
          .order('date', { ascending: false }).limit(1),
        supabase.from('daily_notes')
          .select('date').not('pest_treatment', 'is', null)
          .order('date', { ascending: false }).limit(1),
        supabase.from('app_settings')
          .select('key,value').in('key', ['irrigation_cycle_days', 'pest_cycle_days']),
      ]);
      if (!alive) return;
      setLatestIrrDate(irrRes.data?.[0]?.date || null);
      setLatestPestDate(pestRes.data?.[0]?.date || null);
      const settings = Object.fromEntries((settingsRes.data || []).map(r => [r.key, r.value]));
      if (settings.irrigation_cycle_days) setIrrCycle(parseInt(settings.irrigation_cycle_days));
      if (settings.pest_cycle_days) setPestCycle(parseInt(settings.pest_cycle_days));
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  const irrEval = evaluateCycle(latestIrrDate, irrCycle);
  const pestEval = evaluateCycle(latestPestDate, pestCycle);

  const irrLabel = !latestIrrDate ? '시작 전' : `${irrEval.daysPassed}일째`;
  const pestLabel = !latestPestDate ? '시작 전' : `다음 ${formatMD(pestEval.nextDate)}`;

  // 게임 아이템 슬롯 버튼 — 슬롯 안에 SVG 아이콘
  function IconButton({ lit, onClick, ariaLabel, children, litClass }) {
    return (
      <button
        onClick={onClick}
        aria-label={ariaLabel}
        className={`item-slot ${lit ? litClass : ''}`}
      >
        {children}
      </button>
    );
  }

  const labelStyle = (isDue) => ({
    textAlign: 'center',
    fontSize: '0.62rem',
    color: isDue ? '#dc2626' : '#9ca3af',
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    marginTop: '3px',
  });

  // 아이콘 + 라벨 세로 스택 (in-flow로 진짜 공간 차지 → 헤더 균형)
  const stackStyle = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 38,
  };

  return (
    <>
      <div style={stackStyle}>
        <IconButton
          lit={irrEval.isDue}
          onClick={onClickIrrigation}
          ariaLabel="전체관수"
          litClass="lit-blue"
        >
          <WaterDropIcon lit={irrEval.isDue} size={26} />
        </IconButton>
        <span style={labelStyle(irrEval.isDue)}>{irrLabel}</span>
      </div>

      <div style={stackStyle}>
        <IconButton
          lit={pestEval.isDue}
          onClick={onClickPest}
          ariaLabel="전체방제"
          litClass="lit-amber"
        >
          <PestBottleIcon lit={pestEval.isDue} size={26} />
        </IconButton>
        <span style={labelStyle(pestEval.isDue)}>{pestLabel}</span>
      </div>
    </>
  );
}
