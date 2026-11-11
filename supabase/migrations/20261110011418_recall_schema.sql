-- =====================================================================
-- RecallRadar schema
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.account_type as enum ('individual', 'business');
create type public.user_role as enum ('user', 'admin');
create type public.recall_source as enum ('openfda_food', 'openfda_drug', 'openfda_device', 'manual');
create type public.recall_status as enum ('Ongoing', 'Completed', 'Terminated', 'Pending');
create type public.recall_classification as enum ('Class I', 'Class II', 'Class III', 'Not Yet Classified');
create type public.watch_item_type as enum ('allergen', 'brand', 'vendor', 'product', 'keyword', 'lot_upc');
create type public.matched_field as enum ('product_description', 'reason_for_recall', 'recalling_firm', 'code_info', 'distribution_pattern');
create type public.alert_type as enum ('new_match', 'status_change', 'recall_updated', 'recall_closed');
create type public.alert_channel as enum ('in_app', 'email');
create type public.sync_status as enum ('running', 'success', 'failed', 'skipped');

-- ---------------------------------------------------------------------
-- profiles (one row per auth.users row) 
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade unique, -- one-to-one relation
  display_name text,
  account_type public.account_type not null default 'individual',
  role public.user_role not null default 'user',
  business_name text,
  business_type text,
  home_state char(2) check (home_state ~ '^[A-Z]{2}$'),
  email_alerts_enabled boolean not null default false,
  min_alert_classification public.recall_classification not null default 'Class III',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_business_requires_name
    check (account_type <> 'business' or business_name is not null)
);

-- ---------------------------------------------------------------------
-- sync_runs (one row per import job)
-- ---------------------------------------------------------------------
create table public.sync_runs (
  id bigint generated always as identity primary key,
  source public.recall_source not null,
  status public.sync_status not null default 'running',
  fda_last_updated date,
  records_fetched int not null default 0,
  records_inserted int not null default 0,
  records_updated int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index sync_runs_source_started_idx on public.sync_runs (source, started_at desc);

-- ---------------------------------------------------------------------
-- recalls
-- ---------------------------------------------------------------------
create table public.recalls (
  id bigint generated always as identity primary key,
  source public.recall_source not null default 'openfda_food',
  recall_number text,
  event_id text,
  status public.recall_status not null,
  classification public.recall_classification,
  product_type text,
  product_description text not null,
  product_quantity text,
  code_info text,
  reason_for_recall text,
  recalling_firm text,
  address_1 text,
  city text,
  state text,
  postal_code text,
  country text,
  voluntary_mandated text,
  initial_firm_notification text,
  distribution_pattern text,
  is_nationwide boolean not null default false,
  recall_initiation_date date,
  center_classification_date date,
  report_date date,
  termination_date date,
  openfda jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(product_description, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(reason_for_recall, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(recalling_firm, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(code_info, '')), 'C')
  ) stored,
  last_sync_run_id bigint references public.sync_runs (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recalls_source_recall_number_key unique (source, recall_number),
  constraint recalls_fda_requires_number
    check (source = 'manual' or recall_number is not null)
);

create index recalls_event_id_idx on public.recalls (event_id);
create index recalls_status_idx on public.recalls (status);
create index recalls_classification_idx on public.recalls (classification);
create index recalls_report_date_idx on public.recalls (report_date desc);
create index recalls_search_idx on public.recalls using gin (search_vector);

-- ---------------------------------------------------------------------
-- recall_distribution_states
-- ---------------------------------------------------------------------
create table public.recall_distribution_states (
  recall_id bigint not null references public.recalls (id) on delete cascade,
  state_code char(2) not null check (state_code ~ '^[A-Z]{2}$'),
  primary key (recall_id, state_code)
);

create index recall_distribution_states_state_idx on public.recall_distribution_states (state_code);

-- ---------------------------------------------------------------------
-- recall_changes (history log, filled by trigger below)
-- ---------------------------------------------------------------------
create table public.recall_changes (
  id bigint generated always as identity primary key,
  recall_id bigint not null references public.recalls (id) on delete cascade,
  sync_run_id bigint references public.sync_runs (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index recall_changes_recall_idx on public.recall_changes (recall_id, changed_at desc);
create index recall_changes_sync_run_idx on public.recall_changes (sync_run_id);

-- ---------------------------------------------------------------------
-- watchlist_items
-- ---------------------------------------------------------------------
create table public.watchlist_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_type public.watch_item_type not null,
  term text not null check (length(btrim(term)) > 0),
  term_normalized text generated always as (lower(btrim(term))) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint watchlist_items_user_term_key unique (user_id, item_type, term_normalized),
  constraint watchlist_items_id_user_key unique (id, user_id)  -- target for matches composite FK
);

create index watchlist_items_type_term_idx on public.watchlist_items (item_type, term_normalized)
  where is_active;

-- ---------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------
create table public.matches (
  id bigint generated always as identity primary key,
  recall_id bigint not null references public.recalls (id) on delete cascade,
  item_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  matched_field public.matched_field not null,
  matched_text text,
  match_reason text,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint matches_recall_item_key unique (recall_id, item_id),
  constraint matches_id_user_key unique (id, user_id),  -- target for alerts composite FK
  -- guarantees matches.user_id is the owner of the watchlist item
  constraint matches_item_owner_fkey foreign key (item_id, user_id)
    references public.watchlist_items (id, user_id) on delete cascade
);

create index matches_user_created_idx on public.matches (user_id, created_at desc);
create index matches_item_idx on public.matches (item_id);

-- ---------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------
create table public.alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id bigint not null,
  recall_change_id bigint references public.recall_changes (id) on delete restrict,
  alert_type public.alert_type not null,
  channel public.alert_channel not null default 'in_app',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint alerts_match_owner_fkey foreign key (match_id, user_id)
    references public.matches (id, user_id) on delete cascade,
  constraint alerts_change_matches_type check (
    (alert_type = 'new_match' and recall_change_id is null)
    or (alert_type <> 'new_match' and recall_change_id is not null)
  ),
  constraint alerts_one_per_event_key
    unique nulls not distinct (match_id, recall_change_id, channel)
);

create index alerts_user_unread_idx on public.alerts (user_id, created_at desc) where read_at is null;
create index alerts_recall_change_idx on public.alerts (recall_change_id);

-- =====================================================================
-- Functions and triggers
-- =====================================================================

-- updated_at for profiles
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- updated_at for recalls: only when real data changed,
-- not when the nightly import just touches last_synced_at
create or replace function public.recalls_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ignored text[] := array['updated_at', 'last_synced_at', 'last_sync_run_id', 'search_vector'];
begin
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger recalls_set_updated_at
  before update on public.recalls
  for each row execute function public.recalls_set_updated_at();

-- log changes to important recall fields into recall_changes
create or replace function public.log_recall_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tracked text[] := array[
    'status', 'classification', 'termination_date', 'distribution_pattern',
    'reason_for_recall', 'product_description', 'code_info'
  ];
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  f text;
  actor uuid := auth.uid();  -- NULL for the service role (import job)
begin
  foreach f in array tracked loop
    if (old_row ->> f) is distinct from (new_row ->> f) then
      insert into public.recall_changes (recall_id, sync_run_id, changed_by, field_name, old_value, new_value)
      values (
        new.id,
        case when actor is null then new.last_sync_run_id end,
        actor,
        f,
        old_row ->> f,
        new_row ->> f
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger recalls_log_changes
  after update on public.recalls
  for each row execute function public.log_recall_changes();

-- create a profile automatically on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, account_type, business_name, business_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce((new.raw_user_meta_data ->> 'account_type')::public.account_type, 'individual'),
    new.raw_user_meta_data ->> 'business_name',
    new.raw_user_meta_data ->> 'business_type'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin check used by RLS policies (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.sync_runs enable row level security;
alter table public.recalls enable row level security;
alter table public.recall_distribution_states enable row level security;
alter table public.recall_changes enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.matches enable row level security;
alter table public.alerts enable row level security;

-- profiles: see and edit your own; admins see all
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- recalls and distribution states: public read, admin write
create policy "recalls: public read" on public.recalls
  for select to anon, authenticated using (true);

create policy "recalls: admin insert" on public.recalls
  for insert to authenticated with check ((select public.is_admin()));

create policy "recalls: admin update" on public.recalls
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "recalls: admin delete" on public.recalls
  for delete to authenticated using ((select public.is_admin()));

create policy "distribution: public read" on public.recall_distribution_states
  for select to anon, authenticated using (true);

create policy "distribution: admin write" on public.recall_distribution_states
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- recall_changes: readable by signed-in users (recall data is public); written by trigger
create policy "recall_changes: read" on public.recall_changes
  for select to authenticated using (true);

-- sync_runs: admins only (import job uses the service role, which bypasses RLS)
create policy "sync_runs: admin read" on public.sync_runs
  for select to authenticated using ((select public.is_admin()));

-- watchlist_items: full control over your own
create policy "watchlist: read own" on public.watchlist_items
  for select to authenticated using (user_id = (select auth.uid()));

create policy "watchlist: insert own" on public.watchlist_items
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "watchlist: update own" on public.watchlist_items
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "watchlist: delete own" on public.watchlist_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- matches: read your own, dismiss your own (created by the matcher via service role)
create policy "matches: read own" on public.matches
  for select to authenticated using (user_id = (select auth.uid()));

create policy "matches: update own" on public.matches
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- alerts: read your own, mark as read
create policy "alerts: read own" on public.alerts
  for select to authenticated using (user_id = (select auth.uid()));

create policy "alerts: update own" on public.alerts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- Column-level permissions
-- RLS controls WHICH rows; these control WHICH columns users may change.
-- =====================================================================

-- users can't change their own role, id, or timestamps
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, account_type, business_name, business_type,
              home_state, email_alerts_enabled, min_alert_classification)
  on public.profiles to authenticated;

-- users can only dismiss matches
revoke insert, update, delete on public.matches from anon, authenticated;
grant update (is_dismissed) on public.matches to authenticated;

-- users can only mark alerts as read
revoke insert, update, delete on public.alerts from anon, authenticated;
grant update (read_at) on public.alerts to authenticated;

-- history and sync logs are never written from the client
revoke insert, update, delete on public.recall_changes from anon, authenticated;
revoke insert, update, delete on public.sync_runs from anon, authenticated;