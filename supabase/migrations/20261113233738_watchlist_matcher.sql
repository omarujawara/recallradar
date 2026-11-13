create or replace function public.match_new_watchlist_item()
returns trigger
language plpgsql
security definer          -- runs with owner rights, so it can write matches/alerts
set search_path = ''
as $$
declare
  q tsquery := phraseto_tsquery('english', new.term_normalized);
begin
  with new_matches as (
    -- every recall whose text contains the term becomes a match
    insert into public.matches (recall_id, item_id, user_id, matched_field, matched_text, match_reason)
    select
      r.id,
      new.id,
      new.user_id,
      case
        when to_tsvector('english', coalesce(r.reason_for_recall, '')) @@ q then 'reason_for_recall'
        when to_tsvector('english', coalesce(r.product_description, '')) @@ q then 'product_description'
        when to_tsvector('english', coalesce(r.recalling_firm, '')) @@ q then 'recalling_firm'
        else 'code_info'
      end::public.matched_field,
      new.term,
      format('"%s" found in this recall', new.term)
    from public.recalls r
    where r.search_vector @@ q
    on conflict (recall_id, item_id) do nothing
    returning id, recall_id
  )
  -- alert only for recalls that are still active
  insert into public.alerts (user_id, match_id, alert_type)
  select new.user_id, m.id, 'new_match'
  from new_matches m
  join public.recalls r on r.id = m.recall_id
  where r.status = 'Ongoing';

  return new;
end;
$$;

create trigger watchlist_items_after_insert
  after insert on public.watchlist_items
  for each row execute function public.match_new_watchlist_item();