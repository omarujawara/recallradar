-- When a recall is added, match it against every active watchlist item
create or replace function public.match_new_recall()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with new_matches as (
    insert into public.matches (recall_id, item_id, user_id, matched_field, matched_text, match_reason)
    select
      new.id,
      w.id,
      w.user_id,
      case
        when to_tsvector('english', coalesce(new.reason_for_recall, '')) @@ q.query then 'reason_for_recall'
        when to_tsvector('english', coalesce(new.product_description, '')) @@ q.query then 'product_description'
        when to_tsvector('english', coalesce(new.recalling_firm, '')) @@ q.query then 'recalling_firm'
        else 'code_info'
      end::public.matched_field,
      w.term,
      format('"%s" found in this recall', w.term)
    from public.watchlist_items w
    cross join lateral (select phraseto_tsquery('english', w.term_normalized) as query) q
    where w.is_active
      and new.search_vector @@ q.query
    on conflict (recall_id, item_id) do nothing
    returning id, user_id
  )
  insert into public.alerts (user_id, match_id, alert_type)
  select m.user_id, m.id, 'new_match'
  from new_matches m
  where new.status = 'Ongoing';

  return new;
end;
$$;

create trigger recalls_after_insert_match
  after insert on public.recalls
  for each row execute function public.match_new_recall();

-- When a recall's status changes, alert everyone following it
create or replace function public.alert_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.field_name = 'status' then
    insert into public.alerts (user_id, match_id, recall_change_id, alert_type)
    select
      m.user_id,
      m.id,
      new.id,
      (case when new.new_value in ('Completed', 'Terminated')
            then 'recall_closed' else 'status_change' end)::public.alert_type
    from public.matches m
    where m.recall_id = new.recall_id
      and not m.is_dismissed
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger recall_changes_after_insert_alert
  after insert on public.recall_changes
  for each row execute function public.alert_on_status_change();