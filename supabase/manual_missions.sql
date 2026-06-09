-- ============================================================
-- Podowa — 이달의 포도 미션 (월별 재배 매뉴얼 + 했어요 체크)
-- ============================================================
-- Supabase SQL Editor에 그대로 붙여넣고 Run하면 끝.
-- 재실행해도 안전 (IF NOT EXISTS / ON CONFLICT).
-- 기존 데이터는 하나도 건드리지 않음.
--
-- 설계 (CLAUDE.md §10 준수):
--   manual_items        = 미션 원본 (월/범주/제목/노하우)  ← 진실
--   manual_completions  = "했어요" 누른 기록 한 줄씩        ← 진실(이벤트 로그)
--   횟수·날짜·달성률은 저장하지 않고 manual_completions에서 계산한다.
--   안내 한마디는 기존 app_settings(key-value)에 manual_guide_<월> 로 저장.
-- ============================================================

-- 1) 미션 원본 (월 × 범주 × 항목)
CREATE TABLE IF NOT EXISTS public.manual_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month       integer NOT NULL CHECK (month BETWEEN 1 AND 12),   -- 1~12
  category    text    NOT NULL CHECK (category IN ('water','pest','grow','env','soil')),
                       -- water=물관리 pest=방제관리 grow=재배관리 env=환경관리 soil=토양관리
  title       text    NOT NULL,                  -- 할 일 (예: "흰가루방제 주 2회")
  detail      text,                              -- 자세한 노하우 (선택)
  sort_order  integer NOT NULL DEFAULT 0,        -- 같은 달/범주 안에서 정렬
  archived    boolean NOT NULL DEFAULT false,    -- soft-delete (기록 보존)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_items_month_idx
  ON public.manual_items(month) WHERE archived = false;

-- 2) "했어요" 기록 — 한 번 누를 때마다 한 줄. 반복하면 줄이 쌓인다(= 더 좋음).
CREATE TABLE IF NOT EXISTS public.manual_completions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES public.manual_items(id) ON DELETE CASCADE,
  author      text NOT NULL,                     -- 누가 (로그인 닉네임/이메일)
  done_on     date NOT NULL DEFAULT current_date,-- 언제 (도장에 찍히는 날짜)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_completions_item_idx
  ON public.manual_completions(item_id);
CREATE INDEX IF NOT EXISTS manual_completions_done_on_idx
  ON public.manual_completions(done_on DESC);

-- 3) 월별 안내 한마디 — 기존 app_settings 재사용 (새 테이블 안 만듦)
--    key = manual_guide_<월>, value = 메시지.  프로토타입 문구로 초기 seed.
INSERT INTO public.app_settings (key, value) VALUES
  ('manual_guide_4', '맹아·꽃샘추위 관리에 만전을. 첫 물은 넉넉히 시작!'),
  ('manual_guide_5', '개화기엔 온도·과습이 핵심. 한날한시에 꽃 피우기.'),
  ('manual_guide_6', '이번 달, 했어요 체크에 최선을 다해주세요! 흰가루·차먼지응애 놓치지 말기.'),
  ('manual_guide_7', '장마·성숙기. 착색이 품질을 좌우해요. 환기 꼭 유지!')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS — 로그인 사용자 CRUD 허용 (기존 테이블과 동일 패턴)
-- ============================================================
ALTER TABLE public.manual_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_items_authenticated_all" ON public.manual_items;
CREATE POLICY "manual_items_authenticated_all" ON public.manual_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.manual_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_completions_authenticated_all" ON public.manual_completions;
CREATE POLICY "manual_completions_authenticated_all" ON public.manual_completions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime — 한 농부가 체크하면 다른 농부 화면도 자동 갱신(농장 공통 진도)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_items;       EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_completions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
