-- ============================================================
--  NATION OPS · Ajuste para la versión v4
--  Pegá esto en Supabase > SQL Editor > New query > Run
--  (es seguro correrlo aunque ya exista algo: usa "if exists / if not exists")
-- ============================================================

-- 1) Permitir que SOLO el admin elimine pedidos
drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin on public.orders
  for delete using (public.is_admin());

-- 2) Columnas para que las notificaciones sepan a dónde llevar al tocarlas
alter table public.notifications add column if not exists link_type text;
alter table public.notifications add column if not exists link_id   text;
