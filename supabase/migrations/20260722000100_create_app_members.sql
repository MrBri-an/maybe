create table public.app_members (
  id uuid primary key default gen_random_uuid(),
  approved_email text not null,
  user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'guest' check (role in ('owner', 'guest')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_members_email_normalized check (
    approved_email = lower(trim(approved_email))
  )
);

create unique index app_members_approved_email_unique
  on public.app_members (lower(approved_email));

alter table public.app_members enable row level security;

create policy "Active members can read only their own membership"
  on public.app_members
  for select
  to authenticated
  using (
    active
    and user_id = (select auth.uid())
    and approved_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create function public.set_app_members_updated_at()
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

create trigger set_app_members_updated_at
before update on public.app_members
for each row execute function public.set_app_members_updated_at();

create function public.link_approved_app_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.app_members
  set user_id = new.id
  where approved_email = lower(new.email)
    and user_id is null;
  return new;
end;
$$;

revoke all on function public.link_approved_app_member() from public;
revoke all on function public.link_approved_app_member() from anon;
revoke all on function public.link_approved_app_member() from authenticated;

create trigger link_approved_app_member_after_auth_user_created
after insert on auth.users
for each row execute function public.link_approved_app_member();

revoke all on table public.app_members from anon;
grant select on table public.app_members to authenticated;
