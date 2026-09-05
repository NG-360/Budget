-- À exécuter une fois dans l'éditeur SQL de ton projet Supabase.

create table if not exists fixed_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,        -- format 'YYYY-MM'
  label text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  planned boolean not null default true,
  tag text,                        -- réservé pour l'itération 2 (catégorisation)
  created_at timestamptz default now()
);

create index if not exists transactions_month_key_idx on transactions (month_key);

-- Usage personnel mono-utilisateur : RLS désactivé pour simplifier.
-- Si tu veux la sécuriser davantage plus tard (multi-appareils avec login),
-- on pourra activer Row Level Security et un compte Supabase Auth.
alter table fixed_items disable row level security;
alter table transactions disable row level security;
