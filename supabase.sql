-- Schéma v3 : récurrence flexible (mensuelle ou tous les X jours) + exceptions par occurrence
-- À exécuter dans l'éditeur SQL de ton projet Supabase, en plus des scripts précédents déjà passés.

alter table recurring_items add column if not exists recurrence_type text not null default 'monthly'
  check (recurrence_type in ('monthly', 'interval'));
alter table recurring_items add column if not exists interval_days int;
alter table recurring_items add column if not exists anchor_date date;

-- Une exception = une occurrence précise d'un poste récurrent (identifiée par group_id + sa date théorique)
-- dont le montant et/ou la date sont modifiés pour cette seule fois, ou carrément supprimée (skip).
create table if not exists recurring_exceptions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  occurrence_date date not null,       -- la date théorique de l'occurrence visée (celle calculée par la règle)
  override_amount numeric,             -- NULL = montant habituel conservé
  override_date date,                  -- NULL = date habituelle conservée
  override_label text,
  skip boolean not null default false, -- true = cette occurrence est retirée entièrement
  created_at timestamptz default now(),
  unique (group_id, occurrence_date)
);

alter table recurring_exceptions disable row level security;
