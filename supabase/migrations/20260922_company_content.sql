-- Add the singleton Company / About content store to the existing CutPro project.
-- Safe to rerun: existing content is never replaced.
begin;
create table if not exists public.company_content (
  id text primary key default 'primary' check (id = 'primary'),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 65536),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.company_content enable row level security;
revoke all on public.company_content from public, anon, authenticated;
grant select, insert, update on public.company_content to service_role;
drop trigger if exists company_content_updated_at on public.company_content;
create trigger company_content_updated_at before update on public.company_content
for each row execute function public.set_updated_at();
-- No browser policies: the server checks current admin membership before writes.
notify pgrst, 'reload schema';
commit;
