-- ============================================================
-- Podowa — 전체관수 / 전체방제 / 월별 주의사항 / 앱 설정
-- ============================================================
-- Supabase SQL Editor에 그대로 붙여넣고 Run하면 끝.
-- 재실행해도 안전 (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- 1) 전체관수 기록
CREATE TABLE IF NOT EXISTS public.irrigations (
  id            bigserial PRIMARY KEY,
  date          date NOT NULL,
  blocks        text[] NOT NULL,              -- ['1','2','3','4']
  duration_minutes integer NOT NULL,           -- 10~120
  note          text,
  producer      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS irrigations_date_idx ON public.irrigations(date DESC);

-- 2) 전체방제 기록
CREATE TABLE IF NOT EXISTS public.pest_treatments (
  id            bigserial PRIMARY KEY,
  date          date NOT NULL,
  chemical      text NOT NULL,                 -- 약제명 (예: J인섹터, 보르도, 자유텍스트)
  dilution      text,                          -- 배율 (예: 1000배)
  method        text,                          -- 방식 (연무기/동력분무기/자유텍스트)
  note          text,
  producer      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pest_treatments_date_idx ON public.pest_treatments(date DESC);

-- 3) 환경 주의사항 (월별)
--    예: 5월 "응애·총채 집중 연무기" / 6월 "폭염주간"
CREATE TABLE IF NOT EXISTS public.env_cautions (
  id            bigserial PRIMARY KEY,
  year          integer NOT NULL,
  month         integer NOT NULL,              -- 1~12
  note          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
CREATE INDEX IF NOT EXISTS env_cautions_ym_idx ON public.env_cautions(year, month);

-- 4) 앱 설정 (사이클 일수 등)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key           text PRIMARY KEY,
  value         text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- 초기 사이클 값 (이미 있으면 무시)
INSERT INTO public.app_settings (key, value) VALUES
  ('irrigation_cycle_days', '3'),
  ('pest_cycle_days', '7')
ON CONFLICT (key) DO NOTHING;

-- 5) daily_notes 에 type 컬럼 추가 (작업 히스토리에서 '오늘의 작업 요약' vs '달성률 미달 사유' 구분용)
ALTER TABLE public.daily_notes ADD COLUMN IF NOT EXISTS type text DEFAULT 'summary';
-- 가능한 값: 'summary' (오늘의 작업 요약) | 'incomplete_reason' (달성률 미달 사유)


-- ============================================================
-- RLS (Row Level Security) — 로그인 사용자 CRUD 허용
-- ============================================================

ALTER TABLE public.irrigations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "irrigations_authenticated_all" ON public.irrigations;
CREATE POLICY "irrigations_authenticated_all" ON public.irrigations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.pest_treatments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pest_treatments_authenticated_all" ON public.pest_treatments;
CREATE POLICY "pest_treatments_authenticated_all" ON public.pest_treatments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.env_cautions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "env_cautions_authenticated_all" ON public.env_cautions;
CREATE POLICY "env_cautions_authenticated_all" ON public.env_cautions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_authenticated_all" ON public.app_settings;
CREATE POLICY "app_settings_authenticated_all" ON public.app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- Realtime (선택 — 다중 사용자 시 자동 동기화)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.irrigations;     EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pest_treatments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.env_cautions;   EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
