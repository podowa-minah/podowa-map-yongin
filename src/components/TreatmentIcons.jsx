// src/components/TreatmentIcons.jsx
// 헤더의 물/약 아이콘 + 아이콘 바로 아래 작은 사이클 상태 텍스트
//   "3일째" (마지막 관수로부터)
//   "다음 4/29" (방제 권장 다음 시행일)
//   기록 없으면 "시작 전"
//   사이클 도달 시 빨강

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { evaluateCycle, formatMD } from '../lib/treatment-cycles';
import IconLink from './IconLink';
import waterlink from '../assets/icons/global_water_small.png';
import trtlink from '../assets/icons/global_trt_small.png';

export default function TreatmentIcons({ refreshKey = 0, onClickIrrigation, onClickPest }) {
  const [latestIrr, setLatestIrr] = useState(null);
  const [latestPest, setLatestPest] = useState(null);
  const [irrCycle, setIrrCycle] = useState(3);
  const [pestCycle, setPestCycle] = useState(7);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, b, s] = await Promise.all([
        supabase.from('irrigations').select('date').order('date', { ascending: false }).limit(1),
        supabase.from('pest_treatments').select('date').order('date', { ascending: false }).limit(1),
        supabase.from('app_settings').select('key,value').in('key', ['irrigation_cycle_days', 'pest_cycle_days']),
      ]);
      if (!alive) return;
      setLatestIrr(a.data?.[0] || null);
      setLatestPest(b.data?.[0] || null);
      const settings = Object.fromEntries((s.data || []).map(r => [r.key, r.value]));
      if (settings.irrigation_cycle_days) setIrrCycle(parseInt(settings.irrigation_cycle_days));
      if (settings.pest_cycle_days) setPestCycle(parseInt(settings.pest_cycle_days));
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  const irrEval = evaluateCycle(latestIrr?.date, irrCycle);
  const pestEval = evaluateCycle(latestPest?.date, pestCycle);

  const irrLabel = !latestIrr ? '시작 전' : `${irrEval.daysPassed}일째`;
  const pestLabel = !latestPest ? '시작 전' : `다음 ${formatMD(pestEval.nextDate)}`;

  const labelStyle = (isDue) => ({
    fontSize: '0.62rem',
    color: isDue ? '#dc2626' : '#9ca3af',
    fontWeight: 600,
    lineHeight: 1,
    marginTop: '2px',
    whiteSpace: 'nowrap',
  });

  // 두 아이콘 폭/높이 통일 → 라벨 baseline 자동 정렬
  const wrapperStyle = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    width: 42,
    height: 56,
  };
  const iconBoxStyle = {
    height: 38,
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <>
      <div style={wrapperStyle}>
        <div style={iconBoxStyle}>
          <IconLink href="#" src={waterlink} alt="전체관수" size={38}
            onClick={(e) => { e.preventDefault(); onClickIrrigation?.(); }} />
        </div>
        <span style={labelStyle(irrEval.isDue)}>{irrLabel}</span>
      </div>
      <div style={wrapperStyle}>
        <div style={iconBoxStyle}>
          <IconLink href="#" src={trtlink} alt="전체방제" size={38}
            onClick={(e) => { e.preventDefault(); onClickPest?.(); }} />
        </div>
        <span style={labelStyle(pestEval.isDue)}>{pestLabel}</span>
      </div>
    </>
  );
}
