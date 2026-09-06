-- Schéma v2 : postes récurrents avec historique de montants + solde de départ + date exacte des mouvements
-- À exécuter dans l'éditeur SQL de ton projet Supabase.

-- Nouvelle table des postes récurrents (remplace fixed_items).
-- group_id relie les tranches successives d'un même poste (ex. "Loyer" à 700 puis 710).
create table if not exists recurring_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  label text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  start_month text not null,      -- 'YYYY-MM', premier mois où ce montant s'applique
  end_month text,                 -- 'YYYY-MM', dernier mois où ce montant s'applique (NULL = toujours en cours)
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  created_at timestamptz default now()
);

-- Ajoute la date exacte à chaque mouvement ponctuel (pour le calendrier et la saisie dans le passé).
alter table transactions add column if not exists date date default current_date;

-- Solde de départ, pour calculer le solde théorique reporté mois après mois.
create table if not exists settings (
  id boolean primary key default true check (id),
  starting_balance numeric not null default 0,
  starting_balance_month text not null default to_char(now(), 'YYYY-MM')
);
insert into settings (id) values (true) on conflict (id) do nothing;

alter table recurring_items disable row level security;
alter table settings disable row level security;

-- Si tu avais déjà des lignes dans l'ancienne table "fixed_items", tu peux les migrer
-- manuellement en les recréant dans l'onglet "Fixes" de l'appli (généralement 1 ou 2 lignes).
-- Optionnel, une fois que tu as vérifié que tout fonctionne :
-- drop table if exists fixed_items;
