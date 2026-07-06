-- ═══════════════════════════════════════════════════════════════
-- 농부 출퇴근 기록 RPC — farm_set_status
--   · farmer_status(현재 상태) 갱신 + farmer_log(기록) 삽입을 한 번에
--   · farmer_log 직접 INSERT는 RLS로 막혀 있어(anon), security definer로 우회
--   · 맵: 아침보고 확정 → 'work'(출근) / '최종 퇴근' 버튼 → 'off'(퇴근)
--   · 손님 VINE OWNER 앱이 farmer_log를 읽어 출퇴근 타임라인으로 표시
--
-- 실행: Supabase → SQL Editor → New query → 전체 붙여넣기 → Run
-- ═══════════════════════════════════════════════════════════════

create or replace function public.farm_set_status(p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  dup_work boolean := false;
begin
  if p_status not in ('work', 'rest', 'off') then
    return;
  end if;

  -- 현재 상태 갱신 (id=1 고정 row)
  update farmer_status set status = p_status, updated_at = now() where id = 1;
  if not found then
    insert into farmer_status(id, status, updated_at) values (1, p_status, now());
  end if;

  -- 출근('work')은 하루 한 번만 기록 (아침보고 재저장해도 중복 안 남김)
  if p_status = 'work' then
    select exists(
      select 1 from farmer_log
      where status = 'work' and (ts at time zone 'Asia/Seoul')::date = today_kst
    ) into dup_work;
    if dup_work then
      return;
    end if;
  end if;

  insert into farmer_log(status, ts) values (p_status, now());
end $$;

grant execute on function public.farm_set_status(text) to anon;
