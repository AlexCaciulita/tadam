-- Remove placeholder/test profiles requested by admin.
-- This will cascade delete owned albums, media, memberships, reactions, etc.

delete from profiles
where username in (
  'user_98eabedd',
  'user_313e7ee4',
  'user_7eff9906',
  'user_410c39d6',
  'user_d5de6fa5'
);
