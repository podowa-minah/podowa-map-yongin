-- Podowa Map (포도와지도) — full schema for new Supabase project
-- Source: dumped from old Supabase (soyung's account) on 2026-05-26
-- Apply in new Supabase: Dashboard → SQL Editor → New query → paste this entire file → Run
--
-- After running this:
--   1. Create Storage bucket "tree-images" with public access (Dashboard → Storage → New bucket)
--   2. Create at least one Auth user (Dashboard → Authentication → Users → Add user)
--   3. Realtime is enabled below for trees / announcements / tree_labels
--
-- NOTE: daily_summaries.date is intentionally `text` (mismatch with daily_notes.date which is `date`).
-- This is a known quirk from original schema — kept as-is for compatibility.

-- ============================================================
-- 1. TABLES
-- ============================================================

create table if not exists public.announcements (
  id serial not null,
  message text not null,
  author text not null,
  created_at timestamp with time zone null default now(),
  pinned boolean null default false,
  deleted boolean null default false,
  constraint announcements_pkey primary key (id)
);

create table if not exists public.daily_notes (
  id bigserial not null,
  date date not null,
  author text null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  constraint daily_notes_pkey primary key (id)
);
create index if not exists daily_notes_date_idx on public.daily_notes using btree (date);

-- daily_notes 확장 — 영농일지가 전체 일별 기록의 중심 (2026-05-28~)
-- 1일 1엔트리(type='journal') 기준, 모든 그날 데이터를 한 행에 통합
alter table public.daily_notes add column if not exists image_urls text[] default '{}';
alter table public.daily_notes add column if not exists thumbnails text[] default '{}';
alter table public.daily_notes add column if not exists weather jsonb default null;
-- 전체관수: {blocks: ['1','3'], duration_minutes: 30, note: '...'}
alter table public.daily_notes add column if not exists irrigation jsonb default null;
-- 전체방제: {chemical: '보르도', dilution: '1000배', method: '연무기', note: '...'}
alter table public.daily_notes add column if not exists pest_treatment jsonb default null;

-- 영농일지 구조화 (2026-05-29): 카테고리별 note + 사진 2장씩
-- { growth: {note, image_urls[], thumbnails[]},
--   env_indoor: {...}, env_outdoor: {...}, pest: {...} }
-- content 컬럼은 "최종 한줄평"으로 재사용. image_urls/thumbnails는 legacy.
alter table public.daily_notes add column if not exists journal_notes jsonb default null;

create table if not exists public.daily_summaries (
  date text not null,
  completed integer not null default 0,
  total integer not null default 0,
  green_dots integer not null default 0,
  workers jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  kind_dots integer null default 0,
  fake_dots integer null default 0,
  constraint daily_summaries_pkey primary key (date)
);

create table if not exists public.grass_records (
  id serial not null,
  tree_id text not null,
  date date not null,
  distribution jsonb not null default '{}'::jsonb,
  dominant_grass text null,
  photo_urls text[] null default '{}'::text[],
  comment text null default ''::text,
  producer text null default ''::text,
  created_at timestamp with time zone null default now(),
  thumbnails text[] null default '{}'::text[],
  constraint grass_records_pkey primary key (id)
);

create table if not exists public.grass_types (
  id serial not null,
  name text not null,
  color text not null,
  created_at timestamp with time zone null default now(),
  constraint grass_types_pkey primary key (id),
  constraint grass_types_name_key unique (name)
);

create table if not exists public.tree_labels (
  id text not null,
  name text null,
  color text null default '#ffffff'::text,
  disabled boolean null default false,
  constraint tree_labels_pkey primary key (id)
);

create table if not exists public.trees (
  id text not null,
  date date not null,
  season integer null,
  power text null,
  balance text null,
  bugs integer null,
  images jsonb null default '[]'::jsonb,
  comments text null,
  season_data jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  producer text null,
  partial_treatment boolean null default false,
  thumbnails text[] null default '{}'::text[],
  archived_at timestamp with time zone null,
  row_id uuid not null default gen_random_uuid (),
  constraint trees_pkey primary key (row_id)
);
create index if not exists idx_trees_archived_at on public.trees using btree (archived_at) where (archived_at is null);
create unique index if not exists trees_active_id_date_unique on public.trees using btree (id, date) where (archived_at is null);

-- Deprecated (legacy) — kept as empty stub so existing code's fetch doesn't error.
-- Safe to drop later once code reference is removed.
create table if not exists public.grass_labels (
  id text not null,
  name text null,
  color text null default '#ffffff'::text,
  disabled boolean null default false,
  constraint grass_labels_pkey primary key (id)
);

-- ============================================================
-- 2. ROW LEVEL SECURITY — authenticated users full CRUD
-- ============================================================

alter table public.announcements    enable row level security;
alter table public.daily_notes      enable row level security;
alter table public.daily_summaries  enable row level security;
alter table public.grass_records    enable row level security;
alter table public.grass_types      enable row level security;
alter table public.tree_labels      enable row level security;
alter table public.trees            enable row level security;
alter table public.grass_labels     enable row level security;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'announcements','daily_notes','daily_summaries',
      'grass_records','grass_types','tree_labels',
      'trees','grass_labels'
    ])
  loop
    execute format(
      'drop policy if exists "authenticated_all" on public.%I',
      t
    );
    execute format(
      'create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 3. REALTIME — enable changefeed for tables the app subscribes to
-- ============================================================

-- App subscribes to: trees, announcements, tree_labels, grass_labels (legacy)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- attempt to add (ignore if already added)
    begin alter publication supabase_realtime add table public.trees;          exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.announcements;  exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.tree_labels;    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.grass_labels;   exception when duplicate_object then null; end;
  end if;
end $$;
