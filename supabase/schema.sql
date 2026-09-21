-- CutPro managed data model. Run once in a new Supabase project's SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  submission_token uuid not null unique,
  source text not null default 'estimate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null default '',
  phone text not null,
  email text,
  property_address text,
  city text,
  zip text,
  services text[] not null default '{}',
  urgency text,
  job_description text not null,
  approximate_count text,
  preferred_timeframe text,
  preferred_contact_method text,
  best_contact_time text,
  customer_notes text,
  photo_references jsonb not null default '[]'::jsonb,
  internal_notes text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'estimate_scheduled', 'won', 'lost'))
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_path text not null unique,
  public_url text not null,
  alt_text text not null,
  caption text not null default '',
  category text not null default 'Other',
  service_slug text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  before_after_group text,
  before_after_role text check (before_after_role is null or before_after_role in ('before', 'after')),
  archived_at timestamptz
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text not null,
  testimonial_text text not null,
  source text not null default 'Direct Customer',
  source_url text,
  rating smallint check (rating is null or rating between 1 and 5),
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz
);

create table if not exists public.business_settings (
  id text primary key default 'primary',
  business_hours text,
  after_hours_note text,
  emergency_service_available boolean not null default true,
  announcement text,
  announcement_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint one_settings_row check (id = 'primary')
);

insert into public.business_settings (id)
values ('primary')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists gallery_items_updated_at on public.gallery_items;
create trigger gallery_items_updated_at before update on public.gallery_items
for each row execute function public.set_updated_at();

drop trigger if exists testimonials_updated_at on public.testimonials;
create trigger testimonials_updated_at before update on public.testimonials
for each row execute function public.set_updated_at();

drop trigger if exists business_settings_updated_at on public.business_settings;
create trigger business_settings_updated_at before update on public.business_settings
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.leads enable row level security;
alter table public.gallery_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.business_settings enable row level security;

-- Application reads/writes run server-side after authorization. No direct table
-- policies are intentionally granted to browser clients.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-photos',
  'lead-photos',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-media',
  'gallery-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists gallery_public_idx on public.gallery_items (published, sort_order) where archived_at is null;
create index if not exists testimonials_public_idx on public.testimonials (published, sort_order) where archived_at is null;

