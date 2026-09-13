-- Signed-in user can permanently delete their own auth user.
-- Privileged body stays in private. public.delete_own_account is the Data API entry.

create or replace function private.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Auth delete does not cascade storage objects. Remove this user's files first
  -- so a later upload cannot block deleting the auth user.
  delete from storage.objects
  where owner = uid
     or owner_id = uid::text
     or (
       bucket_id = 'media'
       and (storage.foldername(name))[1] = uid::text
     );

  delete from auth.users
  where id = uid;
end;
$$;

comment on function private.delete_own_account() is
  'Deletes auth.uid() and their media objects. Cascades profiles and owned content.';

revoke all on function private.delete_own_account() from public;
grant execute on function private.delete_own_account() to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.delete_own_account();
end;
$$;

comment on function public.delete_own_account() is
  'Permanently deletes the signed-in account. Callable only as that user.';

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
