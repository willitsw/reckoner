-- Authenticated profile writes may change display_name only.
-- Blank names become null. updated_at is trigger-owned.

create or replace function private.guard_profile_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile_id_immutable' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'profile_created_at_immutable' using errcode = '42501';
  end if;

  if new.plan is distinct from old.plan
     and coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    raise exception 'plan_not_writable' using errcode = '42501';
  end if;

  new.display_name := nullif(btrim(new.display_name), '');

  if new.display_name is not null and char_length(new.display_name) > 80 then
    raise exception 'display_name_too_long' using errcode = '22001';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function private.guard_profile_plan() is
  'Authenticated profile updates may change display_name only. Sets updated_at.';

alter table public.profiles
  drop constraint if exists profiles_display_name_len;

alter table public.profiles
  add constraint profiles_display_name_len
  check (display_name is null or char_length(display_name) <= 80);

comment on column public.profiles.display_name is
  'Optional. Blank is stored as null. Max 80 characters. The only column authenticated clients may change.';
