-- Account isolation and delete. Run against local Supabase: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- Fixed users so assertions stay readable. Signup trigger creates profiles.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'ada@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bea@example.com');

insert into public.processes (id, owner_id, title)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Sourdough'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'Knit');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has row level security'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles forces row level security'
);

select results_eq(
  $$select count(*) from public.profiles where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )$$,
  array[2::bigint],
  'signing up creates a profile'
);

-- No authenticated JWT here, so the plan guard must not block billing.
update public.profiles
set plan = 'paid'
where id = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$select plan from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  array['paid'],
  'plan can change when the caller is not an authenticated client'
);

select ok(
  not has_function_privilege('anon', 'public.delete_own_account()', 'execute'),
  'anon cannot delete an account'
);

select ok(
  has_function_privilege('authenticated', 'public.delete_own_account()', 'execute'),
  'a signed-in user can call delete_own_account'
);

set local role anon;

select throws_ok(
  $$select id from public.profiles$$,
  '42501',
  'permission denied for table profiles',
  'anon cannot read profiles'
);

set local role authenticated;

select throws_ok(
  $$select public.delete_own_account()$$,
  '42501',
  'not_authenticated',
  'delete requires a signed-in user'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  $$select id::text from public.profiles$$,
  array['11111111-1111-4111-8111-111111111111'],
  'sees only their own profile'
);

select is_empty(
  $$select id from public.profiles where id = '22222222-2222-4222-8222-222222222222'$$,
  'cannot read another profile'
);

select results_eq(
  $$update public.profiles
    set display_name = '  Ada Lovelace  ', updated_at = '2000-01-01'
    returning display_name$$,
  $$values ('Ada Lovelace'::text)$$,
  'saves a trimmed name'
);

select ok(
  (select updated_at > timestamptz '2001-01-01' from public.profiles),
  'updated_at is not client-writable'
);

update public.profiles set display_name = '   ';

select ok(
  (select display_name is null from public.profiles),
  'blank name is stored as null'
);

select throws_ok(
  $$update public.profiles set display_name = repeat('a', 81)$$,
  '22001',
  'display_name_too_long',
  'rejects a name longer than 80 characters'
);

select throws_ok(
  $$update public.profiles set plan = 'free'$$,
  '42501',
  'plan_not_writable',
  'signed-in users cannot change plan'
);

select throws_ok(
  $$update public.profiles set id = '22222222-2222-4222-8222-222222222222'$$,
  '42501',
  'profile_id_immutable',
  'profile id is immutable'
);

select throws_ok(
  $$update public.profiles set created_at = '2000-01-01'$$,
  '42501',
  'profile_created_at_immutable',
  'created_at is immutable'
);

select is_empty(
  $$update public.profiles
    set display_name = 'nope'
    where id = '22222222-2222-4222-8222-222222222222'
    returning id$$,
  'cannot update another profile'
);

select throws_ok(
  $$insert into public.profiles (id) values ('55555555-5555-4555-8555-555555555555')$$,
  '42501',
  'permission denied for table profiles',
  'cannot insert a profile'
);

select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  'permission denied for table profiles',
  'cannot delete a profile row directly'
);

select lives_ok(
  $$select public.delete_own_account()$$,
  'signed-in user can delete their account'
);

reset role;

select is_empty(
  $$select id from auth.users where id = '11111111-1111-4111-8111-111111111111'$$,
  'delete removes the auth user'
);

select is_empty(
  $$select id from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  'delete removes the profile'
);

select is_empty(
  $$select id from public.processes where id = '33333333-3333-4333-8333-333333333333'$$,
  'delete removes owned processes'
);

select isnt_empty(
  $$select id from auth.users where id = '22222222-2222-4222-8222-222222222222'$$,
  'delete does not remove the other account'
);

select isnt_empty(
  $$select id from public.processes where id = '44444444-4444-4444-8444-444444444444'$$,
  'delete does not remove the other account''s processes'
);

select * from finish();
rollback;
