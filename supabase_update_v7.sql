-- ============================================================
--  NATION OPS · Ajuste para la versión v7
--  Pegá TODO esto en Supabase > SQL Editor > New query > Run
--  (es seguro: usa "if exists / if not exists / on conflict")
-- ============================================================

-- 1) Comprobante en los pedidos
alter table public.orders add column if not exists receipt_path text;

-- 2) Depósito de comprobantes (privado) en Storage
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- políticas de Storage (subir: cualquier autenticado; ver: admin o dueño)
drop policy if exists comprobantes_insert       on storage.objects;
drop policy if exists comprobantes_select_admin on storage.objects;
drop policy if exists comprobantes_select_own   on storage.objects;
create policy comprobantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes');
create policy comprobantes_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.is_admin());
create policy comprobantes_select_own on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and owner = auth.uid());

-- 3) Pool de cuentas de juego
create table if not exists public.game_accounts (
  id            bigint generated always as identity primary key,
  summoner      text not null,
  rank          text,
  login_user    text,
  login_pass    text,
  status        text not null default 'activa' check (status in ('activa','inactiva','deshabilitada')),
  taken_by      uuid references public.profiles(id) on delete set null,
  taken_by_name text,
  created_at    timestamptz default now()
);
alter table public.game_accounts enable row level security;

drop policy if exists ga_admin          on public.game_accounts;
drop policy if exists ga_select_booster on public.game_accounts;
drop policy if exists ga_take           on public.game_accounts;
drop policy if exists ga_return         on public.game_accounts;

-- admin: control total
create policy ga_admin on public.game_accounts for all
  using (public.is_admin()) with check (public.is_admin());
-- booster activo: ve disponibles y las que tiene en uso
create policy ga_select_booster on public.game_accounts for select
  using (public.is_active_booster() and (status = 'activa' or taken_by = auth.uid()));
-- booster toma una cuenta disponible
create policy ga_take on public.game_accounts for update
  using (public.is_active_booster() and status = 'activa')
  with check (taken_by = auth.uid() and status = 'inactiva');
-- booster devuelve su cuenta
create policy ga_return on public.game_accounts for update
  using (taken_by = auth.uid() and status = 'inactiva')
  with check (status = 'activa');

grant select, insert, update, delete on public.game_accounts to authenticated;

-- tiempo real para cuentas
do $$ begin
  alter publication supabase_realtime add table public.game_accounts;
exception when others then null; end $$;
