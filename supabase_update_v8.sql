-- ============================================================
--  NATION OPS · Ajuste v8
--  Pegá TODO en Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) Teléfono en los perfiles
alter table public.profiles add column if not exists phone text;

-- 2) Preferencias de días/horario en los pedidos
alter table public.orders add column if not exists pref_days  text;
alter table public.orders add column if not exists pref_times text;

-- 3) Trigger de alta de usuario: ahora también guarda teléfono
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role','cliente');
  if v_role not in ('cliente','booster') then v_role := 'cliente'; end if;  -- nadie se auto-asigna admin
  insert into public.profiles (id, email, full_name, role, status, discord, phone)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    v_role,
    case when v_role = 'booster' then 'pending' else 'active' end,
    new.raw_user_meta_data->>'discord',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end; $$;

-- 4) ARREGLO de borrado de pedidos (por si la política no estaba)
drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin on public.orders
  for delete using (public.is_admin());
grant delete on public.orders to authenticated;
