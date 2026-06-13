# NATION OPS — Panel de operaciones (Eloboost Nation)

App de gestión con 3 roles (Admin / Booster / Cliente).
Frontend: React + Vite (deploy en **Netlify**). Base de datos + Auth + Tiempo real: **Supabase**.

## Flujo automatizado
1. El **cliente** se registra y carga su pedido → queda `En revisión`.
2. El **admin** valida el pedido (confirma el pago) → pasa a `Disponible` y se avisa a los boosters.
3. Aparece como "nuevo cliente" en el inicio de los **boosters**. El primero que **acepta** se lo queda; el pedido pasa a `En proceso` y **desaparece para los demás** (en tiempo real).
4. Coordinan por Discord. El booster marca **Finalizado**.
5. Al cliente le aparece la **encuesta** automáticamente. Las métricas del admin se actualizan solas.

Los **boosters** se registran solos pero quedan `pending`: el admin los **habilita** y les fija el corte.
El **admin** no se puede crear desde la web (por seguridad); se crea una sola vez (ver abajo).

---

## PARTE 1 — Supabase (base de datos)

1. Entrá a https://supabase.com → **New project**. Anotá la contraseña de la DB.
2. Cuando esté listo: menú **SQL Editor → New query**, pegá TODO el contenido de
   `supabase_schema.sql` y tocá **Run**. Esto crea tablas, seguridad por roles y tiempo real.
3. **Desactivá la confirmación por email** (para que admin/boosters/clientes entren al toque):
   **Authentication → Sign In / Providers → Email →** desactivá *"Confirm email"* → Save.
4. **Crear el admin (una sola vez):**
   - Opción A (recomendada): **Authentication → Users → Add user** →
     email `admin@eloboostnation.com`, password `NationAdmin2026!`, marcá *Auto Confirm User* → crear.
   - Luego en **SQL Editor** corré:
     ```sql
     update public.profiles set role='admin', status='active'
     where email = 'admin@eloboostnation.com';
     ```
   - (Si el perfil no existiera todavía, primero iniciá sesión una vez con ese usuario en la app y repetí el UPDATE.)
5. Copiá tus credenciales: **Project Settings → API →** `Project URL` y `anon public key`.

> Cambiá la contraseña del admin después del primer login.

---

## PARTE 2 — Netlify (frontend)

### Opción rápida (sin GitHub)
1. En tu compu, dentro de la carpeta del proyecto:
   ```bash
   npm install
   npm run build
   ```
2. En Netlify → **Add new site → Deploy manually** y arrastrá la carpeta `dist`.
3. **Site settings → Environment variables**, agregá:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon public key
4. Volvé a hacer `npm run build` y re-subí `dist` (las variables se inyectan en el build).

### Opción recomendada (GitHub + deploy automático)
1. Subí esta carpeta a un repo de GitHub.
2. Netlify → **Add new site → Import from Git** → elegí el repo.
   - Build command: `npm run build`  ·  Publish directory: `dist` (ya está en `netlify.toml`).
3. En **Environment variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Cada push actualiza el sitio solo.

---

## Correr en local
```bash
cp .env.example .env     # completá las dos variables
npm install
npm run dev              # http://localhost:5173
```

## Probar el ciclo completo
1. Entrá como **admin** (`admin@eloboostnation.com`).
2. En otra pestaña/incógnito, **Crear cuenta → Booster** y otra **Crear cuenta → Cliente**.
3. Como admin: pestaña **Validaciones** → habilitá al booster (asignale corte) y validá el pedido del cliente.
4. Como booster: **Trabajos disponibles** → Aceptar. (Si lo intenta otro booster, le dirá que ya fue tomado.)
5. Como booster: **Mis servicios → Finalizar**. Como cliente: aparece la **encuesta**.

## Archivos
- `supabase_schema.sql` — todo el backend (correr una vez).
- `src/App.jsx` — la aplicación.
- `src/supabaseClient.js` — conexión (usa las variables de entorno).
- `netlify.toml` — config de deploy + redirects SPA.

## Notas de seguridad
- Las **políticas RLS** garantizan que cada rol vea solo lo suyo: un booster no ve pedidos de otros ni datos pendientes; un cliente solo ve los propios; el admin ve todo.
- El alta de perfil sanitiza el rol: nadie puede auto-registrarse como admin.
- Subí solo la `anon key` al frontend (es pública por diseño). **Nunca** pongas la `service_role` key en el cliente.

## Próximos pasos sugeridos
- Bot de Discord que cree el canal `#pedido-N` y avise al equipo (hoy se usa el invite general).
- Integrar link de pago (Mercado Pago / PayPal) que dispare la validación automática.
- Reportes por mes/servicio/país como tu hoja de GANANCIAS y métricas de publicidad.
