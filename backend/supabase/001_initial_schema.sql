-- SIGE — Supabase initial schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query) or via `supabase db push` if you use CLI.
--
-- RLS: If only your FastAPI backend talks to Postgres using SUPABASE_SERVICE_ROLE_KEY,
-- you typically do NOT enable RLS on these tables (service role bypasses RLS). Keep the
-- service role key secret and never ship it to the browser.
-- If you ever expose Supabase to the client (anon key), enable RLS and add policies per table.

-- ---------------------------------------------------------------------------
-- Core app: projects, summaries, access, chat messages, stage snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  project_id text primary key,
  owner_user_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_summaries (
  project_id text primary key,
  owner_user_id text not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_access (
  project_id text primary key,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_messages (
  id text primary key,
  project_id text not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_messages_project_id_created_at
  on public.project_messages(project_id, created_at);

create table if not exists public.project_stages (
  id bigserial primary key,
  project_id text not null,
  saved_by_user_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_stages_project_id_created_at
  on public.project_stages(project_id, created_at);

-- ---------------------------------------------------------------------------
-- Request audit / reconciliation (backend middleware writes these rows)
-- ---------------------------------------------------------------------------

create table if not exists public.request_audit_logs (
  id bigserial primary key,
  timestamp timestamptz not null default now(),
  request_id text not null,
  method text not null,
  path text not null,
  query text,
  status_code int not null,
  duration_ms int not null,
  ip text,
  ip_hash text,
  user_agent text,
  user_agent_hash text,
  auth_user_id text,
  token_hash text,
  origin text,
  referer text,
  content_length text
);

create index if not exists idx_request_audit_request_id on public.request_audit_logs(request_id);
create index if not exists idx_request_audit_timestamp on public.request_audit_logs(timestamp desc);
create index if not exists idx_request_audit_auth_user_id on public.request_audit_logs(auth_user_id);
create index if not exists idx_request_audit_ip_hash on public.request_audit_logs(ip_hash);
