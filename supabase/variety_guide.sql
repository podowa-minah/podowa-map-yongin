-- ============================================================
-- Podowa — 품종별 재배 가이드 (연간 생육밴드 · 송이관리 · 사진/영상)
-- ============================================================
-- Supabase SQL Editor에 그대로 붙여넣고 Run하면 끝.
-- 재실행해도 안전 (IF NOT EXISTS / ON CONFLICT).
-- 기존 데이터는 하나도 건드리지 않음.
--
-- 설계 (CLAUDE.md §10 준수):
--   varieties        = 품종 마스터 (이름/만생도/송이관리 스펙)   ← 진실, 수정 가능
--   variety_guides   = 품종 × 월 칸의 사진/영상/가이드 한 장씩    ← 진실
--   생육단계(착과기 등)는 저장하지 않고 월(month)에서 계산한다 (src/lib/variety-guide.js).
--   송이관리 스펙은 품종과 1:1 이라 varieties.cluster_spec(jsonb)에 같이 둔다 (새 테이블 안 만듦).
-- ============================================================

-- 1) 품종 마스터 — 추가/수정/삭제(soft) 가능
CREATE TABLE IF NOT EXISTS public.varieties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,                     -- 품종명 (예: 샤인머스캣)
  subtype      text,                              -- 만생도 (조생/중생/만생 등, 선택)
  cluster_spec jsonb NOT NULL DEFAULT '{}'::jsonb, -- 송이관리: {b7,s,u,t,lf1,lf2,sz,sa,ta}
  sort_order   integer NOT NULL DEFAULT 0,        -- 표시 순서
  archived     boolean NOT NULL DEFAULT false,    -- soft-delete (기록 보존)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT varieties_name_key UNIQUE (name)
);
CREATE INDEX IF NOT EXISTS varieties_sort_idx
  ON public.varieties(sort_order) WHERE archived = false;

-- 2) 품종별 가이드 한 장 — (품종 × 월) 칸의 사진/영상/가이드 메모
CREATE TABLE IF NOT EXISTS public.variety_guides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id  uuid NOT NULL REFERENCES public.varieties(id) ON DELETE CASCADE,
  month       integer NOT NULL CHECK (month BETWEEN 1 AND 12),  -- 1~12 (연간 생육밴드 칸)
  title       text,                              -- 짧은 제목 (선택)
  detail      text,                              -- 자세한 가이드 (선택)
  image_urls  text[] NOT NULL DEFAULT '{}',      -- 원본 사진 URL
  thumbnails  text[] NOT NULL DEFAULT '{}',      -- 썸네일 URL (tree-images 버킷 재사용)
  video_url   text,                              -- 짧은 영상 (선택)
  sort_order  integer NOT NULL DEFAULT 0,        -- 같은 칸 안에서 정렬
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS variety_guides_lookup_idx
  ON public.variety_guides(variety_id, month);

-- ============================================================
-- 3) 시드 — 품종 13개 + 송이관리 스펙(2024 기준, 있는 것만)
--    송이관리 데이터 없는 품종(샤인/홍이두 등)은 cluster_spec = {}
-- ============================================================
INSERT INTO public.varieties (name, subtype, sort_order, cluster_spec) VALUES
  ('흑바라드',      NULL,     1,  '{"b7":"세력 강하게","s":"X","u":"X","t":"X","lf1":"8잎","lf2":"10잎","sz":"12cm","sa":"O","ta":"O"}'),
  ('플레임시들리스', NULL,     2,  '{"b7":"세력 강하게","s":"O","u":"X","t":"X","lf1":"9잎","lf2":"11잎","sz":"13cm","sa":"-","ta":"O"}'),
  ('판타지시들리스', NULL,     3,  '{"b7":"세력 강하게","s":"O","u":"O","t":"X","lf1":"9잎","lf2":"11잎","sz":"12cm","sa":"-","ta":"O"}'),
  ('거봉계',        NULL,     4,  '{"b7":"1) 송이크기조절 7cm, 어깨·윗지경·송이끝단\n2) 일주일 전 적심(송이 다음 한 잎 남기고) — 2023년 5/17 작업","s":"O","u":"O","t":"O","lf1":"6잎","lf2":"8잎","sz":"-","sa":"-","ta":"X"}'),
  ('루비시들리스',   NULL,     5,  '{"b7":"지경을 다듬어 세력을 키워줌","s":"O","u":"O","t":"O","lf1":"9잎","lf2":"11잎","sz":"10cm","sa":"-","ta":"O"}'),
  ('메니큐어핑거',   NULL,     6,  '{"b7":"","s":"O","u":"X","t":"O","lf1":"8잎","lf2":"10잎","sz":"10cm","sa":"-","ta":"O"}'),
  ('머스켓함부르크', '만생',    7,  '{"b7":"천천히 지켜본다","s":"X","u":"X","t":"X","lf1":"8잎","lf2":"10잎","sz":"12cm","sa":"O","ta":"O"}'),
  ('알렉산드리아',   NULL,     8,  '{"b7":"세력 강하게 / 송이가 가늘어나면 송이끝 절단","s":"O","u":"O","t":"O","lf1":"10잎","lf2":"12잎","sz":"10cm","sa":"-","ta":"O"}'),
  ('루비오꾸야마',   NULL,     9,  '{"b7":"세력 강하게","s":"X","u":"X","t":"X","lf1":"8잎","lf2":"10잎","sz":"10cm","sa":"O","ta":"O"}'),
  ('이탈리아',      NULL,     10, '{"b7":"세력 강하게","s":"X","u":"X","t":"X","lf1":"8잎","lf2":"10잎","sz":"10cm","sa":"O","ta":"O"}'),
  ('청하',         NULL,     11, '{"b7":"","s":"X","u":"X","t":"O","lf1":"8잎","lf2":"10잎","sz":"12cm","sa":"-","ta":"O"}'),
  ('샤인머스캣',    '중·만생', 12, '{}'),
  ('홍이두',        '조생',    13, '{}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- RLS — 로그인 사용자 CRUD 허용 (기존 테이블과 동일 패턴)
-- ============================================================
ALTER TABLE public.varieties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "varieties_authenticated_all" ON public.varieties;
CREATE POLICY "varieties_authenticated_all" ON public.varieties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.variety_guides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "variety_guides_authenticated_all" ON public.variety_guides;
CREATE POLICY "variety_guides_authenticated_all" ON public.variety_guides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime — 한 사람이 가이드 고치면 다른 농부 화면도 자동 갱신
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.varieties;      EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.variety_guides; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
