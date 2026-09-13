-- Reckoner v1 data model.
-- Confirmed shape: .plans/data-model.md
-- PowerSync publication is a later slice. Client generates UUID primary keys;
-- gen_random_uuid() is only a fallback when a writer omits id.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free' constraint profiles_plan_check check (plan in ('free', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Account row. plan is not writable by authenticated clients.';

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.guard_profile_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.plan is distinct from old.plan
     and coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    raise exception 'plan_not_writable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_plan
  before update on public.profiles
  for each row
  execute function private.guard_profile_plan();

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- processes
-- ---------------------------------------------------------------------------

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  title text not null default '',
  notes text not null default '',
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint processes_pin_or_archive check (pinned_at is null or archived_at is null)
);

comment on table public.processes is
  'Reusable definition. Shopping lists are this table too. Deleted wins over archived.';
comment on column public.processes.pinned_at is
  'Null means not pinned. Library sorts pinned first.';
comment on column public.processes.archived_at is
  'Hidden from the default library. Still a valid include target.';

create index processes_owner_id_idx on public.processes (owner_id);
create index processes_created_by_idx on public.processes (created_by);
create index processes_updated_by_idx on public.processes (updated_by);

-- ---------------------------------------------------------------------------
-- steps
-- ---------------------------------------------------------------------------

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  position text not null,
  kind text not null default 'action' constraint steps_kind_check check (kind in ('action', 'heading', 'note')),
  optional boolean not null default false,
  body text not null default '',
  notes text not null default '',
  url text,
  child_process_id uuid references public.processes (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint steps_not_self_include check (child_process_id is distinct from process_id),
  constraint steps_optional_is_action check (optional = false or kind = 'action'),
  constraint steps_include_is_action check (child_process_id is null or kind = 'action'),
  constraint steps_url_http check (url is null or url ~* '^https?://')
);

comment on table public.steps is
  'An include is an action with child_process_id. The same child may be included more than once. position is a client fractional rank, not unique.';
comment on column public.steps.position is
  'Lexicographic rank. Do not unique-constrain; sort ties by id.';
comment on column public.steps.optional is
  'Only actions. Optional steps do not block parent completion.';

create index steps_process_id_position_idx on public.steps (process_id, position);
create index steps_child_process_id_idx on public.steps (child_process_id) where child_process_id is not null;
create index steps_owner_id_idx on public.steps (owner_id);
create index steps_created_by_idx on public.steps (created_by);
create index steps_updated_by_idx on public.steps (updated_by);

create or replace function private.copy_owner_from_process()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  found_owner uuid;
begin
  select p.owner_id
    into found_owner
  from public.processes p
  where p.id = new.process_id;

  if found_owner is null then
    raise exception 'process_not_found' using errcode = '23503';
  end if;

  new.owner_id := found_owner;
  return new;
end;
$$;

-- Rejects cycles, deleted targets, cross-owner includes, and graphs deeper than 16.
create or replace function private.guard_step_include()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_owner uuid;
  child_owner uuid;
  child_deleted timestamptz;
  has_cycle boolean;
  too_deep boolean;
begin
  if tg_op = 'UPDATE'
     and new.child_process_id is not distinct from old.child_process_id
     and new.deleted_at is not distinct from old.deleted_at then
    return new;
  end if;

  if new.child_process_id is null or new.deleted_at is not null then
    return new;
  end if;

  select p.owner_id
    into parent_owner
  from public.processes p
  where p.id = new.process_id;

  if parent_owner is null then
    raise exception 'process_not_found' using errcode = '23503';
  end if;

  select p.owner_id, p.deleted_at
    into child_owner, child_deleted
  from public.processes p
  where p.id = new.child_process_id;

  if child_owner is null then
    raise exception 'include_target_not_found' using errcode = '23503';
  end if;

  if child_deleted is not null then
    raise exception 'include_deleted' using errcode = '23514';
  end if;

  if child_owner is distinct from parent_owner then
    raise exception 'include_owner' using errcode = '23514';
  end if;

  with recursive walk as (
    select s.child_process_id as process_id, 1 as depth
    from public.steps s
    where s.process_id = new.child_process_id
      and s.child_process_id is not null
      and s.deleted_at is null
    union all
    select s.child_process_id, w.depth + 1
    from walk w
    join public.steps s
      on s.process_id = w.process_id
     and s.child_process_id is not null
     and s.deleted_at is null
    where w.depth < 16
  )
  select
    exists (select 1 from walk where process_id = new.process_id),
    exists (select 1 from walk where depth >= 16)
    into has_cycle, too_deep;

  if has_cycle then
    raise exception 'include_cycle' using errcode = '23514';
  end if;

  if too_deep then
    raise exception 'include_depth' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger steps_copy_owner
  before insert or update of process_id on public.steps
  for each row
  execute function private.copy_owner_from_process();

create trigger steps_guard_include
  before insert or update of child_process_id, deleted_at, process_id on public.steps
  for each row
  execute function private.guard_step_include();

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  process_id uuid not null references public.processes (id) on delete cascade,
  step_id uuid references public.steps (id) on delete cascade,
  kind text not null constraint media_assets_kind_check check (kind in ('image', 'audio')),
  storage_path text not null,
  content_type text,
  byte_size bigint constraint media_assets_byte_size_check check (byte_size is null or byte_size >= 0),
  caption text not null default '',
  position text not null,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_assets_cover_is_image check (is_cover = false or kind = 'image')
);

comment on table public.media_assets is
  'Inserted only after upload. storage_path is {owner_id}/{id} and is not the ACL. Cover is not unique; UI picks latest updated_at.';
comment on column public.media_assets.process_id is
  'Always set, even when the file is attached to a step.';
comment on column public.media_assets.is_cover is
  'Last-write-wins. Do not unique-constrain.';

create index media_assets_process_id_idx on public.media_assets (process_id);
create index media_assets_step_id_idx on public.media_assets (step_id) where step_id is not null;
create index media_assets_owner_id_idx on public.media_assets (owner_id);
create index media_assets_created_by_idx on public.media_assets (created_by);
create index media_assets_updated_by_idx on public.media_assets (updated_by);
create index media_assets_cover_idx on public.media_assets (process_id, updated_at desc) where is_cover and deleted_at is null;

create or replace function private.guard_media_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  step_process uuid;
begin
  if new.step_id is null then
    return new;
  end if;

  select s.process_id
    into step_process
  from public.steps s
  where s.id = new.step_id;

  if step_process is null then
    raise exception 'step_not_found' using errcode = '23503';
  end if;

  if step_process is distinct from new.process_id then
    raise exception 'media_step_process_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger media_assets_copy_owner
  before insert or update of process_id on public.media_assets
  for each row
  execute function private.copy_owner_from_process();

create trigger media_assets_guard_parent
  before insert or update of process_id, step_id on public.media_assets
  for each row
  execute function private.guard_media_parent();

-- ---------------------------------------------------------------------------
-- runs and checks
-- ---------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  process_id uuid not null references public.processes (id) on delete cascade,
  status text not null constraint runs_status_check check (status in ('in_progress', 'completed', 'discarded')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runs_completed_at_matches_status check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

comment on table public.runs is
  'Only completion model, including one-off lists. At most one in_progress row per owner and process. Checking boxes does not change status.';

create index runs_owner_id_idx on public.runs (owner_id);
create index runs_process_id_idx on public.runs (process_id);
create index runs_created_by_idx on public.runs (created_by);
create index runs_updated_by_idx on public.runs (updated_by);

create unique index runs_one_in_progress_idx
  on public.runs (owner_id, process_id)
  where status = 'in_progress';

create trigger runs_copy_owner
  before insert or update of process_id on public.runs
  for each row
  execute function private.copy_owner_from_process();

create table public.run_checks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  run_id uuid not null references public.runs (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  occurrence_path text not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint run_checks_path_matches_step check (
    occurrence_path ~ '^(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})+$'
    and occurrence_path like '%/' || step_id::text
  ),
  constraint run_checks_run_path_unique unique (run_id, occurrence_path)
);

comment on table public.run_checks is
  'A row means checked. Uncheck deletes the row. occurrence_path distinguishes the same child included twice. Headings and notes cannot be checked.';

create index run_checks_step_id_idx on public.run_checks (step_id);
create index run_checks_owner_id_idx on public.run_checks (owner_id);
create index run_checks_created_by_idx on public.run_checks (created_by);
create index run_checks_updated_by_idx on public.run_checks (updated_by);

create or replace function private.prepare_run_check()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_owner uuid;
  step_owner uuid;
  step_kind text;
begin
  new.occurrence_path := lower(new.occurrence_path);

  select r.owner_id
    into run_owner
  from public.runs r
  where r.id = new.run_id;

  if run_owner is null then
    raise exception 'run_not_found' using errcode = '23503';
  end if;

  select s.owner_id, s.kind
    into step_owner, step_kind
  from public.steps s
  where s.id = new.step_id;

  if step_owner is null then
    raise exception 'step_not_found' using errcode = '23503';
  end if;

  if step_kind is distinct from 'action' then
    raise exception 'check_not_action' using errcode = '23514';
  end if;

  if step_owner is distinct from run_owner then
    raise exception 'check_owner' using errcode = '23514';
  end if;

  new.owner_id := run_owner;
  return new;
end;
$$;

create trigger run_checks_prepare
  before insert or update of run_id, step_id, occurrence_path on public.run_checks
  for each row
  execute function private.prepare_run_check();

-- ---------------------------------------------------------------------------
-- access helpers
-- v1 body is ownership. Sharing later widens these functions, not every policy.
-- ---------------------------------------------------------------------------

create or replace function private.can_read_process(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.processes p
    where p.id = target
      and p.owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_write_process(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_process(target);
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.guard_profile_plan() from public;
revoke all on function private.copy_owner_from_process() from public;
revoke all on function private.guard_step_include() from public;
revoke all on function private.guard_media_parent() from public;
revoke all on function private.prepare_run_check() from public;
revoke all on function private.can_read_process(uuid) from public;
revoke all on function private.can_write_process(uuid) from public;

grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on function private.guard_profile_plan() to authenticated, service_role;
grant execute on function private.copy_owner_from_process() to authenticated, service_role;
grant execute on function private.guard_step_include() to authenticated, service_role;
grant execute on function private.guard_media_parent() to authenticated, service_role;
grant execute on function private.prepare_run_check() to authenticated, service_role;
grant execute on function private.can_read_process(uuid) to authenticated, service_role;
grant execute on function private.can_write_process(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- Indexed owner_id predicate, wrapped auth.uid(). Helpers exist for the next
-- widening; policies call them so a sharing change is one function body.
-- SELECT is required for UPDATE. WITH CHECK blocks owner reassignment.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.processes enable row level security;
alter table public.steps enable row level security;
alter table public.media_assets enable row level security;
alter table public.runs enable row level security;
alter table public.run_checks enable row level security;

alter table public.profiles force row level security;
alter table public.processes force row level security;
alter table public.steps force row level security;
alter table public.media_assets force row level security;
alter table public.runs force row level security;
alter table public.run_checks force row level security;

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy processes_select
  on public.processes
  for select
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_read_process(id)));

create policy processes_insert
  on public.processes
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy processes_update
  on public.processes
  for update
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(id)))
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(id))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy processes_delete
  on public.processes
  for delete
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(id)));

create policy steps_select
  on public.steps
  for select
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_read_process(process_id)));

create policy steps_insert
  on public.steps
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy steps_update
  on public.steps
  for update
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)))
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy steps_delete
  on public.steps
  for delete
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)));

create policy media_assets_select
  on public.media_assets
  for select
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_read_process(process_id)));

create policy media_assets_insert
  on public.media_assets
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy media_assets_update
  on public.media_assets
  for update
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)))
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy media_assets_delete
  on public.media_assets
  for delete
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)));

create policy runs_select
  on public.runs
  for select
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_read_process(process_id)));

create policy runs_insert
  on public.runs
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy runs_update
  on public.runs
  for update
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)))
  with check (
    owner_id = (select auth.uid())
    and (select private.can_write_process(process_id))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy runs_delete
  on public.runs
  for delete
  to authenticated
  using (owner_id = (select auth.uid()) and (select private.can_write_process(process_id)));

create policy run_checks_select
  on public.run_checks
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy run_checks_insert
  on public.run_checks
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (created_by is null or created_by = (select auth.uid()))
    and exists (
      select 1
      from public.runs r
      where r.id = run_id
        and r.owner_id = (select auth.uid())
        and (select private.can_write_process(r.process_id))
    )
  );

create policy run_checks_update
  on public.run_checks
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy run_checks_delete
  on public.run_checks
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Data API grants. anon gets nothing. No insert/delete on profiles.
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.processes to authenticated;
grant select, insert, update, delete on public.steps to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert, update, delete on public.runs to authenticated;
grant select, insert, update, delete on public.run_checks to authenticated;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.processes to service_role;
grant select, insert, update, delete on public.steps to service_role;
grant select, insert, update, delete on public.media_assets to service_role;
grant select, insert, update, delete on public.runs to service_role;
grant select, insert, update, delete on public.run_checks to service_role;

-- ---------------------------------------------------------------------------
-- private media bucket. Path {owner_id}/{id}. The first folder is the v1
-- storage ACL so a collaborator policy can be added later without moving files.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

create policy media_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy media_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy media_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy media_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
