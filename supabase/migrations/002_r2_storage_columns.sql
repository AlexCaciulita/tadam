alter table media
  add column if not exists storage_provider text not null default 'r2',
  add column if not exists storage_key text;

create index if not exists idx_media_storage_key on media(storage_key);
