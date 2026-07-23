create table public.user_journey_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  storybook_page smallint not null default 1 check (storybook_page between 1 and 30),
  storybook_page_updated_at timestamptz,
  storybook_completed_at timestamptz,
  library_completed_at timestamptz,
  last_location text not null default 'world'
    check (last_location in ('world', 'storybook', 'library')),
  last_world_destination text check (last_world_destination in (
    'storybook', 'library', 'puzzle-room', 'jessicas-radio', 'question-garden',
    'gallery', 'our-journey', 'maybe-days', 'our-corner', 'open-when'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_journey_progress enable row level security;

create policy "Active members can read only their own journey progress"
  on public.user_journey_progress for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

revoke all on table public.user_journey_progress from anon;
revoke all on table public.user_journey_progress from authenticated;
grant select on table public.user_journey_progress to authenticated;

create function public.protect_journey_completion_and_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.storybook_page is distinct from old.storybook_page then
    new.storybook_page_updated_at = now();
  end if;
  if old.storybook_completed_at is not null then
    new.storybook_completed_at = old.storybook_completed_at;
  end if;
  if old.library_completed_at is not null then
    new.library_completed_at = old.library_completed_at;
  end if;
  return new;
end;
$$;

create trigger protect_journey_completion_and_timestamps
before update on public.user_journey_progress
for each row execute function public.protect_journey_completion_and_timestamps();
