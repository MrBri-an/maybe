create table public.radio_tracks (
  id uuid primary key default gen_random_uuid(),
  uploader_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  artist text check (artist is null or char_length(artist) <= 160),
  personal_note text check (personal_note is null or char_length(personal_note) <= 2000),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg')),
  file_extension text not null check (file_extension in ('mp3', 'm4a', 'aac', 'wav', 'ogg')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index radio_tracks_created_at_idx on public.radio_tracks (created_at desc);
create index radio_tracks_uploader_idx on public.radio_tracks (uploader_user_id);

alter table public.radio_tracks enable row level security;

create policy "Active members can view shared radio tracks"
  on public.radio_tracks for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Active members can insert their own radio tracks"
  on public.radio_tracks for insert to authenticated
  with check (
    uploader_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create policy "Active members can update their own radio tracks"
  on public.radio_tracks for update to authenticated
  using (
    uploader_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    uploader_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create policy "Active members can delete their own radio tracks"
  on public.radio_tracks for delete to authenticated
  using (
    uploader_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create function public.set_radio_tracks_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_radio_tracks_updated_at
before update on public.radio_tracks
for each row execute function public.set_radio_tracks_updated_at();

revoke all on table public.radio_tracks from anon;
revoke all on table public.radio_tracks from authenticated;
grant select (
  id, uploader_user_id, title, artist, personal_note, original_filename,
  mime_type, file_extension, size_bytes, duration_seconds, created_at, updated_at
) on public.radio_tracks to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'radio-audio',
  'radio-audio',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Browser Storage access remains default-deny; protected server operations issue short-lived URLs.

alter table public.user_journey_progress
  add column radio_completed_at timestamptz;

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_location_check,
  add constraint user_journey_progress_last_location_check
    check (last_location in ('world', 'storybook', 'library', 'puzzle_room', 'radio'));

create or replace function public.protect_journey_completion_and_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.storybook_page is distinct from old.storybook_page then new.storybook_page_updated_at = now(); end if;
  if old.storybook_completed_at is not null then new.storybook_completed_at = old.storybook_completed_at; end if;
  if old.library_completed_at is not null then new.library_completed_at = old.library_completed_at; end if;
  if old.puzzle_millionaire_completed_at is not null then new.puzzle_millionaire_completed_at = old.puzzle_millionaire_completed_at; end if;
  if old.puzzle_kculture_completed_at is not null then new.puzzle_kculture_completed_at = old.puzzle_kculture_completed_at; end if;
  if old.puzzle_constellation_completed_at is not null then new.puzzle_constellation_completed_at = old.puzzle_constellation_completed_at; end if;
  if old.puzzle_millionaire_skipped_at is not null then new.puzzle_millionaire_skipped_at = old.puzzle_millionaire_skipped_at; end if;
  if old.puzzle_kculture_skipped_at is not null then new.puzzle_kculture_skipped_at = old.puzzle_kculture_skipped_at; end if;
  if old.puzzle_constellation_skipped_at is not null then new.puzzle_constellation_skipped_at = old.puzzle_constellation_skipped_at; end if;
  if old.puzzle_room_completed_at is not null then new.puzzle_room_completed_at = old.puzzle_room_completed_at; end if;
  if old.radio_completed_at is not null then new.radio_completed_at = old.radio_completed_at; end if;
  new.puzzle_millionaire_best_score = greatest(old.puzzle_millionaire_best_score, new.puzzle_millionaire_best_score);
  new.puzzle_kculture_best_score = greatest(old.puzzle_kculture_best_score, new.puzzle_kculture_best_score);
  if new.puzzle_millionaire_attempt_state is distinct from old.puzzle_millionaire_attempt_state then new.puzzle_millionaire_attempt_updated_at = now(); end if;
  if new.puzzle_kculture_attempt_state is distinct from old.puzzle_kculture_attempt_state then new.puzzle_kculture_attempt_updated_at = now(); end if;
  return new;
end;
$$;
