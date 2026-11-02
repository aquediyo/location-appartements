-- ============================================================================
--  GESTION DE LOCATIONS D'APPARTEMENTS — Schéma Supabase (PostgreSQL)
--  À exécuter une seule fois dans : Supabase > SQL Editor > New query
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILS UTILISATEURS (liés à auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text not null default '',
  phone       text,
  role        text not null default 'concierge' check (role in ('admin','concierge')),
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. APPARTEMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.apartments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  city        text,
  rooms       int,
  rent_amount numeric(12,2) not null default 0,
  daily_rate  numeric(12,2) not null default 0,
  status      text not null default 'available' check (status in ('available','occupied','maintenance')),
  description text,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. CLIENTS / LOCATAIRES
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  id_number   text,
  address     text,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. RÉSERVATIONS (avant la location)
-- ----------------------------------------------------------------------------
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  uuid not null references public.apartments(id) on delete restrict,
  client_id     uuid not null references public.clients(id) on delete restrict,
  period_type   text not null default 'monthly' check (period_type in ('monthly','daily')),
  reserved_on   date not null default current_date,
  start_date    date not null,
  end_date      date,
  months        numeric(6,2),
  total_amount  numeric(12,2) not null default 0,
  deposit       numeric(12,2) not null default 0,
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled','converted')),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. LOCATIONS (contrats en cours / terminés)
-- ----------------------------------------------------------------------------
create table if not exists public.rentals (
  id             uuid primary key default gen_random_uuid(),
  apartment_id   uuid not null references public.apartments(id) on delete restrict,
  client_id      uuid not null references public.clients(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  period_type    text not null default 'monthly' check (period_type in ('monthly','daily')),
  start_date     date not null,
  end_date       date,
  months         numeric(6,2) not null default 1,
  rent_amount    numeric(12,2) not null default 0,
  total_amount   numeric(12,2) not null default 0,
  status         text not null default 'active' check (status in ('active','ended')),
  notes          text,
  end_notes      text,
  ended_at       date,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Un seul contrat actif par appartement
create unique index if not exists one_active_rental_per_apartment
  on public.rentals (apartment_id) where (status = 'active');

-- ----------------------------------------------------------------------------
-- 6. PAIEMENTS (multiples / partiels par location)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  rental_id  uuid not null references public.rentals(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  paid_on    date not null default current_date,
  method     text not null default 'cash' check (method in ('cash','transfer','check','other')),
  reference  text,
  notes      text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. DÉPENSES (pour le calcul de la caisse)
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  amount     numeric(12,2) not null check (amount > 0),
  spent_on   date not null default current_date,
  category   text,
  notes      text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. PARAMÈTRES (ligne unique)
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id              int primary key default 1 check (id = 1),
  business_name   text not null default 'Gestion de locations',
  currency        text not null default 'DZD',
  currency_symbol text not null default 'DA',
  updated_at      timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- INDEX
-- ----------------------------------------------------------------------------
create index if not exists idx_payments_rental      on public.payments (rental_id);
create index if not exists idx_payments_date        on public.payments (paid_on);
create index if not exists idx_expenses_date        on public.expenses (spent_on);
create index if not exists idx_rentals_apartment    on public.rentals (apartment_id);
create index if not exists idx_rentals_status       on public.rentals (status);
create index if not exists idx_reservations_start   on public.reservations (start_date);
create index if not exists idx_reservations_status  on public.reservations (status);

-- ----------------------------------------------------------------------------
-- FONCTIONS UTILITAIRES
-- ----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'admin'
  );
$$;

-- Mise à jour automatique de updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Création automatique du profil à l'inscription
-- Le 1er compte devient administrateur actif, les suivants sont inactifs
-- jusqu'à activation par l'administrateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cnt int;
  fn  text;
begin
  select count(*) into cnt from public.profiles;
  fn := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, email, full_name, role, active)
  values (new.id, new.email, fn,
          case when cnt = 0 then 'admin' else 'concierge' end,
          cnt = 0)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Un non-admin ne peut pas modifier son rôle ni son état d'activation
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end;
$$;

-- Synchronisation du statut de l'appartement avec les locations
create or replace function public.sync_apartment_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if new.status = 'active' then
      update public.apartments set status = 'occupied' where id = new.apartment_id;
    end if;

  elsif (tg_op = 'UPDATE') then
    if new.status = 'active' then
      update public.apartments set status = 'occupied' where id = new.apartment_id;
    else
      update public.apartments set status = 'available'
        where id = new.apartment_id
          and not exists (select 1 from public.rentals r
                          where r.apartment_id = new.apartment_id
                            and r.status = 'active' and r.id <> new.id);
    end if;

    if old.apartment_id <> new.apartment_id then
      update public.apartments set status = 'available'
        where id = old.apartment_id
          and not exists (select 1 from public.rentals r
                          where r.apartment_id = old.apartment_id and r.status = 'active');
    end if;

  elsif (tg_op = 'DELETE' and old.status = 'active') then
    update public.apartments set status = 'available'
      where id = old.apartment_id
        and not exists (select 1 from public.rentals r
                        where r.apartment_id = old.apartment_id and r.status = 'active');
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

drop trigger if exists trg_sync_apartment on public.rentals;
create trigger trg_sync_apartment
  after insert or update or delete on public.rentals
  for each row execute function public.sync_apartment_status();

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_apartments on public.apartments;
create trigger trg_touch_apartments before update on public.apartments
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_clients on public.clients;
create trigger trg_touch_clients before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_reservations on public.reservations;
create trigger trg_touch_reservations before update on public.reservations
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_rentals on public.rentals;
create trigger trg_touch_rentals before update on public.rentals
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_settings on public.settings;
create trigger trg_touch_settings before update on public.settings
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- SÉCURITÉ (RLS)
-- ----------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.apartments   enable row level security;
alter table public.clients      enable row level security;
alter table public.reservations enable row level security;
alter table public.rentals      enable row level security;
alter table public.payments     enable row level security;
alter table public.expenses     enable row level security;
alter table public.settings     enable row level security;

-- PROFILS
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- APPARTEMENTS
drop policy if exists apartments_select on public.apartments;
create policy apartments_select on public.apartments
  for select to authenticated using (public.is_staff());

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated with check (public.is_admin());

drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists apartments_delete on public.apartments;
create policy apartments_delete on public.apartments
  for delete to authenticated using (public.is_admin());

-- CLIENTS
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated using (public.is_staff());

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert to authenticated with check (public.is_staff());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete to authenticated using (public.is_admin());

-- RÉSERVATIONS
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated using (public.is_staff());

drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
  for insert to authenticated with check (public.is_staff());

drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists reservations_delete on public.reservations;
create policy reservations_delete on public.reservations
  for delete to authenticated using (public.is_admin());

-- LOCATIONS
drop policy if exists rentals_select on public.rentals;
create policy rentals_select on public.rentals
  for select to authenticated using (public.is_staff());

drop policy if exists rentals_insert on public.rentals;
create policy rentals_insert on public.rentals
  for insert to authenticated with check (public.is_staff());

drop policy if exists rentals_update on public.rentals;
create policy rentals_update on public.rentals
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists rentals_delete on public.rentals;
create policy rentals_delete on public.rentals
  for delete to authenticated using (public.is_admin());

-- PAIEMENTS
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (public.is_staff());

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated with check (public.is_staff());

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_admin());

-- DÉPENSES
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated using (public.is_staff());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated with check (public.is_staff());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated using (public.is_admin());

-- PARAMÈTRES
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (public.is_staff());

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- DROITS
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
