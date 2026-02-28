alter table albums
  add column if not exists public_token text;

update albums
set public_token = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
where public_token is null;

alter table albums
  alter column public_token set not null;

create unique index if not exists idx_albums_public_token on albums(public_token);
