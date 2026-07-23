create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  uploader_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  author text not null check (char_length(trim(author)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  personal_note text not null default '' check (char_length(personal_note) <= 2000),
  shelf text not null check (shelf in ('jessicas_shelf', 'read_together')),
  reading_status text not null default 'not_started'
    check (reading_status in ('not_started', 'reading', 'completed')),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/epub+zip',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  file_extension text not null check (file_extension in ('pdf', 'epub', 'txt', 'docx')),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_books_shelf_created_at_idx
  on public.library_books (shelf, created_at desc);
create index library_books_uploader_idx
  on public.library_books (uploader_user_id);

alter table public.library_books enable row level security;

create policy "Active members can view library books"
  on public.library_books for select to authenticated
  using (exists (
    select 1 from public.app_members
    where active and user_id = (select auth.uid())
  ));

create policy "Active members can add their own library books"
  on public.library_books for insert to authenticated
  with check (
    uploader_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create policy "Active members can update their own library books"
  on public.library_books for update to authenticated
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

create policy "Active members can delete their own library books"
  on public.library_books for delete to authenticated
  using (
    uploader_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_members
      where active and user_id = (select auth.uid())
    )
  );

create function public.set_library_books_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_library_books_updated_at
before update on public.library_books
for each row execute function public.set_library_books_updated_at();

revoke all on table public.library_books from anon;
revoke all on table public.library_books from authenticated;
grant select (
  id, uploader_user_id, title, author, description, personal_note, shelf,
  reading_status, original_filename, mime_type, file_extension, size_bytes,
  allow_download, created_at, updated_at
) on public.library_books to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-books',
  'library-books',
  false,
  26214400,
  array[
    'application/pdf',
    'application/epub+zip',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are added. Browser clients remain default-deny.
-- The authorized server handlers use the service role to create short-lived URLs.
