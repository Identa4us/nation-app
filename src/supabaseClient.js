import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env)");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Cliente temporal y aislado: permite que el admin cree usuarios (boosters)
// vía signUp SIN tocar ni reemplazar su propia sesión. No persiste sesión.
export function makeTempClient() {
  return createClient(url, key, {
    auth: {
      storageKey: "sb-tmp-" + Math.random().toString(36).slice(2),
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
