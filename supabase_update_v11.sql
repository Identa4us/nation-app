-- ============================================================
--  NATION OPS · Ajuste v11
--  Credenciales de cuenta para pedidos de Eloboost
--  Pegá TODO en Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.orders add column if not exists acct_user text;
alter table public.orders add column if not exists acct_pass text;
