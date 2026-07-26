create table public.final_world_letter (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 30000),
  status text not null default 'draft' check (status in ('draft', 'sealed', 'opened', 'withdrawn')),
  sealed_at timestamptz,
  opened_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_user_id <> recipient_user_id),
  check (
    (status = 'draft' and sealed_at is null and opened_at is null and withdrawn_at is null)
    or (status = 'sealed' and sealed_at is not null and opened_at is null and withdrawn_at is null)
    or (status = 'opened' and sealed_at is not null and opened_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and opened_at is null and withdrawn_at is not null)
  )
);

create unique index final_world_one_canonical_active_letter
  on public.final_world_letter ((true))
  where status <> 'withdrawn';

create function public.protect_final_world_letter()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id <> old.id
     or new.author_user_id <> old.author_user_id
     or new.recipient_user_id <> old.recipient_user_id
     or new.created_at <> old.created_at then
    raise exception 'final_world_letter_identity_is_immutable';
  end if;
  if old.opened_at is not null and new.opened_at is distinct from old.opened_at then
    raise exception 'final_world_letter_opened_at_is_monotonic';
  end if;
  if old.status in ('sealed', 'opened') and
     (new.title is distinct from old.title or new.body is distinct from old.body) then
    raise exception 'final_world_sealed_content_is_immutable';
  end if;
  if not (
    (old.status = 'draft' and new.status in ('draft', 'sealed', 'withdrawn'))
    or (old.status = 'sealed' and new.status in ('sealed', 'opened', 'withdrawn'))
    or (old.status = 'opened' and new.status = 'opened')
    or (old.status = 'withdrawn' and new.status = 'withdrawn')
  ) then
    raise exception 'final_world_letter_status_is_monotonic';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_final_world_letter_before_update
before update on public.final_world_letter
for each row execute function public.protect_final_world_letter();

create function public.has_final_world_access(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members member
    join public.user_journey_progress progress on progress.user_id = member.user_id
    where member.user_id = p_user_id
      and p_user_id = auth.uid()
      and member.active
      and member.role in ('owner', 'guest')
      and progress.storybook_completed_at is not null
      and progress.library_completed_at is not null
      and progress.puzzle_room_completed_at is not null
      and progress.radio_completed_at is not null
      and progress.question_garden_completed_at is not null
      and progress.gallery_completed_at is not null
      and progress.her_universe_completed_at is not null
      and progress.maybe_days_completed_at is not null
      and progress.our_corner_completed_at is not null
  );
$$;

create function public.save_final_world_letter_draft(p_title text, p_body text)
returns public.final_world_letter
language plpgsql security definer set search_path = ''
as $$
declare
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_letter public.final_world_letter;
begin
  if not public.has_final_world_access(v_author)
     or not exists (select 1 from public.app_members where user_id = v_author and active and role = 'owner') then
    raise exception 'final_world_author_not_authorized';
  end if;
  if char_length(trim(p_title)) not between 1 and 160
     or char_length(trim(p_body)) not between 1 and 30000 then
    raise exception 'final_world_letter_invalid';
  end if;
  select user_id into v_recipient
  from public.app_members
  where active and role = 'guest' and user_id is not null
  order by created_at
  limit 1;
  if v_recipient is null then
    raise exception 'final_world_recipient_unavailable';
  end if;
  select * into v_letter from public.final_world_letter
  where status <> 'withdrawn'
  for update;
  if found then
    if v_letter.author_user_id <> v_author or v_letter.status <> 'draft' then
      raise exception 'final_world_letter_not_editable';
    end if;
    update public.final_world_letter
      set title = trim(p_title), body = trim(p_body), updated_at = now()
      where id = v_letter.id returning * into v_letter;
  else
    insert into public.final_world_letter (author_user_id, recipient_user_id, title, body)
      values (v_author, v_recipient, trim(p_title), trim(p_body))
      returning * into v_letter;
  end if;
  return v_letter;
end;
$$;

create function public.seal_final_world_letter(p_letter_id uuid)
returns public.final_world_letter
language plpgsql security definer set search_path = ''
as $$
declare v_letter public.final_world_letter;
begin
  select * into v_letter from public.final_world_letter where id = p_letter_id for update;
  if not found or v_letter.author_user_id <> auth.uid()
     or not public.has_final_world_access(auth.uid()) then
    raise exception 'final_world_letter_not_authorized';
  end if;
  if v_letter.status = 'draft' then
    update public.final_world_letter
      set status = 'sealed', sealed_at = now(), updated_at = now()
      where id = p_letter_id returning * into v_letter;
  elsif v_letter.status not in ('sealed', 'opened') then
    raise exception 'final_world_letter_not_sealable';
  end if;
  return v_letter;
end;
$$;

create function public.open_final_world_letter(p_letter_id uuid)
returns public.final_world_letter
language plpgsql security definer set search_path = ''
as $$
declare v_letter public.final_world_letter;
begin
  select * into v_letter from public.final_world_letter where id = p_letter_id for update;
  if not found or v_letter.recipient_user_id <> auth.uid()
     or not public.has_final_world_access(auth.uid()) then
    raise exception 'final_world_letter_not_authorized';
  end if;
  if v_letter.status = 'sealed' then
    update public.final_world_letter
      set status = 'opened', opened_at = coalesce(opened_at, now()), updated_at = now()
      where id = p_letter_id returning * into v_letter;
  elsif v_letter.status <> 'opened' then
    raise exception 'final_world_letter_not_openable';
  end if;
  return v_letter;
end;
$$;

create function public.withdraw_final_world_letter(p_letter_id uuid)
returns public.final_world_letter
language plpgsql security definer set search_path = ''
as $$
declare v_letter public.final_world_letter;
begin
  select * into v_letter from public.final_world_letter where id = p_letter_id for update;
  if not found or v_letter.author_user_id <> auth.uid()
     or not public.has_final_world_access(auth.uid()) then
    raise exception 'final_world_letter_not_authorized';
  end if;
  if v_letter.status not in ('draft', 'sealed') then
    raise exception 'final_world_letter_not_withdrawable';
  end if;
  update public.final_world_letter
    set status = 'withdrawn', withdrawn_at = now(), updated_at = now()
    where id = p_letter_id returning * into v_letter;
  return v_letter;
end;
$$;

alter table public.final_world_letter enable row level security;

create policy "Author previews their final letter" on public.final_world_letter
for select to authenticated using (
  author_user_id = auth.uid() and public.has_final_world_access(auth.uid())
);
create policy "Recipient reads available final letter" on public.final_world_letter
for select to authenticated using (
  recipient_user_id = auth.uid()
  and status in ('sealed', 'opened')
  and public.has_final_world_access(auth.uid())
);

revoke all on table public.final_world_letter from public, anon, authenticated;
grant select on table public.final_world_letter to authenticated;
revoke all on function public.has_final_world_access(uuid) from public, anon;
grant execute on function public.has_final_world_access(uuid) to authenticated, service_role;
revoke all on function public.protect_final_world_letter() from public, anon, authenticated;
revoke all on function public.save_final_world_letter_draft(text, text),
  public.seal_final_world_letter(uuid), public.open_final_world_letter(uuid),
  public.withdraw_final_world_letter(uuid) from public, anon;
grant execute on function public.save_final_world_letter_draft(text, text),
  public.seal_final_world_letter(uuid), public.open_final_world_letter(uuid),
  public.withdraw_final_world_letter(uuid) to authenticated, service_role;

alter table public.user_journey_progress
  add column final_world_completed_at timestamptz;

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_world_destination_check;

update public.user_journey_progress
set last_world_destination = 'the-world-i-can-give-you'
where last_world_destination = 'open-when';

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_location_check,
  add constraint user_journey_progress_last_location_check
    check (last_location in (
      'world', 'storybook', 'library', 'puzzle_room', 'radio',
      'question_garden', 'gallery', 'her-universe', 'maybe-days', 'our-corner',
      'the-world-i-can-give-you'
    )),
  add constraint user_journey_progress_last_world_destination_check
    check (last_world_destination is null or last_world_destination in (
      'storybook', 'library', 'puzzle-room', 'jessicas-radio', 'question-garden',
      'gallery', 'her-universe', 'maybe-days', 'our-corner',
      'the-world-i-can-give-you'
    ));

-- The schema-resilient journey trigger protects final_world_completed_at
-- as a monotonic per-user completion timestamp.
