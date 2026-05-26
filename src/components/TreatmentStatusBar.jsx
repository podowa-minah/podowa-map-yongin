// src/components/TreatmentStatusBar.jsx
// 헤더 아이콘 줄 바로 아래에 떠있는 status bar
// 3줄: 최근 관수 / 최근 방제 / 이번 달 환경 주의사항
//
// 데이터는 Supabase에서 직접 조회 (가벼움)
// 모달 저장 후 새로고침되도록 refreshKey prop 받음

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { evaluateCycle, formatMD, todayKST } from '../lib/treatment-cycles';

export default function TreatmentStatusBar({ refreshKey = 0, onClickIrrigation, onClickPest }) {
  const [latestIrr, setLatestIrr] = useState(null);
  const [latestPest, setLatestPest] = useState(null);
  const [envCaution, setEnvCaution] = useState(null);
  const [irrCycle, setIrrCycle] = useState(3);
  const [pestCycle, setPestCycle] = useState(7);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = todayKST();
      const [y, m] = today.split('-').map(Number);

      const [irrResp, pestResp, envResp, settingsResp] = await Promise.all([
        supabase.from('irrigations').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('pest_treatments').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('env_cautions').select('note').eq('year', y).eq('month', m).maybeSingle(),
        supabase.from('app_settings').select('key,value').in('key', ['irrigation_cycle_days', 'pest_cycle_days']),
      ]);

      if (!alive) return;

      setLatestIrr(irrResp.data?.[0] || null);
      setLatestPest(pestResp.data?.[0] || null);
      setEnvCaution(envResp.data?.note || null);

      const settings = Object.fromEntries((settingsResp.data || []).map(r => [r.key, r.value]));
      if (settings.irrigation_cycle_days) setIrrCycle(parseInt(settings.irrigation_cycle_days));
      if (settings.pest_cycle_days) setPestCycle(parseInt(settings.pest_cycle_days));
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  const irrEval = evaluateCycle(latestIrr?.date, irrCycle);
  const pestEval = evaluateCycle(latestPest?.date, pestCycle);

  const irrText = !latestIrr
    ? '아직 관수 기록 없음'
    : `${formatMD(latestIrr.date)} · ${(latestIrr.blocks || []).join(',')}동 ${latestIrr.duration_minutes}분`;

  const pestText = !latestPest
    ? '아직 방제 기록 없음'
    : `${formatMD(latestPest.date)} · ${latestPest.chemical}${latestPest.dilution ? ' ' + latestPest.dilution : ''}`;

  const rowStyle = (isDue) => ({
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.35rem 0.7rem',
    fontSize: '0.88rem',
    color: isDue ? '#92400e' : '#4b5563',
    backgroundColor: isDue ? '#fef3c7' : 'transparent',
    cursor: 'pointer',
    borderRadius: '0.4rem',
    transition: 'background-color 0.15s ease',
  });

  return (
    <div style={{
      padding: '0.4rem 0.6rem 0.5rem',
      backgroundColor: '#faf7f0',
      borderTop: '1px solid #f0ebe0',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }}>
      {/* 관수 라인 */}
      <div onClick={onClickIrrigation} style={rowStyle(irrEval.isDue)}>
        <span style={{ fontSize: '1rem' }}>💧</span>
        <span style={{ fontWeight: 600 }}>{irrText}</span>
        {irrEval.hasRecord && (
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: irrEval.isDue ? '#b45309' : '#9ca3af' }}>
            {irrEval.daysPassed}일째 (사이클 {irrCycle}일)
          </span>
        )}
      </div>

      {/* 방제 라인 */}
      <div onClick={onClickPest} style={rowStyle(pestEval.isDue)}>
        <span style={{ fontSize: '1rem' }}>💊</span>
        <span style={{ fontWeight: 600 }}>{pestText}</span>
        {pestEval.hasRecord && (
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: pestEval.isDue ? '#b45309' : '#9ca3af' }}>
            {pestEval.daysPassed}일째 (사이클 {pestCycle}일)
          </span>
        )}
      </div>

      {/* 환경 주의사항 (이번 달, 있을 때만) */}
      {envCaution && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 0.7rem',
          fontSize: '0.88rem',
          color: '#7c2d12',
          backgroundColor: '#fee2e2',
          borderRadius: '0.4rem',
        }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ fontWeight: 600 }}>이번 달:</span>
          <span>{envCaution}</span>
        </div>
      )}
    </div>
  );
}
