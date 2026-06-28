-- ============================================================
--  NATION OPS · Ajuste v10
--  Permite el servicio "eloboost" en los pedidos
--  Pegá TODO en Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.orders drop constraint if exists orders_service_check;
alter table public.orders
  add constraint orders_service_check
  check (service in ('duoboost','coaching','combo','eloboost'));
