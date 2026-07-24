create or replace function public.question_garden_valid_options(value jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select value is not null
    and jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) between 2 and 8
    and not exists (
      select 1 from jsonb_array_elements(value) item
      where jsonb_typeof(item) <> 'string'
        or char_length(trim(item #>> '{}')) not between 1 and 120
    );
$$;

create table if not exists public.question_garden_questions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('curated', 'custom')),
  category text not null check (category in (
    'How We Began',
    'Little Things',
    'Dreams and the Future',
    'You, Me and Us',
    'Fun and Unexpected'
  )),
  prompt text not null check (char_length(trim(prompt)) between 1 and 500),
  response_type text not null check (response_type in ('long_text', 'short_text', 'choice')),
  options jsonb,
  personal_note text check (personal_note is null or char_length(personal_note) <= 1000),
  planted_by_user_id uuid references auth.users(id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 10000),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_garden_question_source_check check (
    (source_type = 'curated' and planted_by_user_id is null)
    or (source_type = 'custom' and planted_by_user_id is not null)
  ),
  constraint question_garden_question_options_check check (
    (response_type = 'choice' and public.question_garden_valid_options(options))
    or (response_type <> 'choice' and options is null)
  ),
  constraint question_garden_question_archive_check check (
    (active and archived_at is null) or (not active and archived_at is not null)
  ),
  constraint question_garden_question_prompt_unique unique (prompt)
);

alter table public.question_garden_questions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists source_type text,
  add column if not exists category text,
  add column if not exists prompt text,
  add column if not exists response_type text,
  add column if not exists options jsonb,
  add column if not exists personal_note text,
  add column if not exists planted_by_user_id uuid,
  add column if not exists sort_order smallint,
  add column if not exists active boolean default true,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists question_garden_questions_category_order_idx
  on public.question_garden_questions (category, sort_order)
  where active;
create index if not exists question_garden_questions_planter_idx
  on public.question_garden_questions (planted_by_user_id)
  where planted_by_user_id is not null;

create table if not exists public.question_garden_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_garden_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'skipped')),
  answer_text text check (answer_text is null or char_length(answer_text) <= 5000),
  selected_option text check (selected_option is null or char_length(selected_option) <= 120),
  submitted_at timestamptz,
  revealed_at timestamptz,
  follow_up_note text check (follow_up_note is null or char_length(follow_up_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_garden_answer_user_unique unique (question_id, user_id),
  constraint question_garden_answer_value_check check (
    not (answer_text is not null and selected_option is not null)
  ),
  constraint question_garden_answer_submission_check check (
    status <> 'submitted'
    or (submitted_at is not null and (answer_text is not null or selected_option is not null))
  ),
  constraint question_garden_answer_reveal_check check (
    revealed_at is null or submitted_at is not null
  )
);

alter table public.question_garden_answers
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists question_id uuid,
  add column if not exists user_id uuid,
  add column if not exists status text default 'draft',
  add column if not exists answer_text text,
  add column if not exists selected_option text,
  add column if not exists submitted_at timestamptz,
  add column if not exists revealed_at timestamptz,
  add column if not exists follow_up_note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists question_garden_answers_question_status_idx
  on public.question_garden_answers (question_id, status);
create index if not exists question_garden_answers_user_idx
  on public.question_garden_answers (user_id);

create table if not exists public.question_garden_reactions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_garden_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('heart', 'laugh', 'sparkle', 'emotional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_garden_reaction_user_unique unique (question_id, user_id)
);

alter table public.question_garden_reactions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists question_id uuid,
  add column if not exists user_id uuid,
  add column if not exists reaction text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.question_garden_member_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_question_id uuid references public.question_garden_questions(id) on delete set null,
  last_category text check (last_category is null or last_category in (
    'How We Began',
    'Little Things',
    'Dreams and the Future',
    'You, Me and Us',
    'Fun and Unexpected'
  )),
  last_visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.question_garden_member_state
  add column if not exists user_id uuid,
  add column if not exists last_question_id uuid,
  add column if not exists last_category text,
  add column if not exists last_visited_at timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.question_garden_questions
  alter column id set not null,
  alter column source_type set not null,
  alter column category set not null,
  alter column prompt set not null,
  alter column response_type set not null,
  alter column sort_order set not null,
  alter column active set not null,
  alter column active set default true,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();
alter table public.question_garden_answers
  alter column id set not null,
  alter column question_id set not null,
  alter column user_id set not null,
  alter column status set not null,
  alter column status set default 'draft',
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();
alter table public.question_garden_reactions
  alter column id set not null,
  alter column question_id set not null,
  alter column user_id set not null,
  alter column reaction set not null,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();
alter table public.question_garden_member_state
  alter column user_id set not null,
  alter column last_visited_at set not null,
  alter column last_visited_at set default now(),
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

do $$
declare
  expected record;
  existing_type "char";
begin
  for expected in
    select * from (values
      ('public.question_garden_questions', 'question_garden_questions_pkey', 'p', 'alter table public.question_garden_questions add constraint question_garden_questions_pkey primary key (id)'),
      ('public.question_garden_questions', 'question_garden_questions_source_type_check', 'c', $ddl$alter table public.question_garden_questions add constraint question_garden_questions_source_type_check check (source_type in ('curated', 'custom'))$ddl$),
      ('public.question_garden_questions', 'question_garden_questions_category_check', 'c', $ddl$alter table public.question_garden_questions add constraint question_garden_questions_category_check check (category in ('How We Began', 'Little Things', 'Dreams and the Future', 'You, Me and Us', 'Fun and Unexpected'))$ddl$),
      ('public.question_garden_questions', 'question_garden_questions_prompt_check', 'c', 'alter table public.question_garden_questions add constraint question_garden_questions_prompt_check check (char_length(trim(prompt)) between 1 and 500)'),
      ('public.question_garden_questions', 'question_garden_questions_response_type_check', 'c', $ddl$alter table public.question_garden_questions add constraint question_garden_questions_response_type_check check (response_type in ('long_text', 'short_text', 'choice'))$ddl$),
      ('public.question_garden_questions', 'question_garden_questions_personal_note_check', 'c', 'alter table public.question_garden_questions add constraint question_garden_questions_personal_note_check check (personal_note is null or char_length(personal_note) <= 1000)'),
      ('public.question_garden_questions', 'question_garden_questions_planted_by_user_id_fkey', 'f', 'alter table public.question_garden_questions add constraint question_garden_questions_planted_by_user_id_fkey foreign key (planted_by_user_id) references auth.users(id) on delete cascade'),
      ('public.question_garden_questions', 'question_garden_questions_sort_order_check', 'c', 'alter table public.question_garden_questions add constraint question_garden_questions_sort_order_check check (sort_order between 1 and 10000)'),
      ('public.question_garden_questions', 'question_garden_question_source_check', 'c', $ddl$alter table public.question_garden_questions add constraint question_garden_question_source_check check ((source_type = 'curated' and planted_by_user_id is null) or (source_type = 'custom' and planted_by_user_id is not null))$ddl$),
      ('public.question_garden_questions', 'question_garden_question_options_check', 'c', $ddl$alter table public.question_garden_questions add constraint question_garden_question_options_check check ((response_type = 'choice' and public.question_garden_valid_options(options)) or (response_type <> 'choice' and options is null))$ddl$),
      ('public.question_garden_questions', 'question_garden_question_archive_check', 'c', 'alter table public.question_garden_questions add constraint question_garden_question_archive_check check ((active and archived_at is null) or (not active and archived_at is not null))'),
      ('public.question_garden_questions', 'question_garden_question_prompt_unique', 'u', 'alter table public.question_garden_questions add constraint question_garden_question_prompt_unique unique (prompt)'),
      ('public.question_garden_answers', 'question_garden_answers_pkey', 'p', 'alter table public.question_garden_answers add constraint question_garden_answers_pkey primary key (id)'),
      ('public.question_garden_answers', 'question_garden_answers_question_id_fkey', 'f', 'alter table public.question_garden_answers add constraint question_garden_answers_question_id_fkey foreign key (question_id) references public.question_garden_questions(id) on delete cascade'),
      ('public.question_garden_answers', 'question_garden_answers_user_id_fkey', 'f', 'alter table public.question_garden_answers add constraint question_garden_answers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade'),
      ('public.question_garden_answers', 'question_garden_answers_status_check', 'c', $ddl$alter table public.question_garden_answers add constraint question_garden_answers_status_check check (status in ('draft', 'submitted', 'skipped'))$ddl$),
      ('public.question_garden_answers', 'question_garden_answers_answer_text_check', 'c', 'alter table public.question_garden_answers add constraint question_garden_answers_answer_text_check check (answer_text is null or char_length(answer_text) <= 5000)'),
      ('public.question_garden_answers', 'question_garden_answers_selected_option_check', 'c', 'alter table public.question_garden_answers add constraint question_garden_answers_selected_option_check check (selected_option is null or char_length(selected_option) <= 120)'),
      ('public.question_garden_answers', 'question_garden_answers_follow_up_note_check', 'c', 'alter table public.question_garden_answers add constraint question_garden_answers_follow_up_note_check check (follow_up_note is null or char_length(follow_up_note) <= 2000)'),
      ('public.question_garden_answers', 'question_garden_answer_user_unique', 'u', 'alter table public.question_garden_answers add constraint question_garden_answer_user_unique unique (question_id, user_id)'),
      ('public.question_garden_answers', 'question_garden_answer_value_check', 'c', 'alter table public.question_garden_answers add constraint question_garden_answer_value_check check (not (answer_text is not null and selected_option is not null))'),
      ('public.question_garden_answers', 'question_garden_answer_submission_check', 'c', $ddl$alter table public.question_garden_answers add constraint question_garden_answer_submission_check check (status <> 'submitted' or (submitted_at is not null and (answer_text is not null or selected_option is not null)))$ddl$),
      ('public.question_garden_answers', 'question_garden_answer_reveal_check', 'c', 'alter table public.question_garden_answers add constraint question_garden_answer_reveal_check check (revealed_at is null or submitted_at is not null)'),
      ('public.question_garden_reactions', 'question_garden_reactions_pkey', 'p', 'alter table public.question_garden_reactions add constraint question_garden_reactions_pkey primary key (id)'),
      ('public.question_garden_reactions', 'question_garden_reactions_question_id_fkey', 'f', 'alter table public.question_garden_reactions add constraint question_garden_reactions_question_id_fkey foreign key (question_id) references public.question_garden_questions(id) on delete cascade'),
      ('public.question_garden_reactions', 'question_garden_reactions_user_id_fkey', 'f', 'alter table public.question_garden_reactions add constraint question_garden_reactions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade'),
      ('public.question_garden_reactions', 'question_garden_reactions_reaction_check', 'c', $ddl$alter table public.question_garden_reactions add constraint question_garden_reactions_reaction_check check (reaction in ('heart', 'laugh', 'sparkle', 'emotional'))$ddl$),
      ('public.question_garden_reactions', 'question_garden_reaction_user_unique', 'u', 'alter table public.question_garden_reactions add constraint question_garden_reaction_user_unique unique (question_id, user_id)'),
      ('public.question_garden_member_state', 'question_garden_member_state_pkey', 'p', 'alter table public.question_garden_member_state add constraint question_garden_member_state_pkey primary key (user_id)'),
      ('public.question_garden_member_state', 'question_garden_member_state_user_id_fkey', 'f', 'alter table public.question_garden_member_state add constraint question_garden_member_state_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade'),
      ('public.question_garden_member_state', 'question_garden_member_state_last_question_id_fkey', 'f', 'alter table public.question_garden_member_state add constraint question_garden_member_state_last_question_id_fkey foreign key (last_question_id) references public.question_garden_questions(id) on delete set null'),
      ('public.question_garden_member_state', 'question_garden_member_state_last_category_check', 'c', $ddl$alter table public.question_garden_member_state add constraint question_garden_member_state_last_category_check check (last_category is null or last_category in ('How We Began', 'Little Things', 'Dreams and the Future', 'You, Me and Us', 'Fun and Unexpected'))$ddl$)
    ) as constraints_to_reconcile(table_name, constraint_name, constraint_type, definition)
  loop
    select contype into existing_type
    from pg_constraint
    where conrelid = expected.table_name::regclass
      and conname = expected.constraint_name;

    if existing_type is null then
      execute expected.definition;
    elsif existing_type <> expected.constraint_type::"char" then
      raise exception 'Constraint % on % conflicts with the Question Garden migration',
        expected.constraint_name, expected.table_name;
    end if;
  end loop;
end;
$$;

create or replace function public.protect_question_garden_question()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.source_type = 'curated' then
    raise exception 'Curated garden questions are immutable';
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.question_garden_answers where question_id = old.id) then
      raise exception 'Answered garden questions cannot be deleted';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
    or new.source_type is distinct from old.source_type
    or new.planted_by_user_id is distinct from old.planted_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Garden question ownership and identity are immutable';
  end if;
  if exists (select 1 from public.question_garden_answers where question_id = old.id)
    and (
      new.category is distinct from old.category
      or new.prompt is distinct from old.prompt
      or new.response_type is distinct from old.response_type
      or new.options is distinct from old.options
      or new.personal_note is distinct from old.personal_note
    ) then
    raise exception 'Answered garden questions are frozen';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.question_garden_questions'::regclass
      and tgname = 'protect_question_garden_question'
      and not tgisinternal
  ) then
    create trigger protect_question_garden_question
    before update or delete on public.question_garden_questions
    for each row execute function public.protect_question_garden_question();
  end if;
end;
$$;

create or replace function public.protect_question_garden_answer()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  expected_type text;
  expected_options jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.question_id is distinct from old.question_id
      or new.user_id is distinct from old.user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Garden answer ownership and identity are immutable';
    end if;
    if old.revealed_at is not null and (
      new.revealed_at is null
      or new.answer_text is distinct from old.answer_text
      or new.selected_option is distinct from old.selected_option
      or new.status is distinct from old.status
    ) then
      raise exception 'Revealed garden answers cannot be cleared or changed';
    end if;
    if old.submitted_at is not null and new.submitted_at is distinct from old.submitted_at then
      raise exception 'Garden submission timestamps are monotonic';
    end if;
    if old.revealed_at is not null and new.revealed_at is distinct from old.revealed_at then
      raise exception 'Garden reveal timestamps are monotonic';
    end if;
  end if;

  select response_type, options into expected_type, expected_options
  from public.question_garden_questions
  where id = new.question_id and active;

  if expected_type is null then
    raise exception 'Garden question is unavailable';
  end if;
  if expected_type = 'choice' and (
    new.answer_text is not null
    or (new.selected_option is not null and not expected_options ? new.selected_option)
  ) then
    raise exception 'Garden choice answer is invalid';
  end if;
  if expected_type <> 'choice' and new.selected_option is not null then
    raise exception 'Garden text answer is invalid';
  end if;
  if expected_type = 'short_text' and char_length(coalesce(new.answer_text, '')) > 500 then
    raise exception 'Garden short answer is too long';
  end if;
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.question_garden_answers'::regclass
      and tgname = 'protect_question_garden_answer'
      and not tgisinternal
  ) then
    create trigger protect_question_garden_answer
    before insert or update on public.question_garden_answers
    for each row execute function public.protect_question_garden_answer();
  end if;
end;
$$;

create or replace function public.set_question_garden_owned_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Garden record ownership is immutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.question_garden_reactions'::regclass
      and tgname = 'set_question_garden_reaction_updated_at'
      and not tgisinternal
  ) then
    create trigger set_question_garden_reaction_updated_at
    before update on public.question_garden_reactions
    for each row execute function public.set_question_garden_owned_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.question_garden_member_state'::regclass
      and tgname = 'set_question_garden_member_state_updated_at'
      and not tgisinternal
  ) then
    create trigger set_question_garden_member_state_updated_at
    before update on public.question_garden_member_state
    for each row execute function public.set_question_garden_owned_updated_at();
  end if;
end;
$$;

create or replace function public.submit_question_garden_answer(
  p_question_id uuid,
  p_user_id uuid,
  p_answer_text text,
  p_selected_option text
)
returns table (revealed boolean, reveal_timestamp timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  shared_reveal_at timestamptz;
  submitted_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_question_id::text, 0));

  if not exists (
    select 1 from public.app_members
    where active and user_id = p_user_id
  ) then
    raise exception 'Garden member is not authorized';
  end if;

  insert into public.question_garden_answers (
    question_id, user_id, status, answer_text, selected_option, submitted_at
  )
  values (
    p_question_id, p_user_id, 'submitted', p_answer_text, p_selected_option, now()
  )
  on conflict (question_id, user_id) do update set
    status = 'submitted',
    answer_text = excluded.answer_text,
    selected_option = excluded.selected_option,
    submitted_at = coalesce(public.question_garden_answers.submitted_at, excluded.submitted_at)
  where public.question_garden_answers.revealed_at is null;

  if not found then
    raise exception 'Revealed garden answers are immutable';
  end if;

  select count(*) into submitted_count
  from public.question_garden_answers
  where question_id = p_question_id and status = 'submitted';

  if submitted_count >= 2 then
    shared_reveal_at := clock_timestamp();
    update public.question_garden_answers
    set revealed_at = shared_reveal_at
    where question_id = p_question_id
      and status = 'submitted'
      and revealed_at is null;
  end if;

  return query select shared_reveal_at is not null, shared_reveal_at;
end;
$$;

revoke all on function public.submit_question_garden_answer(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_question_garden_answer(uuid, uuid, text, text) to service_role;

alter table public.question_garden_questions enable row level security;
alter table public.question_garden_answers enable row level security;
alter table public.question_garden_reactions enable row level security;
alter table public.question_garden_member_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_questions'
      and policyname = 'Active members can read active garden question metadata'
  ) then
    create policy "Active members can read active garden question metadata"
      on public.question_garden_questions for select to authenticated
      using (
        active
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_questions'
      and policyname = 'Active members can plant custom garden questions'
  ) then
    create policy "Active members can plant custom garden questions"
      on public.question_garden_questions for insert to authenticated
      with check (
        source_type = 'custom'
        and planted_by_user_id = (select auth.uid())
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_questions'
      and policyname = 'Planters can update their custom garden questions'
  ) then
    create policy "Planters can update their custom garden questions"
      on public.question_garden_questions for update to authenticated
      using (source_type = 'custom' and planted_by_user_id = (select auth.uid()))
      with check (source_type = 'custom' and planted_by_user_id = (select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_questions'
      and policyname = 'Planters can delete their custom garden questions'
  ) then
    create policy "Planters can delete their custom garden questions"
      on public.question_garden_questions for delete to authenticated
      using (source_type = 'custom' and planted_by_user_id = (select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_answers'
      and policyname = 'Members can access only their own garden answer row'
  ) then
    create policy "Members can access only their own garden answer row"
      on public.question_garden_answers for all to authenticated
      using (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      )
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_reactions'
      and policyname = 'Members can manage only their own garden reaction'
  ) then
    create policy "Members can manage only their own garden reaction"
      on public.question_garden_reactions for all to authenticated
      using (user_id = (select auth.uid()))
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_garden_member_state'
      and policyname = 'Members can manage only their own garden state'
  ) then
    create policy "Members can manage only their own garden state"
      on public.question_garden_member_state for all to authenticated
      using (user_id = (select auth.uid()))
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.app_members
          where active and user_id = (select auth.uid())
        )
      );
  end if;
end;
$$;

revoke all on table public.question_garden_questions from anon, authenticated;
revoke all on table public.question_garden_answers from anon, authenticated;
revoke all on table public.question_garden_reactions from anon, authenticated;
revoke all on table public.question_garden_member_state from anon, authenticated;
grant select (id, source_type, category, prompt, response_type, options, personal_note, planted_by_user_id, sort_order, active, archived_at, created_at, updated_at)
  on public.question_garden_questions to authenticated;
-- Answers, reactions, and member state remain inaccessible to browser clients.
-- Protected server operations use the authenticated session identity and an admin client.

insert into public.question_garden_questions
  (id, source_type, category, prompt, response_type, options, planted_by_user_id, sort_order)
values
  ('90000000-0000-4000-8000-000000000001', 'curated', 'How We Began', 'What was the first thing you noticed about me?', 'long_text', null, null, 1),
  ('90000000-0000-4000-8000-000000000002', 'curated', 'How We Began', 'What did you honestly think when Snapchat exposed the screenshot?', 'long_text', null, null, 2),
  ('90000000-0000-4000-8000-000000000003', 'curated', 'How We Began', 'At what point did our conversation stop feeling like a random chat?', 'long_text', null, null, 3),
  ('90000000-0000-4000-8000-000000000004', 'curated', 'How We Began', 'What surprised you most after we started getting to know each other?', 'long_text', null, null, 4),
  ('90000000-0000-4000-8000-000000000005', 'curated', 'How We Began', 'If the beginning of our story had a title, what would you call it?', 'short_text', null, null, 5),
  ('90000000-0000-4000-8000-000000000006', 'curated', 'Little Things', 'What does your perfect lazy day look like?', 'long_text', null, null, 6),
  ('90000000-0000-4000-8000-000000000007', 'curated', 'Little Things', 'What small thing can instantly improve your mood?', 'short_text', null, null, 7),
  ('90000000-0000-4000-8000-000000000008', 'curated', 'Little Things', 'What is one habit you have that you think is funny or slightly annoying?', 'long_text', null, null, 8),
  ('90000000-0000-4000-8000-000000000009', 'curated', 'Little Things', 'When life becomes stressful, how do you prefer someone to support you?', 'long_text', null, null, 9),
  ('90000000-0000-4000-8000-000000000010', 'curated', 'Little Things', 'What ordinary moment makes you feel genuinely happy?', 'long_text', null, null, 10),
  ('90000000-0000-4000-8000-000000000011', 'curated', 'Dreams and the Future', 'What is one place you would love to visit someday?', 'short_text', null, null, 11),
  ('90000000-0000-4000-8000-000000000012', 'curated', 'Dreams and the Future', 'What is something you want to experience after finishing school?', 'long_text', null, null, 12),
  ('90000000-0000-4000-8000-000000000013', 'curated', 'Dreams and the Future', 'What kind of home feels peaceful to you?', 'long_text', null, null, 13),
  ('90000000-0000-4000-8000-000000000014', 'curated', 'Dreams and the Future', 'What is one dream you rarely tell people about?', 'long_text', null, null, 14),
  ('90000000-0000-4000-8000-000000000015', 'curated', 'Dreams and the Future', 'What would make the next few years of your life feel successful?', 'long_text', null, null, 15),
  ('90000000-0000-4000-8000-000000000016', 'curated', 'You, Me and Us', 'What makes you feel truly understood by another person?', 'long_text', null, null, 16),
  ('90000000-0000-4000-8000-000000000017', 'curated', 'You, Me and Us', 'What is one thing you enjoy most about our conversations?', 'long_text', null, null, 17),
  ('90000000-0000-4000-8000-000000000018', 'curated', 'You, Me and Us', 'What quality matters most to you in a relationship?', 'long_text', null, null, 18),
  ('90000000-0000-4000-8000-000000000019', 'curated', 'You, Me and Us', 'What is something you would love for us to experience together?', 'long_text', null, null, 19),
  ('90000000-0000-4000-8000-000000000020', 'curated', 'You, Me and Us', 'If our next chapter could begin tomorrow, what would you want inside it?', 'long_text', null, null, 20),
  ('90000000-0000-4000-8000-000000000021', 'curated', 'Fun and Unexpected', 'Choose your perfect plan.', 'choice', '["Movie night", "Road trip", "Late-night conversation", "Sleeping all day"]'::jsonb, null, 21),
  ('90000000-0000-4000-8000-000000000022', 'curated', 'Fun and Unexpected', 'If Luna could speak, what do you think she would complain about first?', 'short_text', null, null, 22),
  ('90000000-0000-4000-8000-000000000023', 'curated', 'Fun and Unexpected', 'Which BTS member would survive the longest in a zombie movie, and why?', 'long_text', null, null, 23),
  ('90000000-0000-4000-8000-000000000024', 'curated', 'Fun and Unexpected', 'If you could force me to watch one movie repeatedly, which movie would you choose?', 'short_text', null, null, 24),
  ('90000000-0000-4000-8000-000000000025', 'curated', 'Fun and Unexpected', 'What question have you secretly been waiting for me to ask you?', 'long_text', null, null, 25)
on conflict do nothing;

alter table public.user_journey_progress
  add column if not exists question_garden_completed_at timestamptz;

do $$
declare
  location_constraint text;
begin
  select pg_get_constraintdef(oid) into location_constraint
  from pg_constraint
  where conrelid = 'public.user_journey_progress'::regclass
    and conname = 'user_journey_progress_last_location_check';

  if location_constraint is null then
    alter table public.user_journey_progress
      add constraint user_journey_progress_last_location_check
      check (last_location in ('world', 'storybook', 'library', 'puzzle_room', 'radio', 'question_garden'));
  elsif position('question_garden' in location_constraint) = 0 then
    alter table public.user_journey_progress
      drop constraint user_journey_progress_last_location_check;
    alter table public.user_journey_progress
      add constraint user_journey_progress_last_location_check
      check (last_location in ('world', 'storybook', 'library', 'puzzle_room', 'radio', 'question_garden'));
  end if;
end;
$$;

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
  if old.question_garden_completed_at is not null then new.question_garden_completed_at = old.question_garden_completed_at; end if;
  new.puzzle_millionaire_best_score = greatest(old.puzzle_millionaire_best_score, new.puzzle_millionaire_best_score);
  new.puzzle_kculture_best_score = greatest(old.puzzle_kculture_best_score, new.puzzle_kculture_best_score);
  if new.puzzle_millionaire_attempt_state is distinct from old.puzzle_millionaire_attempt_state then new.puzzle_millionaire_attempt_updated_at = now(); end if;
  if new.puzzle_kculture_attempt_state is distinct from old.puzzle_kculture_attempt_state then new.puzzle_kculture_attempt_updated_at = now(); end if;
  return new;
end;
$$;
