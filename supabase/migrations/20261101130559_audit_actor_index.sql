-- Cover the audit actor foreign key for efficient account deletion and actor history lookups.
create index if not exists review_decision_events_actor_idx
  on public.review_decision_events(actor_id)
  where actor_id is not null;
