-- Additive migration for existing CutPro projects. Run after schema.sql.
-- No existing customer records, bucket visibility, or Storage policies change.
begin;

-- The team image is an explicit gallery role, separate from homepage
-- featuring and service association. Keep at most one active team photo.
alter table public.gallery_items
  add column if not exists team_photo boolean not null default false;
create unique index if not exists gallery_one_team_photo_idx
  on public.gallery_items (team_photo)
  where team_photo = true and archived_at is null;

create table if not exists public.upload_sessions (
  id uuid primary key,
  purpose text not null check (purpose in ('gallery', 'estimate')),
  owner_id uuid,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  files jsonb not null default '[]'::jsonb check (
    jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 6
  ),
  status text not null default 'open' check (
    status in ('open', 'processing', 'complete', 'cleaning', 'cleaned')
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  cleanup_after timestamptz not null default (now() + interval '130 minutes'),
  lock_token uuid,
  locked_at timestamptz,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  completed_at timestamptz,
  constraint upload_session_owner check (
    (purpose = 'gallery' and owner_id is not null)
    or (purpose = 'estimate' and owner_id is null)
  ),
  constraint upload_session_lifetime check (cleanup_after >= expires_at)
);

create index if not exists upload_sessions_cleanup_idx
  on public.upload_sessions (cleanup_after) where status <> 'cleaned';

create table if not exists public.upload_rate_limits (
  budget_key text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  reset_at timestamptz not null,
  requests integer not null default 1 check (requests > 0),
  primary key (budget_key, window_start, window_seconds)
);
create index if not exists upload_rate_limits_reset_idx
  on public.upload_rate_limits (reset_at);

alter table public.upload_sessions enable row level security;
alter table public.upload_rate_limits enable row level security;
revoke all on public.upload_sessions from public, anon, authenticated;
revoke all on public.upload_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.upload_sessions to service_role;
grant select, insert, update, delete on public.upload_rate_limits to service_role;

-- Originals are quarantined privately. Only server-normalized gallery output
-- is ever copied to the existing public gallery-media bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-staging', 'gallery-staging', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.consume_upload_budget(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) not between 1 and 160
    or p_limit is null or p_limit not between 1 and 10000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid upload budget.' using errcode = '22023';
  end if;

  v_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  -- Bounded maintenance also runs when there are no upload sessions to clean.
  delete from public.upload_rate_limits
  where (budget_key, window_start, window_seconds) in (
    select budget_key, window_start, window_seconds
    from public.upload_rate_limits
    where reset_at < v_now - interval '1 day'
    order by reset_at
    limit 200
  );

  insert into public.upload_rate_limits (
    budget_key, window_start, window_seconds, reset_at, requests
  ) values (
    p_key, v_start, p_window_seconds,
    v_start + make_interval(secs => p_window_seconds), 1
  )
  on conflict (budget_key, window_start, window_seconds) do update
    set requests = least(public.upload_rate_limits.requests + 1, p_limit + 1)
  returning requests into v_count;

  return v_count <= p_limit;
end;
$$;

create or replace function public.finalize_upload_session(
  p_session_id uuid,
  p_lock_token uuid,
  p_lead jsonb default null,
  p_gallery jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_session public.upload_sessions%rowtype;
  v_count integer;
  v_paths text[];
  v_result jsonb;
  v_items jsonb;
  v_reference text;
begin
  select * into v_session from public.upload_sessions
  where id = p_session_id for update;
  if not found then
    raise exception 'Upload session not found.' using errcode = 'P0002';
  end if;

  -- Cached finalization survives cleanup and concurrent retry requests.
  if v_session.completed_at is not null and v_session.result is not null then
    return v_session.result || jsonb_build_object('duplicate', true);
  end if;

  if v_session.status <> 'processing'
    or p_lock_token is null or v_session.lock_token is distinct from p_lock_token
    or v_session.locked_at is null
    or v_session.locked_at < clock_timestamp() - interval '10 minutes'
    or v_session.expires_at <= clock_timestamp() then
    raise exception 'Upload session is expired or busy.' using errcode = '55000';
  end if;

  v_count := jsonb_array_length(v_session.files);
  if v_count > 6 or exists (
    select 1 from jsonb_array_elements(v_session.files) as f
    where f->>'state' is distinct from 'ready'
      or nullif(f->>'outputPath', '') is null
  ) then
    raise exception 'Uploads are not ready.' using errcode = '22023';
  end if;
  select coalesce(array_agg(f->>'outputPath'), '{}'::text[]) into v_paths
  from jsonb_array_elements(v_session.files) as f;
  if (select count(distinct value) from unnest(v_paths) as value) <> v_count then
    raise exception 'Duplicate upload paths.' using errcode = '22023';
  end if;

  if v_session.purpose = 'estimate' then
    if p_lead is null or jsonb_typeof(p_lead) <> 'object' or p_gallery is not null
      or (p_lead->>'id')::uuid is distinct from p_session_id
      or (p_lead->>'submission_token')::uuid is distinct from p_session_id
      or jsonb_typeof(p_lead->'photo_references') is distinct from 'array' then
      raise exception 'Invalid lead finalization.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_lead->'photo_references') <> v_count
      or exists (
        select 1 from jsonb_array_elements(p_lead->'photo_references') as p
        where not coalesce(p->>'path' = any(v_paths), false)
      )
      or (select count(distinct p->>'path')
        from jsonb_array_elements(p_lead->'photo_references') as p) <> v_count
      or exists (
        select 1 from unnest(v_paths) as path
        where path !~ ('^' || p_session_id::text
          || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|heic|heif)$')
      ) then
      raise exception 'Photos do not belong to this submission.' using errcode = '22023';
    end if;

    insert into public.leads (
      id, reference, submission_token, source, first_name, last_name, phone,
      email, property_address, city, zip, services, urgency, job_description,
      approximate_count, preferred_timeframe, preferred_contact_method,
      best_contact_time, customer_notes, photo_references
    ) values (
      p_session_id, p_lead->>'reference', p_session_id, 'estimate',
      p_lead->>'first_name', coalesce(p_lead->>'last_name', ''), p_lead->>'phone',
      p_lead->>'email', p_lead->>'property_address', p_lead->>'city', p_lead->>'zip',
      array(select jsonb_array_elements_text(coalesce(p_lead->'services', '[]'::jsonb))),
      p_lead->>'urgency', p_lead->>'job_description', p_lead->>'approximate_count',
      p_lead->>'preferred_timeframe', p_lead->>'preferred_contact_method',
      p_lead->>'best_contact_time', p_lead->>'customer_notes', p_lead->'photo_references'
    ) returning reference into v_reference;
    v_result := jsonb_build_object('ok', true, 'reference', v_reference, 'duplicate', false);
  else
    if p_gallery is null or jsonb_typeof(p_gallery) <> 'array' or p_lead is not null
      or v_count < 1 or jsonb_array_length(p_gallery) <> v_count then
      raise exception 'Invalid gallery finalization.' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_gallery) as p
      where not coalesce(p->>'storage_path' = any(v_paths), false)
    ) or (select count(distinct p->>'storage_path')
      from jsonb_array_elements(p_gallery) as p) <> v_count
      or exists (
        select 1 from unnest(v_paths) as path
        where path !~ ('^direct/' || p_session_id::text
          || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
      ) then
      raise exception 'Photos do not belong to this gallery upload.' using errcode = '22023';
    end if;

    with inserted as (
      insert into public.gallery_items (
        storage_path, public_url, alt_text, caption, category, service_slug,
        featured, published, team_photo, sort_order, before_after_group, before_after_role
      )
      select item->>'storage_path', item->>'public_url', item->>'alt_text',
        coalesce(item->>'caption', ''), coalesce(item->>'category', 'Other'),
        item->>'service_slug', coalesce((item->>'featured')::boolean, false),
        coalesce((item->>'published')::boolean, false),
        coalesce((item->>'team_photo')::boolean, false),
        coalesce((item->>'sort_order')::integer, 0),
        item->>'before_after_group', item->>'before_after_role'
      from jsonb_array_elements(p_gallery) as item
      returning *
    ) select coalesce(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb) into v_items
      from inserted;
    v_result := jsonb_build_object('ok', true, 'count', v_count, 'items', v_items, 'duplicate', false);
  end if;

  update public.upload_sessions set status = 'complete', result = v_result,
    completed_at = clock_timestamp(), lock_token = null, locked_at = null
  where id = p_session_id;
  return v_result;
end;
$$;

revoke all on function public.consume_upload_budget(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_upload_budget(text, integer, integer) to service_role;
revoke all on function public.finalize_upload_session(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_upload_session(uuid, uuid, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
