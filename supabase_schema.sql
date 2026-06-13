-- ============================================================
--  NATION OPS · Esquema de base de datos (Supabase / Postgres)
--  Pegá TODO este archivo en: Supabase > SQL Editor > New query > Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- TABLAS ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'cliente' check (role in ('admin','booster','cliente')),
  status      text not null default 'active'  check (status in ('active','pending','disabled')),
  cut         numeric not null default 0.55,   -- corte del booster (0.50 = 50%)
  discord     text,
  created_at  timestamptz default now()
);

create table if not exists public.orders (
  id            bigint generated always as identity primary key,
  client_id     uuid references public.profiles(id) on delete set null,
  client_name   text,
  client_discord text,
  service       text not null check (service in ('duoboost','coaching','combo')),
  cur_rank text, cur_div text,
  tgt_rank text, tgt_div text,
  server   text, lp text, games int,
  role_champ text, notes text, payment text,
  price         numeric not null default 0,
  status        text not null default 'pending'
                check (status in ('pending','available','in_progress','completed','cancelled')),
  booster_id    uuid references public.profiles(id) on delete set null,
  booster_name  text,
  booster_pay   numeric default 0,
  profit        numeric default 0,
  survey_rating int, survey_comment text, survey_recommend boolean,
  created_at    timestamptz default now(),
  accepted_at   timestamptz,
  completed_at  timestamptz
);

create table if not exists public.notifications (
  id             bigint generated always as identity primary key,
  recipient_role text,          -- 'booster' | 'admin' | 'cliente'  (broadcast por rol)
  recipient_id   uuid,          -- o destinatario puntual
  text           text not null,
  icon           text default 'bell',
  created_at     timestamptz default now()
);

-- ---------- FUNCIONES AUXILIARES (evitan recursión de RLS) ----------
create or replace function public.my_role() returns text
language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_active_booster() returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.profiles
                where id = auth.uid() and role = 'booster' and status = 'active');
$$;

-- ---------- ALTA AUTOMÁTICA DE PERFIL AL REGISTRARSE ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role','cliente');
  if v_role not in ('cliente','booster') then v_role := 'cliente'; end if;  -- nadie se auto-asigna admin
  insert into public.profiles (id, email, full_name, role, status, discord)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    v_role,
    case when v_role = 'booster' then 'pending' else 'active' end,  -- boosters quedan pendientes de aprobación
    new.raw_user_meta_data->>'discord'
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- GUARDA: solo el admin cambia role/status/cut ----------
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
    new.cut    := old.cut;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_select_own   on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_update_own   on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- orders
drop policy if exists orders_select_admin         on public.orders;
drop policy if exists orders_select_client        on public.orders;
drop policy if exists orders_select_booster_avail on public.orders;
drop policy if exists orders_select_booster_own   on public.orders;
drop policy if exists orders_insert_client        on public.orders;
drop policy if exists orders_update_admin         on public.orders;
drop policy if exists orders_claim                on public.orders;
drop policy if exists orders_booster_finish       on public.orders;
drop policy if exists orders_client_survey        on public.orders;

create policy orders_select_admin         on public.orders for select using (public.is_admin());
create policy orders_select_client        on public.orders for select using (client_id = auth.uid());
create policy orders_select_booster_avail on public.orders for select using (public.is_active_booster() and status = 'available');
create policy orders_select_booster_own   on public.orders for select using (booster_id = auth.uid());

create policy orders_insert_client on public.orders for insert
  with check (client_id = auth.uid() and status = 'pending');

create policy orders_update_admin on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

-- el booster "toma" un pedido disponible -> queda en proceso y bloqueado para los demás
create policy orders_claim on public.orders for update
  using (public.is_active_booster() and status = 'available')
  with check (booster_id = auth.uid() and status = 'in_progress');

-- el booster finaliza su propio pedido
create policy orders_booster_finish on public.orders for update
  using (booster_id = auth.uid() and status = 'in_progress')
  with check (booster_id = auth.uid() and status = 'completed');

-- el cliente deja la encuesta en su pedido finalizado
create policy orders_client_survey on public.orders for update
  using (client_id = auth.uid() and status = 'completed')
  with check (client_id = auth.uid() and status = 'completed');

-- notifications
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_insert on public.notifications;
create policy notif_select on public.notifications for select using (
  public.is_admin()
  or recipient_id = auth.uid()
  or (recipient_id is null and recipient_role = public.my_role())
);
create policy notif_insert on public.notifications for insert with check (auth.uid() is not null);

-- ---------- GRANTS ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ---------- TIEMPO REAL ----------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;
-- Si alguna línea de arriba dice "is already member of publication", ignorala.

-- ============================================================
--  DESPUÉS de correr esto y de crear tu usuario admin (ver README),
--  ejecutá esta línea para convertirlo en admin:
--
--  update public.profiles set role='admin', status='active'
--  where email = 'admin@eloboostnation.com';
-- ============================================================
