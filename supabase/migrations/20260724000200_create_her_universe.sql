create table public.her_universe_objects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  object_type text not null check (object_type in ('sun', 'moon', 'galaxy', 'planet', 'nebula', 'constellation', 'ocean_moon', 'north_star', 'star')),
  name text not null check (char_length(name) between 1 and 120),
  caption text not null check (char_length(caption) between 1 and 240),
  visual_variant text not null check (visual_variant in ('solar', 'lunar', 'spiral', 'terracotta', 'violet', 'silver', 'tidal', 'polar', 'mystery')),
  sort_order smallint not null unique check (sort_order between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.her_universe_messages (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.her_universe_objects(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  display_order smallint not null default 1 check (display_order between 1 and 10000),
  animation_variant text not null default 'drift' check (animation_variant in ('drift', 'orbit', 'glow', 'rise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.her_universe_object_visits (
  object_id uuid not null references public.her_universe_objects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_count integer not null default 1 check (visit_count > 0),
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  primary key (object_id, user_id)
);

create table public.her_universe_message_reactions (
  message_id uuid not null references public.her_universe_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('star', 'heart', 'moon', 'spark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.her_universe_message_favourites (
  message_id uuid not null references public.her_universe_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.her_universe_private_responses (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.her_universe_objects(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (object_id, user_id)
);

create index her_universe_messages_active_idx
  on public.her_universe_messages (object_id, display_order, created_at)
  where archived_at is null;
create index her_universe_private_responses_active_idx
  on public.her_universe_private_responses (user_id, object_id)
  where archived_at is null;

create function public.protect_her_universe_message()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.object_id is distinct from old.object_id
    or new.author_user_id is distinct from old.author_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Her Universe message identity and ownership are immutable';
  end if;
  if old.archived_at is not null and new.archived_at is distinct from old.archived_at then
    raise exception 'Archived Her Universe messages remain archived';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_her_universe_message
before update on public.her_universe_messages
for each row execute function public.protect_her_universe_message();

create function public.protect_her_universe_response()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.object_id is distinct from old.object_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Her Universe response identity and ownership are immutable';
  end if;
  if old.archived_at is not null and new.archived_at is distinct from old.archived_at then
    raise exception 'Archived Her Universe responses remain archived';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_her_universe_response
before update on public.her_universe_private_responses
for each row execute function public.protect_her_universe_response();

create function public.set_her_universe_reaction_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_her_universe_reaction_updated_at
before update on public.her_universe_message_reactions
for each row execute function public.set_her_universe_reaction_updated_at();

alter table public.her_universe_objects enable row level security;
alter table public.her_universe_messages enable row level security;
alter table public.her_universe_object_visits enable row level security;
alter table public.her_universe_message_reactions enable row level security;
alter table public.her_universe_message_favourites enable row level security;
alter table public.her_universe_private_responses enable row level security;

create policy "Active members can view active Her Universe objects"
  on public.her_universe_objects for select to authenticated
  using (
    is_active
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create policy "Active members can view active Her Universe messages"
  on public.her_universe_messages for select to authenticated
  using (
    archived_at is null
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_objects where id = object_id and is_active)
  );
create policy "Active members can author Her Universe messages"
  on public.her_universe_messages for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and archived_at is null
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_objects where id = object_id and is_active)
  );
create policy "Authors can edit their active Her Universe messages"
  on public.her_universe_messages for update to authenticated
  using (
    author_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    author_user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create policy "Members manage only their Her Universe visits"
  on public.her_universe_object_visits for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

create policy "Active members can view active message reactions"
  on public.her_universe_message_reactions for select to authenticated
  using (
    exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_messages where id = message_id and archived_at is null)
  );
create policy "Members manage only their Her Universe reactions"
  on public.her_universe_message_reactions for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_messages where id = message_id and archived_at is null)
  );

create policy "Members can view their Her Universe favourites"
  on public.her_universe_message_favourites for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );
create policy "Members manage only their Her Universe favourites"
  on public.her_universe_message_favourites for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_messages where id = message_id and archived_at is null)
  );

create policy "Members view only their private Her Universe responses"
  on public.her_universe_private_responses for select to authenticated
  using (
    user_id = (select auth.uid())
    and archived_at is null
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );
create policy "Members create only their private Her Universe responses"
  on public.her_universe_private_responses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and archived_at is null
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
    and exists (select 1 from public.her_universe_objects where id = object_id and is_active)
  );
create policy "Members edit only their private Her Universe responses"
  on public.her_universe_private_responses for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.app_members where active and user_id = (select auth.uid()))
  );

revoke all on public.her_universe_objects, public.her_universe_messages,
  public.her_universe_object_visits, public.her_universe_message_reactions,
  public.her_universe_message_favourites, public.her_universe_private_responses
  from anon, authenticated;
grant select on public.her_universe_objects, public.her_universe_messages to authenticated;
grant select, insert, update on public.her_universe_object_visits,
  public.her_universe_message_reactions, public.her_universe_message_favourites,
  public.her_universe_private_responses to authenticated;
grant delete on public.her_universe_message_reactions,
  public.her_universe_message_favourites to authenticated;
grant insert, update (body, display_order, animation_variant, archived_at)
  on public.her_universe_messages to authenticated;

insert into public.her_universe_objects
  (id, slug, object_type, name, caption, visual_variant, sort_order)
values
  ('92000000-0000-4000-8000-000000000001', 'sun-of-her-warmth', 'sun', 'The Sun of Her Warmth', 'A golden centre that makes the nearby world feel brighter.', 'solar', 1),
  ('92000000-0000-4000-8000-000000000002', 'moon-of-her-calm', 'moon', 'The Moon of Her Calm', 'A quiet light that softens the edges of the night.', 'lunar', 2),
  ('92000000-0000-4000-8000-000000000003', 'galaxy-of-her-beauty', 'galaxy', 'The Galaxy of Her Beauty', 'Light, colour and wonder gathered beyond a single horizon.', 'spiral', 3),
  ('92000000-0000-4000-8000-000000000004', 'planet-of-her-strength', 'planet', 'The Planet of Her Strength', 'Steady ground with a gravity all its own.', 'terracotta', 4),
  ('92000000-0000-4000-8000-000000000005', 'nebula-of-her-mind', 'nebula', 'The Nebula of Her Mind', 'Ideas forming new colours in an ever-changing sky.', 'violet', 5),
  ('92000000-0000-4000-8000-000000000006', 'constellation-of-little-things', 'constellation', 'The Constellation of Little Things', 'Small lights that become meaningful when seen together.', 'silver', 6),
  ('92000000-0000-4000-8000-000000000007', 'ocean-moon', 'ocean_moon', 'The Ocean Moon', 'Tides, depth and reflection moving beneath a silver glow.', 'tidal', 7),
  ('92000000-0000-4000-8000-000000000008', 'north-star', 'north_star', 'The North Star', 'A steady point of light when every direction feels open.', 'polar', 8),
  ('92000000-0000-4000-8000-000000000009', 'unnamed-star', 'star', 'The Unnamed Star', 'A light still waiting for the right name.', 'mystery', 9);

alter table public.user_journey_progress
  add column her_universe_completed_at timestamptz;

update public.user_journey_progress
set last_world_destination = 'her-universe'
where last_world_destination = 'our-journey';

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
      'her-universe'
    )),
  drop constraint user_journey_progress_last_world_destination_check,
  add constraint user_journey_progress_last_world_destination_check
    check (last_world_destination in (
      'storybook',
      'library',
      'puzzle-room',
      'jessicas-radio',
      'question-garden',
      'gallery',
      'her-universe',
      'maybe-days',
      'our-corner',
      'open-when'
    ));

-- The schema-resilient journey trigger protects her_universe_completed_at
-- monotonically without requiring a function replacement.
