-- 품종 이름을 나무 라벨(포도맵 = 진실)과 일치시키고, 나무 없는 설정은 숨김.
-- 왜: 품종 = tree_labels.name 이어야 사진·한일·진단이 자동 매칭된다. (minari 확인)
-- 실행: Supabase Dashboard → SQL Editor 에 붙여넣고 Run. 여러 번 돌려도 안전(이미 바뀐 건 그냥 통과).

-- 1) 이름 맞추기 (맵 라벨 기준). 이미 바꾼 함부르크/루비피치도 안전하게 포함(중복 실행 OK).
update public.varieties set name = '함부르크' where name = '머스켓함부르크';
update public.varieties set name = '루비피치' where name = '루비오꾸야마';
update public.varieties set name = '플레임'   where name = '플레임시들리스';
update public.varieties set name = '판타지'   where name = '판타지시들리스';
update public.varieties set name = '루비시들' where name = '루비시들리스';
update public.varieties set name = '매니큐어' where name in ('메니큐어핑거', '매니큐어핑거');
update public.varieties set name = '알렉'     where name = '알렉산드리아';
update public.varieties set name = '블랑블랑' where name = '청하';
update public.varieties set name = '샤인'     where name = '샤인머스캣';

-- 2) 미리보기 — 나무에 없는(= 품종별 종합점수 보고에 안 나오는) 설정. 이게 숨겨질 목록. (거봉계 등)
--    먼저 이 select 만 돌려서 눈으로 확인해도 좋다.
select name from public.varieties
where archived = false
  and name not in (select distinct name from public.tree_labels where coalesce(name, '') <> '');

-- 3) 나무 없는 설정은 숨김(soft-delete · archived = true, 되돌릴 수 있음 — 진짜 삭제 아님).
update public.varieties set archived = true
where name not in (select distinct name from public.tree_labels where coalesce(name, '') <> '');

-- 확인 — 살아있는(보이는) 품종 목록. 전부 나무 라벨과 같은 이름이어야 한다.
select name, subtype, sort_order from public.varieties
where archived = false order by sort_order;
