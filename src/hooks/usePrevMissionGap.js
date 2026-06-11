// src/hooks/usePrevMissionGap.js
// "지난달 포도 미션이 100%가 아닌 채 다음 달로 넘어왔다" → 홈 화면 푸쉬 배너용.
// 왜: 6월 미션을 다 못 깬 채 7월이 되면, 잊지 말라고 빨간 배너로 알려준다(미달일 배너처럼).
//
// 진실(raw)은 manual_items + manual_completions 한 곳뿐 — 달성률은 lib/manual.monthProgress 로 계산.
//   (CLAUDE.md §10: 저장 안 함, 매번 계산.) ManualMissionCard 와 같은 fetch 패턴.
//
// 반환: { gap, refresh }
//   gap = { month, done, total, pct } | null   (지난달에 항목이 있고 100% 미만일 때만 객체)
//   refresh() = 다시 계산 (미션 모달 닫을 때 호출 → 다 채웠으면 배너 사라짐)

import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { logsByItem, monthProgress } from '../lib/manual';

export default function usePrevMissionGap() {
  const curMonth = parseInt(todayKST().split('-')[1], 10);
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;   // 1월이면 작년 12월(전정)

  const [gap, setGap] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: its } = await supabase
        .from('manual_items').select('id').eq('month', prevMonth).eq('archived', false);
      const ids = (its || []).map((i) => i.id);
      if (!ids.length) { if (alive) setGap(null); return; }   // 그 달에 미션 없음 → 배너 없음

      const { data: comps } = await supabase
        .from('manual_completions').select('item_id,author,done_on').in('item_id', ids);
      if (!alive) return;

      const prog = monthProgress(its, logsByItem(comps || []));
      // 항목이 있고 아직 100% 아닐 때만 배너 — 다 채웠으면 null
      setGap(prog.total > 0 && prog.pct < 100 ? { month: prevMonth, ...prog } : null);
    })();
    return () => { alive = false; };
  }, [prevMonth, refreshKey]);

  return { gap, refresh: () => setRefreshKey((k) => k + 1) };
}
