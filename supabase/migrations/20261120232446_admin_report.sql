-- =====================================================================
-- admin_report(from, to): every number the Reports page needs, as JSON.
-- Admin only. Compares the range with the previous period of the same length.
-- =====================================================================
create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prev_from date := p_from - (p_to - p_from + 1);
  v_prev_to   date := p_from - 1;
  -- short ranges are grouped by week, longer ones by month
  v_bucket text     := case when p_to - p_from <= 92 then 'week' else 'month' end;
  v_step   interval := case when p_to - p_from <= 92 then interval '1 week' else interval '1 month' end;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can view reports' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a start date on or before the end date' using errcode = '22023';
  end if;

  with
  period_recalls as (
    select id, event_id, report_date, classification, reason_for_recall, recalling_firm, is_nationwide
    from public.recalls
    where report_date between p_from and p_to
  ),

  -- headline numbers, current vs previous period
  summary as (
    select
      count(*) filter (where report_date between p_from and p_to) as recalls_cur,
      count(*) filter (where report_date between v_prev_from and v_prev_to) as recalls_prev,
      count(*) filter (where classification = 'Class I' and report_date between p_from and p_to) as class_i_cur,
      count(*) filter (where classification = 'Class I' and report_date between v_prev_from and v_prev_to) as class_i_prev,
      count(*) filter (where reason_for_recall ~* '\mundeclared\M|allergen' and report_date between p_from and p_to) as allergen_cur,
      count(*) filter (where reason_for_recall ~* '\mundeclared\M|allergen' and report_date between v_prev_from and v_prev_to) as allergen_prev,
      count(*) filter (where termination_date between p_from and p_to) as closed_cur,
      count(*) filter (where termination_date between v_prev_from and v_prev_to) as closed_prev
    from public.recalls
  ),
  activity_summary as (
    select
      (select count(*) from public.profiles where created_at >= p_from and created_at < p_to + 1) as signups_cur,
      (select count(*) from public.profiles where created_at >= v_prev_from and created_at < v_prev_to + 1) as signups_prev,
      (select count(*) from public.alerts where created_at >= p_from and created_at < p_to + 1) as alerts_cur,
      (select count(*) from public.alerts where created_at >= v_prev_from and created_at < v_prev_to + 1) as alerts_prev
  ),

  -- one row per week or month in the range, including empty ones
  periods as (
    select gs::date as period_start
    from generate_series(
      date_trunc(v_bucket, p_from::timestamp),
      date_trunc(v_bucket, p_to::timestamp),
      v_step
    ) gs
  ),
  trend as (
    select
      p.period_start,
      count(r.id) filter (where r.classification = 'Class I') as class_i,
      count(r.id) filter (where r.classification = 'Class II') as class_ii,
      count(r.id) filter (where r.classification = 'Class III') as class_iii,
      count(r.id) filter (where r.classification is null or r.classification = 'Not Yet Classified') as unclassified
    from periods p
    left join period_recalls r
      on date_trunc(v_bucket, r.report_date::timestamp)::date = p.period_start
    group by p.period_start
  ),
  activity_trend as (
    select
      p.period_start,
      (select count(*) from public.profiles pr
        where date_trunc(v_bucket, pr.created_at)::date = p.period_start
          and pr.created_at >= p_from and pr.created_at < p_to + 1) as signups,
      (select count(*) from public.alerts a
        where date_trunc(v_bucket, a.created_at)::date = p.period_start
          and a.created_at >= p_from and a.created_at < p_to + 1) as alerts
    from periods p
  ),

  -- reason text sorted into categories by keyword (first match wins)
  reasons as (
    select category, count(*) as recalls
    from (
      select case
        when reason_for_recall ~* 'listeria' then 'Listeria'
        when reason_for_recall ~* 'salmonella' then 'Salmonella'
        when reason_for_recall ~* '\me\.?\s?coli\M|\mstec\M|o157' then 'E. coli'
        when reason_for_recall ~* 'botulin' then 'Botulism risk'
        when reason_for_recall ~* '\mundeclared\M|allergen' then 'Undeclared allergen or ingredient'
        when reason_for_recall ~* 'foreign (material|matter|object)|\mmetal\M|\mplastic\M|\mglass\M|\mrubber\M' then 'Foreign material'
        else 'Other'
      end as category
      from period_recalls
    ) categorized
    group by category
  ),

  -- major allergens named in allergen recalls (searches the reason only)
  allergen_terms (label, query) as (
    values
      ('Milk',      to_tsquery('english', 'milk | dairy | whey | casein')),
      ('Egg',       to_tsquery('english', 'egg')),
      ('Fish',      to_tsquery('english', 'fish | anchovy | tuna | cod')),
      ('Shellfish', to_tsquery('english', 'shellfish | shrimp | crab | lobster')),
      ('Tree nuts', to_tsquery('english', 'tree <-> nut | almond | walnut | cashew | pecan | pistachio | hazelnut | macadamia')),
      ('Peanut',    to_tsquery('english', 'peanut')),
      ('Wheat',     to_tsquery('english', 'wheat')),
      ('Soy',       to_tsquery('english', 'soy | soybean | soya')),
      ('Sesame',    to_tsquery('english', 'sesame'))
  ),
  allergens as (
    select t.label, count(r.id) as recalls
    from allergen_terms t
    left join period_recalls r
      on r.reason_for_recall ~* '\mundeclared\M|allergen'
     and to_tsvector('english', coalesce(r.reason_for_recall, '')) @@ t.query
    group by t.label
  ),

  -- where recalls were sold
  states as (
    select s.state_code, count(distinct s.recall_id) as recalls
    from public.recall_distribution_states s
    join period_recalls r on r.id = s.recall_id
    group by s.state_code
    order by recalls desc, s.state_code
    limit 10
  ),
  coverage as (
    select
      count(*) filter (where pr.is_nationwide) as nationwide,
      count(*) filter (
        where not pr.is_nationwide
          and not exists (select 1 from public.recall_distribution_states s where s.recall_id = pr.id)
      ) as unknown
    from period_recalls pr
  ),

  -- median days from recall start to closure, for recalls closed in the range
  time_to_close as (
    select
      coalesce(classification::text, 'Not Yet Classified') as classification,
      count(*) as recalls,
      round(percentile_cont(0.5) within group (order by termination_date - recall_initiation_date)::numeric) as median_days
    from public.recalls
    where termination_date between p_from and p_to
      and recall_initiation_date is not null
      and termination_date >= recall_initiation_date
    group by 1
  ),

  -- companies ranked by recall events (one event can cover many products)
  companies as (
    select
      recalling_firm as company,
      count(distinct coalesce(event_id, id::text)) as events,
      count(*) as products
    from period_recalls
    where recalling_firm is not null
    group by recalling_firm
    order by events desc, products desc, recalling_firm
    limit 10
  ),

  -- what users are watching right now (not limited to the range)
  watch_types as (
    select item_type::text as item_type, count(*) as items, count(distinct user_id) as users
    from public.watchlist_items
    where is_active
    group by item_type
  ),
  top_terms as (
    select term_normalized as term, count(distinct user_id) as users
    from public.watchlist_items
    where is_active
    group by term_normalized
    order by users desc, term
    limit 10
  )

  select jsonb_build_object(
    'range', jsonb_build_object(
      'from', p_from, 'to', p_to,
      'previous_from', v_prev_from, 'previous_to', v_prev_to,
      'bucket', v_bucket
    ),
    'data_range', (
      select jsonb_build_object('first', min(report_date), 'last', max(report_date)) from public.recalls
    ),
    'summary', (
      select jsonb_build_object(
        'recalls',  jsonb_build_object('current', s.recalls_cur,  'previous', s.recalls_prev),
        'class_i',  jsonb_build_object('current', s.class_i_cur,  'previous', s.class_i_prev),
        'allergen', jsonb_build_object('current', s.allergen_cur, 'previous', s.allergen_prev),
        'closed',   jsonb_build_object('current', s.closed_cur,   'previous', s.closed_prev),
        'signups',  jsonb_build_object('current', a.signups_cur,  'previous', a.signups_prev),
        'alerts',   jsonb_build_object('current', a.alerts_cur,   'previous', a.alerts_prev)
      )
      from summary s cross join activity_summary a
    ),
    'trend',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.period_start), '[]'::jsonb) from trend t),
    'activity_trend', (select coalesce(jsonb_agg(to_jsonb(t) order by t.period_start), '[]'::jsonb) from activity_trend t),
    'reasons',        (select coalesce(jsonb_agg(to_jsonb(x) order by (x.category = 'Other'), x.recalls desc), '[]'::jsonb) from reasons x),
    'allergens',      (select coalesce(jsonb_agg(to_jsonb(x) order by x.recalls desc, x.label), '[]'::jsonb) from allergens x),
    'states',         (select coalesce(jsonb_agg(to_jsonb(x) order by x.recalls desc, x.state_code), '[]'::jsonb) from states x),
    'coverage',       (select to_jsonb(c) from coverage c),
    'time_to_close',  (select coalesce(jsonb_agg(to_jsonb(x) order by x.classification), '[]'::jsonb) from time_to_close x),
    'companies',      (select coalesce(jsonb_agg(to_jsonb(x) order by x.events desc, x.products desc, x.company), '[]'::jsonb) from companies x),
    'watch_types',    (select coalesce(jsonb_agg(to_jsonb(x) order by x.items desc), '[]'::jsonb) from watch_types x),
    'top_terms',      (select coalesce(jsonb_agg(to_jsonb(x) order by x.users desc, x.term), '[]'::jsonb) from top_terms x)
  )
  into v_result;

  return v_result;
end;
$$;

-- signed-in users may call it; the function itself rejects non-admins
revoke execute on function public.admin_report(date, date) from public, anon;
grant execute on function public.admin_report(date, date) to authenticated;