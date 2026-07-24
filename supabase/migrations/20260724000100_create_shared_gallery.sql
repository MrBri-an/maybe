create table public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) between 1 and 1024),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  media_kind text not null check (media_kind in ('image', 'video')),
  mime_type text not null check (mime_type in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  )),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  title text check (title is null or char_length(title) <= 160),
  caption text check (caption is null or char_length(caption) <= 2000),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint gallery_media_kind_size_check check (
    (media_kind = 'image' and file_size_bytes <= 26214400)
    or (media_kind = 'video' and file_size_bytes <= 209715200)
  ),
  constraint gallery_media_kind_mime_check check (
    (media_kind = 'image' and mime_type like 'image/%')
    or (media_kind = 'video' and mime_type like 'video/%')
  )
);

create index gallery_media_active_created_idx
  on public.gallery_media (created_at desc)
  where archived_at is null;
create index gallery_media_uploader_idx
  on public.gallery_media (uploader_user_id);

create function public.protect_gallery_media()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Gallery memories must be archived, not deleted';
  end if;
  if new.id is distinct from old.id
    or new.uploader_user_id is distinct from old.uploader_user_id
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
    or new.media_kind is distinct from old.media_kind
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.duration_seconds is distinct from old.duration_seconds
    or new.created_at is distinct from old.created_at then
    raise exception 'Gallery memory ownership and file identity are immutable';
  end if;
  if old.archived_at is not null and new.archived_at is distinct from old.archived_at then
    raise exception 'Archived Gallery memories remain archived';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_gallery_media
before update or delete on public.gallery_media
for each row execute function public.protect_gallery_media();

alter table public.gallery_media enable row level security;

create policy "Active members can view active shared Gallery media"
  on public.gallery_media for select to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Active members can insert their own Gallery media"
  on public.gallery_media for insert to authenticated
  with check (
    uploader_user_id = (select auth.uid())
    and archived_at is null
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Uploaders can edit or archive their Gallery media"
  on public.gallery_media for update to authenticated
  using (
    uploader_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  )
  with check (
    uploader_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

revoke all on table public.gallery_media from anon, authenticated;
grant select (
  id, original_filename, media_kind, mime_type, file_size_bytes, title, caption,
  width, height, duration_seconds, created_at, updated_at, archived_at
) on public.gallery_media to authenticated;
grant update (title, caption, archived_at) on public.gallery_media to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-media',
  'gallery-media',
  false,
  209715200,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Browser Storage access remains default-deny. Authorized server operations create
-- random owner-scoped paths and short-lived signed URLs without exposing paths.

alter table public.user_journey_progress
  add column gallery_completed_at timestamptz;

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_location_check,
  add constraint user_journey_progress_last_location_check
    check (last_location in (
      'world',
      'storybook',
      'library',
      'puzzle_room',
      'radio',
      'question_garden',
      'gallery'
    ));

-- The schema-resilient protect_journey_completion_and_timestamps() function
-- validates every real *_completed_at field, including gallery_completed_at.
