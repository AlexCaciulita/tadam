-- =============================================
-- Tadam Database Schema (No Auth)
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
create table if not exists profiles (
  id uuid primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- =============================================
-- ALBUMS
-- =============================================
create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  join_code char(6) unique not null,
  is_private boolean default true not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  cover_image_url text,
  created_at timestamptz default now() not null
);

-- =============================================
-- ALBUM MEMBERS
-- =============================================
create table if not exists album_members (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade,
  guest_name text,
  role text check (role in ('owner', 'member', 'guest')) default 'guest' not null,
  joined_at timestamptz default now() not null,
  unique(album_id, user_id)
);

-- =============================================
-- MEDIA
-- =============================================
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums(id) on delete cascade not null,
  uploader_id uuid references profiles(id) on delete set null,
  guest_name text,
  file_url text not null,
  thumbnail_url text,
  media_type text check (media_type in ('photo', 'video')) default 'photo' not null,
  width int,
  height int,
  file_size bigint,
  created_at timestamptz default now() not null
);

-- =============================================
-- REACTIONS
-- =============================================
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  media_id uuid references media(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade,
  guest_name text,
  type text default 'heart' not null,
  created_at timestamptz default now() not null
);

-- =============================================
-- MEDIA TASKS (Prompt Engine)
-- =============================================
create table if not exists media_tasks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums(id) on delete cascade not null,
  title text not null,
  created_by uuid references profiles(id) on delete set null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  message text not null,
  related_album_id uuid references albums(id) on delete cascade,
  related_media_id uuid references media(id) on delete cascade,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- =============================================
-- FRIENDSHIPS
-- =============================================
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  friend_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at timestamptz default now() not null,
  unique(user_id, friend_id)
);

-- =============================================
-- STORAGE BUCKET
-- =============================================
-- Run this separately in Supabase Dashboard > Storage
-- Create a bucket called 'media' with public access

-- =============================================
-- REALTIME
-- =============================================
-- Enable realtime for these tables in Supabase Dashboard > Database > Replication
-- Tables: media, reactions, notifications, album_members

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_albums_owner on albums(owner_id);
create index if not exists idx_albums_join_code on albums(join_code);
create index if not exists idx_album_members_album on album_members(album_id);
create index if not exists idx_album_members_user on album_members(user_id);
create index if not exists idx_media_album on media(album_id);
create index if not exists idx_media_created on media(created_at desc);
create index if not exists idx_reactions_media on reactions(media_id);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_read on notifications(user_id, is_read);
create index if not exists idx_friendships_user on friendships(user_id);
create index if not exists idx_friendships_friend on friendships(friend_id);
create index if not exists idx_media_tasks_album on media_tasks(album_id);
