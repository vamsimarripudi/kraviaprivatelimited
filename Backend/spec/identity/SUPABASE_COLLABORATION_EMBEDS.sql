-- KRAVIA Office — request collaboration and governed embed registry
-- Reproduces hosted collaboration/embed controls. Contains no user-specific IDs or secrets.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
('request.comment','WORKFLOW','COMMENT','Comment on requests','Add immutable collaboration comments to requests the user is already authorised to participate in.','STANDARD',false,false,true),
('integration.embed.view','INTEGRATIONS','VIEW','View embedded workspace','View an approved HTTPS embedded workspace when the registry entry requires this permission.','SENSITIVE',false,false,true),
('integration.embed.manage','INTEGRATIONS','MANAGE','Manage embedded workspaces','Register, enable or disable approved embedded workspace destinations.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'request.comment','ALLOW','OWN' from public.office_access_profile_catalog where active=true
on conflict(profile_code,permission_code) do update set effect='ALLOW',default_scope_type='OWN';

create table if not exists public.office_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.office_requests(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists office_request_comments_request_created_idx on public.office_request_comments(request_id,created_at);
create index if not exists office_request_comments_author_idx on public.office_request_comments(author_user_id);
alter table public.office_request_comments enable row level security;
revoke all on public.office_request_comments from anon,authenticated,public;
drop policy if exists office_request_comments_deny_client_access on public.office_request_comments;
create policy office_request_comments_deny_client_access on public.office_request_comments as restrictive for all to anon,authenticated using(false) with check(false);
create or replace function public.office_block_request_comment_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'KRAVIA Office request comments are immutable'; end; $$;
drop trigger if exists office_request_comments_immutable on public.office_request_comments;
create trigger office_request_comments_immutable before update or delete on public.office_request_comments for each row execute function public.office_block_request_comment_mutation();

create table if not exists public.office_embed_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,80}$'),
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text,
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  allowed_host text not null check (allowed_host ~ '^[A-Za-z0-9.-]+$'),
  required_permission text not null references public.office_permission_catalog(code),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_embed_catalog_permission_status_idx on public.office_embed_catalog(required_permission,status);
alter table public.office_embed_catalog enable row level security;
revoke all on public.office_embed_catalog from anon,authenticated,public;
drop policy if exists office_embed_catalog_deny_client_access on public.office_embed_catalog;
create policy office_embed_catalog_deny_client_access on public.office_embed_catalog as restrictive for all to anon,authenticated using(false) with check(false);
create or replace function public.office_embed_touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists office_embed_touch_trigger on public.office_embed_catalog;
create trigger office_embed_touch_trigger before update on public.office_embed_catalog for each row execute function public.office_embed_touch();

comment on table public.office_request_comments is 'Immutable role-and-participation scoped collaboration attached to governed Office requests.';
comment on table public.office_embed_catalog is 'Server-only registry of explicitly approved HTTPS workspace embeds with exact host and permission gates.';
