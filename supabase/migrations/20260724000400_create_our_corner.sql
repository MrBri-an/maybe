create table public.our_corner_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create unique index our_corner_one_active_conversation
  on public.our_corner_conversations ((is_active))
  where is_active;

create table public.our_corner_members (
  conversation_id uuid not null references public.our_corner_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  last_seen_message_id uuid,
  primary key (conversation_id, user_id)
);

create table public.our_corner_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.our_corner_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  client_message_id uuid not null,
  message_kind text not null check (message_kind in ('text', 'voice', 'shared')),
  body text check (body is null or char_length(trim(body)) between 1 and 4000),
  reply_to_message_id uuid references public.our_corner_messages(id) on delete set null,
  shared_type text check (shared_type is null or shared_type in ('song', 'question', 'activity', 'memory')),
  shared_reference text check (shared_reference is null or char_length(shared_reference) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  archived_at timestamptz,
  unique (sender_user_id, client_message_id),
  constraint our_corner_message_content check (
    (message_kind = 'text' and body is not null and shared_type is null and shared_reference is null)
    or (message_kind = 'voice' and shared_type is null and shared_reference is null)
    or (message_kind = 'shared' and shared_type is not null and shared_reference is not null)
  )
);

alter table public.our_corner_members
  add constraint our_corner_members_last_seen_message_fk
  foreign key (last_seen_message_id) references public.our_corner_messages(id) on delete set null;

create index our_corner_messages_conversation_created
  on public.our_corner_messages (conversation_id, created_at desc);

create table public.our_corner_message_hearts (
  message_id uuid not null references public.our_corner_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.our_corner_read_receipts (
  message_id uuid not null references public.our_corner_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.our_corner_pinned_messages (
  conversation_id uuid not null references public.our_corner_conversations(id) on delete cascade,
  message_id uuid not null references public.our_corner_messages(id) on delete cascade,
  pinned_by_user_id uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (conversation_id, message_id)
);

create table public.our_corner_daily_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.our_corner_conversations(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null default current_date,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (conversation_id, author_user_id, note_date)
);

create table public.our_corner_temporary_moods (
  conversation_id uuid not null references public.our_corner_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null check (char_length(trim(mood)) between 1 and 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (conversation_id, user_id),
  check (expires_at > created_at)
);

create table public.our_corner_voice_notes (
  message_id uuid primary key references public.our_corner_messages(id) on delete cascade,
  storage_object_path text not null unique check (char_length(storage_object_path) between 10 and 500),
  mime_type text not null check (mime_type in ('audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/ogg')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  duration_seconds integer not null check (duration_seconds between 1 and 600),
  created_at timestamptz not null default now()
);

create function public.is_active_our_corner_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.our_corner_members corner_member
    join public.our_corner_conversations conversation on conversation.id = corner_member.conversation_id
    join public.app_members app_member on app_member.user_id = corner_member.user_id
    join public.user_journey_progress progress on progress.user_id = corner_member.user_id
    where corner_member.conversation_id = p_conversation_id
      and corner_member.user_id = p_user_id
      and conversation.is_active
      and app_member.active
      and progress.storybook_completed_at is not null
      and progress.library_completed_at is not null
      and progress.puzzle_room_completed_at is not null
      and progress.radio_completed_at is not null
      and progress.question_garden_completed_at is not null
      and progress.gallery_completed_at is not null
      and progress.her_universe_completed_at is not null
      and progress.maybe_days_completed_at is not null
  );
$$;

create function public.validate_our_corner_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_members
    where active and user_id = new.user_id
  ) then
    raise exception 'our_corner_member_not_approved';
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.our_corner_members
    where conversation_id = new.conversation_id
  ) >= 2 then
    raise exception 'our_corner_has_two_members';
  end if;
  return new;
end;
$$;

create function public.protect_our_corner_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  reply_conversation_id uuid;
begin
  if tg_op = 'UPDATE' then
    new.sender_user_id := old.sender_user_id;
    new.conversation_id := old.conversation_id;
    new.client_message_id := old.client_message_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  end if;
  if new.reply_to_message_id is not null then
    select conversation_id into reply_conversation_id
    from public.our_corner_messages where id = new.reply_to_message_id;
    if reply_conversation_id is distinct from new.conversation_id then
      raise exception 'our_corner_reply_conversation_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create function public.set_our_corner_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_our_corner_member_before_write
before insert or update on public.our_corner_members
for each row execute function public.validate_our_corner_member();
create trigger protect_our_corner_message_before_write
before insert or update on public.our_corner_messages
for each row execute function public.protect_our_corner_message();
create trigger set_our_corner_conversation_updated_at
before update on public.our_corner_conversations
for each row execute function public.set_our_corner_updated_at();
create trigger set_our_corner_daily_note_updated_at
before update on public.our_corner_daily_notes
for each row execute function public.set_our_corner_updated_at();

insert into public.our_corner_conversations default values;
insert into public.our_corner_members (conversation_id, user_id)
select conversation.id, app_member.user_id
from public.our_corner_conversations conversation
cross join lateral (
  select user_id from public.app_members
  where active and user_id is not null
  order by case role when 'owner' then 0 else 1 end, created_at
  limit 2
) app_member
where conversation.is_active;

alter table public.our_corner_conversations enable row level security;
alter table public.our_corner_members enable row level security;
alter table public.our_corner_messages enable row level security;
alter table public.our_corner_message_hearts enable row level security;
alter table public.our_corner_read_receipts enable row level security;
alter table public.our_corner_pinned_messages enable row level security;
alter table public.our_corner_daily_notes enable row level security;
alter table public.our_corner_temporary_moods enable row level security;
alter table public.our_corner_voice_notes enable row level security;

create policy "Members read their Our Corner conversation" on public.our_corner_conversations
for select to authenticated using (public.is_active_our_corner_member(id));
create policy "Members read Our Corner membership" on public.our_corner_members
for select to authenticated using (public.is_active_our_corner_member(conversation_id));
create policy "Members read Our Corner messages" on public.our_corner_messages
for select to authenticated using (public.is_active_our_corner_member(conversation_id));
create policy "Members create their own Our Corner messages" on public.our_corner_messages
for insert to authenticated with check (
  sender_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);
create policy "Authors update their own Our Corner messages" on public.our_corner_messages
for update to authenticated using (
  sender_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
) with check (
  sender_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);

create policy "Members read Our Corner hearts" on public.our_corner_message_hearts
for select to authenticated using (exists (
  select 1 from public.our_corner_messages message
  where message.id = message_id and public.is_active_our_corner_member(message.conversation_id)
));
create policy "Members manage their own Our Corner hearts" on public.our_corner_message_hearts
for all to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.our_corner_messages message
    where message.id = message_id and public.is_active_our_corner_member(message.conversation_id)
  )
);
create policy "Members read Our Corner receipts" on public.our_corner_read_receipts
for select to authenticated using (exists (
  select 1 from public.our_corner_messages message
  where message.id = message_id and public.is_active_our_corner_member(message.conversation_id)
));
create policy "Members manage their own Our Corner receipts" on public.our_corner_read_receipts
for all to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.our_corner_messages message
    where message.id = message_id and public.is_active_our_corner_member(message.conversation_id)
  )
);
create policy "Members read Our Corner pins" on public.our_corner_pinned_messages
for select to authenticated using (public.is_active_our_corner_member(conversation_id));
create policy "Members create Our Corner pins" on public.our_corner_pinned_messages
for insert to authenticated with check (
  pinned_by_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);
create policy "Pin authors remove Our Corner pins" on public.our_corner_pinned_messages
for delete to authenticated using (
  pinned_by_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);
create policy "Members read Our Corner daily notes" on public.our_corner_daily_notes
for select to authenticated using (public.is_active_our_corner_member(conversation_id));
create policy "Authors manage their Our Corner daily notes" on public.our_corner_daily_notes
for all to authenticated using (
  author_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
) with check (
  author_user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);
create policy "Members read current Our Corner moods" on public.our_corner_temporary_moods
for select to authenticated using (
  expires_at > now() and public.is_active_our_corner_member(conversation_id)
);
create policy "Members manage their own Our Corner mood" on public.our_corner_temporary_moods
for all to authenticated using (
  user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
) with check (
  user_id = auth.uid() and public.is_active_our_corner_member(conversation_id)
);
create policy "Members read Our Corner voice metadata" on public.our_corner_voice_notes
for select to authenticated using (exists (
  select 1 from public.our_corner_messages message
  where message.id = message_id and public.is_active_our_corner_member(message.conversation_id)
));

revoke all on function public.is_active_our_corner_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_our_corner_member(uuid, uuid) to authenticated, service_role;
revoke all on function public.validate_our_corner_member() from public, anon, authenticated;
revoke all on function public.protect_our_corner_message() from public, anon, authenticated;
revoke all on function public.set_our_corner_updated_at() from public, anon, authenticated;

revoke all on table public.our_corner_conversations, public.our_corner_members,
  public.our_corner_messages, public.our_corner_message_hearts,
  public.our_corner_read_receipts, public.our_corner_pinned_messages,
  public.our_corner_daily_notes, public.our_corner_temporary_moods,
  public.our_corner_voice_notes from anon;
grant select on table public.our_corner_conversations, public.our_corner_members to authenticated;
grant select, insert, update on table public.our_corner_messages to authenticated;
grant select, insert, delete on table public.our_corner_message_hearts, public.our_corner_read_receipts, public.our_corner_pinned_messages to authenticated;
grant select, insert, update, delete on table public.our_corner_daily_notes, public.our_corner_temporary_moods to authenticated;
revoke all on table public.our_corner_voice_notes from authenticated;
grant select (message_id, mime_type, size_bytes, duration_seconds, created_at)
  on public.our_corner_voice_notes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'our-corner-voice',
  'our-corner-voice',
  false,
  20971520,
  array['audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/ogg']
);

create policy "Conversation members read Our Corner voice objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'our-corner-voice'
  and public.is_active_our_corner_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid else null end
  )
);
create policy "Conversation members create their own Our Corner voice objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'our-corner-voice'
  and owner_id = auth.uid()::text
  and public.is_active_our_corner_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid else null end
  )
);
create policy "Voice owners remove their Our Corner voice objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'our-corner-voice'
  and owner_id = auth.uid()::text
  and public.is_active_our_corner_member(
    case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid else null end
  )
);

alter table public.user_journey_progress
  add column our_corner_completed_at timestamptz;

alter table public.user_journey_progress
  drop constraint user_journey_progress_last_location_check,
  add constraint user_journey_progress_last_location_check
    check (last_location in (
      'world', 'storybook', 'library', 'puzzle_room', 'radio',
      'question_garden', 'gallery', 'her-universe', 'maybe-days', 'our-corner'
    ));

-- The existing dynamic journey trigger protects our_corner_completed_at
-- as a monotonic per-user completion timestamp.
