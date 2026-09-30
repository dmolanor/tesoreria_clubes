import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/data/database.types"

/**
 * Cliente con la secret key: se salta RLS. Usos permitidos, siempre del lado del servidor:
 * modo demo (listar y cambiar de cuenta demo), invitar por correo (`lib/auth/invitar.ts`, después
 * de `requireRole("administrativo")`) y completar el registro propio (`app/actions/registro.ts`).
 * Ninguna lectura de negocio debe usarlo.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error("Falta SUPABASE_SECRET_KEY")
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
