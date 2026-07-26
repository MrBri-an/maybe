create table public.maybe_day_activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  prompt text not null check (char_length(prompt) between 1 and 1200),
  category text not null check (category in (
    'conversation', 'creative', 'games', 'music', 'photos', 'watch-together'
  )),
  icon_key text not null check (icon_key ~ '^[a-z0-9-]+$'),
  estimated_minutes smallint check (estimated_minutes between 5 and 480),
  requires_voice boolean not null default false,
  requires_video boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.maybe_day_draws (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.maybe_day_activities(id) on delete restrict,
  selected_by_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'selected' check (status in ('selected', 'started', 'completed', 'skipped')),
  selected_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  skip_reason text check (skip_reason is null or char_length(skip_reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maybe_day_draw_status_timestamps check (
    (status = 'selected' and started_at is null and completed_at is null and skipped_at is null)
    or (status = 'started' and started_at is not null and completed_at is null and skipped_at is null)
    or (status = 'completed' and started_at is not null and completed_at is not null and skipped_at is null)
    or (status = 'skipped' and completed_at is null and skipped_at is not null)
  )
);

create unique index maybe_day_draws_one_active
  on public.maybe_day_draws ((true))
  where status in ('selected', 'started');

create index maybe_day_draws_recent_activity
  on public.maybe_day_draws (selected_at desc, activity_id);

create table public.maybe_day_checkins (
  draw_id uuid not null references public.maybe_day_draws(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (draw_id, user_id)
);

create table public.maybe_day_comments (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.maybe_day_draws(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index maybe_day_comments_active_draw
  on public.maybe_day_comments (draw_id, created_at)
  where archived_at is null;

create table public.maybe_day_hearts (
  draw_id uuid not null references public.maybe_day_draws(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (draw_id, user_id)
);

create function public.set_maybe_days_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_maybe_day_draws_updated_at
before update on public.maybe_day_draws
for each row execute function public.set_maybe_days_updated_at();

create trigger set_maybe_day_checkins_updated_at
before update on public.maybe_day_checkins
for each row execute function public.set_maybe_days_updated_at();

create trigger set_maybe_day_comments_updated_at
before update on public.maybe_day_comments
for each row execute function public.set_maybe_days_updated_at();

alter table public.maybe_day_activities enable row level security;
alter table public.maybe_day_draws enable row level security;
alter table public.maybe_day_checkins enable row level security;
alter table public.maybe_day_comments enable row level security;
alter table public.maybe_day_hearts enable row level security;

create policy "Active members can read Maybe Day activities"
  on public.maybe_day_activities for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Active members can read shared Maybe Day draws"
  on public.maybe_day_draws for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Active members can read shared Maybe Day checkins"
  on public.maybe_day_checkins for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Members manage their own Maybe Day checkins"
  on public.maybe_day_checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Members remove their own Maybe Day checkins"
  on public.maybe_day_checkins for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Active members can read active Maybe Day comments"
  on public.maybe_day_comments for select to authenticated
  using (
    archived_at is null
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Members create only their own Maybe Day comments"
  on public.maybe_day_comments for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and archived_at is null
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Authors update their own Maybe Day comments"
  on public.maybe_day_comments for update to authenticated
  using (
    author_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  )
  with check (
    author_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Active members can read shared Maybe Day hearts"
  on public.maybe_day_hearts for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Members add only their own Maybe Day heart"
  on public.maybe_day_hearts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Members remove only their own Maybe Day heart"
  on public.maybe_day_hearts for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

revoke all on table public.maybe_day_activities from anon, authenticated;
revoke all on table public.maybe_day_draws from anon, authenticated;
revoke all on table public.maybe_day_checkins from anon;
revoke all on table public.maybe_day_comments from anon;
revoke all on table public.maybe_day_hearts from anon;
grant select on table public.maybe_day_activities to authenticated;
grant select on table public.maybe_day_draws to authenticated;
grant select, insert, delete on table public.maybe_day_checkins to authenticated;
grant select, insert, update on table public.maybe_day_comments to authenticated;
grant select, insert, delete on table public.maybe_day_hearts to authenticated;

create function public.select_maybe_day_activity(p_selected_by_user_id uuid)
returns public.maybe_day_draws
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_draw public.maybe_day_draws;
  chosen_activity_id uuid;
  created_draw public.maybe_day_draws;
begin
  perform pg_advisory_xact_lock(hashtext('the-beginning-of-maybe:maybe-day-active-draw'));

  if not exists (
    select 1
    from public.app_members member
    join public.user_journey_progress progress on progress.user_id = member.user_id
    where member.active
      and member.user_id = p_selected_by_user_id
      and progress.storybook_completed_at is not null
      and progress.library_completed_at is not null
      and progress.puzzle_room_completed_at is not null
      and progress.radio_completed_at is not null
      and progress.question_garden_completed_at is not null
      and progress.gallery_completed_at is not null
      and progress.her_universe_completed_at is not null
  ) then
    raise exception 'maybe_days_unauthorized';
  end if;

  select draw.* into existing_draw
  from public.maybe_day_draws draw
  where draw.status in ('selected', 'started')
  order by draw.selected_at desc
  limit 1;

  if found then
    return existing_draw;
  end if;

  select activity.id into chosen_activity_id
  from public.maybe_day_activities activity
  where activity.is_active
    and activity.id not in (
      select recent.activity_id
      from (
        select distinct on (draw.activity_id) draw.activity_id, draw.selected_at
        from public.maybe_day_draws draw
        order by draw.activity_id, draw.selected_at desc
      ) recent
      order by recent.selected_at desc
      limit 10
    )
  order by random()
  limit 1;

  if chosen_activity_id is null then
    select activity.id into chosen_activity_id
    from public.maybe_day_activities activity
    where activity.is_active
    order by random()
    limit 1;
  end if;

  if chosen_activity_id is null then
    raise exception 'maybe_days_no_active_activity';
  end if;

  insert into public.maybe_day_draws (activity_id, selected_by_user_id)
  values (chosen_activity_id, p_selected_by_user_id)
  returning * into created_draw;

  return created_draw;
end;
$$;

revoke all on function public.select_maybe_day_activity(uuid) from public, anon, authenticated;
grant execute on function public.select_maybe_day_activity(uuid) to service_role;

create function public.complete_maybe_day_if_confirmed(p_draw_id uuid)
returns public.maybe_day_draws
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_draw public.maybe_day_draws;
  active_member_count integer;
  confirmed_member_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('the-beginning-of-maybe:maybe-day-active-draw'));

  select count(*) into active_member_count
  from public.app_members member
  where member.active and member.user_id is not null;

  select count(*) into confirmed_member_count
  from public.app_members member
  where member.active
    and member.user_id is not null
    and exists (
      select 1
      from public.maybe_day_checkins checkin
      where checkin.draw_id = p_draw_id
        and checkin.user_id = member.user_id
    );

  if active_member_count < 2 or confirmed_member_count <> active_member_count then
    raise exception 'maybe_days_waiting_for_checkins';
  end if;

  update public.maybe_day_draws
  set status = 'completed',
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      skipped_at = null,
      skip_reason = null
  where id = p_draw_id
    and status in ('selected', 'started')
  returning * into completed_draw;

  if completed_draw.id is null then
    select * into completed_draw
    from public.maybe_day_draws
    where id = p_draw_id and status = 'completed';
  end if;

  if completed_draw.id is null then
    raise exception 'maybe_days_draw_not_active';
  end if;

  return completed_draw;
end;
$$;

revoke all on function public.complete_maybe_day_if_confirmed(uuid) from public, anon, authenticated;
grant execute on function public.complete_maybe_day_if_confirmed(uuid) to service_role;

insert into public.maybe_day_activities
  (slug, title, prompt, category, icon_key, estimated_minutes, requires_voice, requires_video, sort_order)
values
  ('watch-together', 'Watch something together', 'Watch the same movie or episode while calling, then compare the moments that stayed with you.', 'watch-together', 'film', 60, true, false, 1),
  ('full-album', 'Listen to a full album', 'Listen to the same album from beginning to end and share your favourite moment afterward.', 'music', 'music', 60, false, false, 2),
  ('reminds-me-of-you', 'A song that reminds me of you', 'Pick one song that reminds you of the other person and explain why.', 'music', 'heart', 15, false, false, 3),
  ('three-funny-videos', 'Choose the funniest video', 'Watch three funny videos from your separate screens and choose the best one together.', 'watch-together', 'film', 20, false, false, 4),
  ('playlist-no-skips', 'A playlist with no skips', 'Listen to a shared playlist without skipping any song, then compare the surprises.', 'music', 'music', 45, false, false, 5),
  ('same-short-article', 'Read and compare', 'Read the same short article online and compare your thoughts over chat or a call.', 'conversation', 'book', 25, false, false, 6),
  ('five-unexpected-questions', 'Five unexpected questions', 'Ask each other five unexpected questions. Either person may always skip one.', 'conversation', 'message', 30, true, false, 7),
  ('twenty-questions', 'Twenty questions', 'Play twenty questions over chat, voice, or video and see how quickly the answer appears.', 'games', 'message', 25, false, false, 8),
  ('serious-silly-sweet', 'Serious, silly and sweet', 'Ask one serious, one silly and one sweet question each.', 'conversation', 'heart', 25, true, false, 9),
  ('two-truths-one-lie', 'Two truths and one lie', 'Play two truths and one lie and explain the story behind the most surprising truth.', 'games', 'gamepad', 20, true, false, 10),
  ('unusual-would-you-rather', 'Unusual would you rather', 'Take turns answering unusual would-you-rather questions and defending your choices.', 'games', 'sparkles', 25, false, false, 11),
  ('what-made-you-smile', 'What made you smile today?', 'Tell each other what made you smile today, however small it was.', 'conversation', 'heart', 15, true, false, 12),
  ('perfect-lazy-day', 'Describe your perfect lazy day', 'Describe your perfect lazy day from morning to night and notice where your answers overlap.', 'conversation', 'coffee', 20, true, false, 13),
  ('childhood-memory', 'A childhood memory', 'Share one childhood memory you rarely discuss, with no pressure to share more than feels comfortable.', 'conversation', 'star', 30, true, false, 14),
  ('something-to-improve', 'Something I want to improve', 'Discuss one thing you want to improve about yourself and how the other person can encourage you.', 'conversation', 'sparkles', 30, true, false, 15),
  ('playful-debate', 'A playful debate', 'Choose a harmless topic and debate opposite sides playfully over a call.', 'conversation', 'message', 20, true, false, 16),
  ('five-minute-day-summary', 'Your day in five minutes', 'Exchange a five-minute voice-note summary of your day and listen when you have space.', 'conversation', 'message', 15, true, false, 17),
  ('appreciation-voice-note', 'An appreciation voice note', 'Send a voice note describing something you appreciate about the other person.', 'conversation', 'heart', 10, true, false, 18),
  ('focused-video-call', 'Twenty-minute focused call', 'Have a twenty-minute no-distraction video call and give each other your full attention.', 'conversation', 'camera', 20, false, true, 19),
  ('read-aloud', 'Read something aloud', 'Read a short story or poem aloud to each other over a voice or video call.', 'conversation', 'book', 25, true, false, 20),
  ('quiet-study-call', 'A quiet study or work call', 'Stay on a quiet call while both study or work from your separate locations.', 'conversation', 'moon', 45, true, false, 21),
  ('desk-or-room-tour', 'A tiny space tour', 'Give each other a quick video tour of your desk or room and share one meaningful detail.', 'photos', 'camera', 15, false, true, 22),
  ('teach-a-small-skill', 'Teach one small skill', 'Teach each other one small skill in fifteen minutes using chat, screen sharing, voice, or video.', 'creative', 'sparkles', 30, true, false, 23),
  ('two-skies', 'Photograph both skies', 'Photograph the sky where you each are and exchange the pictures.', 'photos', 'camera', 10, false, false, 24),
  ('old-photo-story', 'The story of an old photograph', 'Share an old photograph digitally and explain its story.', 'photos', 'camera', 20, false, false, 25),
  ('chosen-colour-photo', 'Find the chosen colour', 'Choose a colour, then each photograph something nearby that matches it.', 'photos', 'palette', 15, false, false, 26),
  ('separate-photo-hunt', 'A separate-location photo hunt', 'Complete a small photo scavenger hunt from your separate locations and compare what you found.', 'photos', 'camera', 30, false, false, 27),
  ('draw-from-memory', 'Draw each other from memory', 'Draw each other from memory on paper or digitally and reveal the results on a call.', 'creative', 'palette', 25, false, true, 28),
  ('six-line-poem', 'Write a six-line poem', 'Write a six-line poem for each other and exchange them through chat or read them aloud.', 'creative', 'book', 20, false, false, 29),
  ('emoji-story', 'Tell an emoji story', 'Create a short emoji story and let the other person interpret it.', 'creative', 'message', 15, false, false, 30),
  ('digital-postcards', 'Make digital postcards', 'Design a simple digital postcard for each other using a photo, colour, or a few words.', 'creative', 'palette', 25, false, false, 31),
  ('matching-wallpapers', 'Matching wallpapers for a day', 'Choose matching phone wallpapers digitally and use them for one day.', 'creative', 'heart', 15, false, false, 32),
  ('shared-mood-board', 'Create a shared mood board', 'Create a shared digital colour or mood board and explain the choices you add.', 'creative', 'palette', 35, false, false, 33),
  ('five-song-gift', 'A five-song mini playlist', 'Create a five-song mini playlist for each other and exchange the links.', 'music', 'music', 30, false, false, 34),
  ('online-game-together', 'Play an online game', 'Choose an online game you can both access and play together from separate locations.', 'games', 'gamepad', 40, true, false, 35),
  ('online-puzzle-together', 'Solve something together', 'Complete an online puzzle or quiz together using chat, voice, or screen sharing.', 'games', 'gamepad', 35, true, false, 36),
  ('virtual-karaoke', 'Virtual karaoke', 'Have a virtual karaoke session over a call and take turns choosing songs.', 'music', 'music', 30, true, true, 37),
  ('songs-without-explanations', 'Songs first, explanations later', 'Take turns choosing songs without explaining the choice until afterward.', 'music', 'music', 30, true, false, 38),
  ('guess-the-favourite', 'Guess the favourite', 'Play a guess-the-favourite challenge using categories you choose together.', 'games', 'star', 25, false, false, 39),
  ('five-minute-laugh', 'Make each other laugh', 'Try to make each other laugh within five minutes over chat, voice, or video.', 'games', 'sparkles', 10, true, false, 40),
  ('same-kind-of-snack', 'Share the same kind of snack', 'Choose the same type of snack, find your own locally, and eat it while calling.', 'conversation', 'coffee', 20, true, false, 41),
  ('same-simple-recipe', 'Make the same simple thing', 'Prepare the same simple meal or drink separately, then compare the results over a call.', 'creative', 'coffee', 45, false, true, 42),
  ('rate-three-tastes', 'Rate three snacks or drinks', 'Each choose three snacks or drinks available where you are, rate them, and compare scores.', 'games', 'coffee', 30, true, false, 43),
  ('virtual-warm-toast', 'A virtual warm-drink toast', 'Make a warm drink in your separate locations and share a virtual toast.', 'conversation', 'coffee', 15, true, true, 44),
  ('household-task-call', 'A small-task call', 'Stay on a call while both complete a small household task in your own spaces.', 'conversation', 'message', 30, true, false, 45),
  ('three-admirations', 'Three things I admire', 'Share three small things you admire about each other.', 'conversation', 'heart', 20, true, false, 46),
  ('someday-list', 'A shared someday list', 'Create a shared digital list of ten things you would like to experience someday, without scheduling them.', 'creative', 'star', 30, false, false, 47),
  ('imaginary-perfect-day', 'Imagine a perfect day', 'Plan an imaginary perfect day together without choosing a real date or location.', 'creative', 'moon', 30, true, false, 48),
  ('future-selves-note', 'A note for your future selves', 'Record a short voice note for your future selves and save it somewhere you both choose.', 'creative', 'star', 15, true, false, 49),
  ('one-hour-virtual-date', 'A one-hour virtual date', 'Plan and carry out a simple one-hour virtual date using a call and shared digital activity.', 'conversation', 'heart', 60, true, true, 50);

alter table public.user_journey_progress
  add column maybe_days_completed_at timestamptz;

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
      'gallery',
      'her-universe',
      'maybe-days'
    ));

-- protect_journey_completion_and_timestamps discovers every *_completed_at
-- column dynamically, so Maybe Days completion is monotonic without replacement.
