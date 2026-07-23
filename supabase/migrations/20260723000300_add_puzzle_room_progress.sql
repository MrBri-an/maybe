alter table public.user_journey_progress
  add column puzzle_millionaire_completed_at timestamptz,
  add column puzzle_kculture_completed_at timestamptz,
  add column puzzle_constellation_completed_at timestamptz,
  add column puzzle_millionaire_skipped_at timestamptz,
  add column puzzle_kculture_skipped_at timestamptz,
  add column puzzle_constellation_skipped_at timestamptz,
  add column puzzle_millionaire_best_score smallint not null default 0 check (puzzle_millionaire_best_score between 0 and 15),
  add column puzzle_kculture_best_score smallint not null default 0 check (puzzle_kculture_best_score between 0 and 15),
  add column puzzle_millionaire_attempt_state jsonb default null,
  add column puzzle_millionaire_attempt_updated_at timestamptz,
  add column puzzle_kculture_attempt_state jsonb default null,
  add column puzzle_kculture_attempt_updated_at timestamptz,
  add column puzzle_room_completed_at timestamptz;

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_location_check,
  add constraint user_journey_progress_last_location_check
    check (last_location in ('world', 'storybook', 'library', 'puzzle_room'));

create or replace function public.protect_journey_completion_and_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.storybook_page is distinct from old.storybook_page then
    new.storybook_page_updated_at = now();
  end if;
  if old.storybook_completed_at is not null then new.storybook_completed_at = old.storybook_completed_at; end if;
  if old.library_completed_at is not null then new.library_completed_at = old.library_completed_at; end if;
  if old.puzzle_millionaire_completed_at is not null then new.puzzle_millionaire_completed_at = old.puzzle_millionaire_completed_at; end if;
  if old.puzzle_kculture_completed_at is not null then new.puzzle_kculture_completed_at = old.puzzle_kculture_completed_at; end if;
  if old.puzzle_constellation_completed_at is not null then new.puzzle_constellation_completed_at = old.puzzle_constellation_completed_at; end if;
  if old.puzzle_millionaire_skipped_at is not null then new.puzzle_millionaire_skipped_at = old.puzzle_millionaire_skipped_at; end if;
  if old.puzzle_kculture_skipped_at is not null then new.puzzle_kculture_skipped_at = old.puzzle_kculture_skipped_at; end if;
  if old.puzzle_constellation_skipped_at is not null then new.puzzle_constellation_skipped_at = old.puzzle_constellation_skipped_at; end if;
  if old.puzzle_room_completed_at is not null then new.puzzle_room_completed_at = old.puzzle_room_completed_at; end if;
  new.puzzle_millionaire_best_score = greatest(old.puzzle_millionaire_best_score, new.puzzle_millionaire_best_score);
  new.puzzle_kculture_best_score = greatest(old.puzzle_kculture_best_score, new.puzzle_kculture_best_score);
  if new.puzzle_millionaire_attempt_state is distinct from old.puzzle_millionaire_attempt_state then new.puzzle_millionaire_attempt_updated_at = now(); end if;
  if new.puzzle_kculture_attempt_state is distinct from old.puzzle_kculture_attempt_state then new.puzzle_kculture_attempt_updated_at = now(); end if;
  return new;
end;
$$;
