alter table profiles
  add column if not exists role text not null default 'user';

alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check check (role in ('platform_admin', 'user'));

create index if not exists idx_profiles_role on profiles(role);

update profiles
set role = 'platform_admin'
where username = 'firi1987';
