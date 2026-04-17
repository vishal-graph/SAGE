# SIGE — Spatial Intelligence Grid Engine

Web app for floor-plan upload, manual geometry (rooms, walls, doors), grid-based furniture placement, and spatial metrics (circulation, dead space, efficiency).

**Repository:** [github.com/vishal-graph/SAGE](https://github.com/vishal-graph/SAGE)

## Architecture

- **Frontend**: React + Vite + TypeScript, Konva canvas, Zustand state. The **grid is derived** in the browser (`computeGrid`) from geometry + furniture — not stored.
- **Backend**: FastAPI — `POST /metrics/compute` (BFS, global + room metrics), `POST /project/save`, `GET /project/load/{id}`, AI stubs return `501`.

## Quick start

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional: create `frontend/.env` with:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Open `http://localhost:5173`.

## Deployment

### Frontend (Vercel)

- Import `frontend` as a Vercel project (or set project root to `frontend`).
- Vercel config is included at `frontend/vercel.json`.
- Set environment variable in Vercel:
  - `VITE_API_URL=https://<your-render-backend>.onrender.com`
- Deploy. SPA routes are handled by rewrite to `index.html`.

### Backend (Render)

- Render config is included at `backend/render.yaml`.
- Create a new Web Service from this repo with root directory `backend` (or use Blueprint).
- Required/important env vars:
  - `GEMINI_API_KEY` (or Vertex alternatives)
  - `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for Supabase integration)
- Start command used:
  - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

After deploy, point frontend `VITE_API_URL` to the Render public URL.

### Supabase connection

Backend now includes a Supabase connectivity endpoint:

- `GET /supabase/health`

It returns whether Supabase env vars are configured and whether the API is reachable from the backend.
Set these in local `backend/.env` and Render environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

When configured, backend persistence uses Supabase for project payloads, summaries, access, messages, and stage snapshots.

### Redis connection

Backend also includes a Redis connectivity endpoint:

- `GET /redis/health`

Set:

- `REDIS_URL=redis://...`

Redis is used for backend caching (for example link previews).

### Supabase tables for auth + project data/chats/stages

The canonical SQL file is `backend/supabase/001_initial_schema.sql` (run it in the Supabase SQL editor). It includes `auth_users`, `auth_sessions`, `projects`, `project_summaries`, `project_access`, `project_messages`, `project_stages`, and `request_audit_logs`.

To persist project creation data, chat history, and stage snapshots in Supabase, create these tables:

```sql
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
```

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, project save/load, dashboard summaries, access records, messages, and stage snapshots are persisted in Supabase.

### Request audit/reconciliation tracking

Backend now captures per-request audit details for reconciliation:

- timestamp
- request_id (also returned as `X-Request-ID` response header)
- method/path/query/status/duration
- ip and ip_hash
- user-agent and user_agent_hash
- token_hash and resolved auth_user_id (when bearer token is present)
- origin/referer/content-length

Storage:

- Supabase table `request_audit_logs` (if available)
- fallback local file `backend/storage/audit/requests.jsonl`

Recommended env vars:

- `ENABLE_REQUEST_AUDIT=1`
- `AUDIT_HASH_SALT=<strong-random-secret>`
- `TRUST_PROXY_HEADERS=1`

Optional Supabase table:

```sql
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
```

## Workflow

1. **Upload plan** (JPG/PNG/PDF — first page for PDF).
2. **Calibrate**: tool → two clicks on the plan → enter real distance (feet).
3. Set **grid size (ft)** and optional **min path width** for circulation.
4. **Draw rooms** (polygon clicks, then **Close room**), **walls** (drag), **doors** (click cell).
5. **Furniture**: pick a preset and click the floor, or add custom at center.
6. **Compute metrics** (requires backend) → toggle **dead space** / **circulation** overlays.
7. **Export JSON** or **Save server** / **Load server** (JSON under `backend/storage/projects/`).

## Shortcuts

- `Ctrl+Z` / `Ctrl+Y` — undo / redo  
- `R` — rotate selected furniture  
- `Delete` / `Backspace` — remove selected furniture  

## Limits

- Metrics API accepts grids up to **400×400** cells (see `backend/app/models/schemas.py`).
- Larger plans: increase grid size (ft) to reduce cell count.
