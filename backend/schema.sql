-- ============================================================
-- salesrun — Supabase SQL Schema
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================

-- 1. Organisations
create table if not exists orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz default now()
);

-- 2. Users (admins + reps)
create table if not exists users (
  id         uuid primary key,                          -- matches auth.users.id
  org_id     uuid not null references orgs(id) on delete cascade,
  full_name  text,
  role       text not null check (role in ('admin', 'rep')),
  created_at timestamptz default now()
);

-- 3. Invite codes (admin generates, rep consumes)
create table if not exists invite_codes (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references orgs(id) on delete cascade,
  code      text not null unique,
  used      boolean default false,
  used_by   uuid references users(id),
  created_at timestamptz default now()
);

-- 4. KB documents (metadata only — files live in Supabase Storage)
create table if not exists kb_documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  filename    text not null,
  file_type   text not null check (file_type in ('pdf', 'csv')),
  storage_path text not null,
  chunk_count  integer default 0,
  uploaded_at  timestamptz default now()
);

-- 5. Leads (one row per buyer chat session)
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  session_id       text not null unique,
  persona          text,
  intent_score     integer default 0,
  intent_state     text default 'Exploring' check (intent_state in ('Exploring', 'Comparing', 'Decision-Ready')),
  signals          jsonb default '[]'::jsonb,
  resources_served jsonb default '[]'::jsonb,
  conversation     jsonb default '[]'::jsonb,
  assigned_rep_id  uuid references users(id),
  crm_filed        boolean default false,
  github_issue_url text,
  calendly_shown   boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 6. Integrations (one row per org)
create table if not exists integrations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null unique references orgs(id) on delete cascade,
  frappe_url     text,
  frappe_token   text,
  github_repo    text,
  github_pat     text,
  calendly_link  text,
  created_at     timestamptz default now()
);

-- ============================================================
-- Indexes for common queries
-- ============================================================

create index if not exists idx_users_org_id on users(org_id);
create index if not exists idx_leads_org_id on leads(org_id);
create index if not exists idx_leads_session_id on leads(session_id);
create index if not exists idx_leads_assigned_rep on leads(assigned_rep_id);
create index if not exists idx_invite_codes_code on invite_codes(code);
create index if not exists idx_kb_documents_org_id on kb_documents(org_id);
create index if not exists idx_orgs_slug on orgs(slug);

-- ============================================================
-- Auto-update updated_at on leads
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row
  execute function update_updated_at();

-- ============================================================
-- Done! Now go to Storage and create a bucket named:
--   kb-documents  (set to private)
-- ============================================================
