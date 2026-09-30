// npm run demo:cuentas → crea (o actualiza) una cuenta de Supabase Auth con DEMO_PASSWORD para cada
// miembro de los datos demo (@example.com). El trigger `vincular_miembros` las enlaza por correo.
// Requiere SUPABASE_SECRET_KEY y DEMO_PASSWORD (.env / .env.local). Solo para entornos de demo.
import { createClient } from "@supabase/supabase-js"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  const password = process.env.DEMO_PASSWORD
  if (!url || !key || !password) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o DEMO_PASSWORD")
  if (password.length < 8) throw new Error("DEMO_PASSWORD debe tener al menos 8 caracteres")

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: miembros, error } = await admin.from("miembros").select("correo").like("correo", "%@example.com")
  if (error) throw error

  const existentes = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error: e } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (e) throw e
    data.users.forEach((u) => u.email && existentes.set(u.email.toLowerCase(), u.id))
    if (data.users.length < 1000) break
  }

  let creadas = 0
  let actualizadas = 0
  for (const { correo } of miembros ?? []) {
    const id = existentes.get(correo.toLowerCase())
    if (id) {
      const { error: e } = await admin.auth.admin.updateUserById(id, { password })
      if (e) throw e
      // Tras recargar el seed los miembros vuelven sin vínculo y el trigger de auth.users no se dispara.
      const { error: e2 } = await admin.from("miembros").update({ auth_user_id: id }).eq("correo", correo).is("auth_user_id", null)
      if (e2) throw e2
      actualizadas++
    } else {
      const { error: e } = await admin.auth.admin.createUser({ email: correo, password, email_confirm: true })
      if (e) throw e
      creadas++
    }
  }
  const { count } = await admin.from("miembros").select("id", { count: "exact", head: true }).not("auth_user_id", "is", null)
  console.log(`Cuentas demo: ${creadas} creadas, ${actualizadas} actualizadas; ${count} miembros vinculados.`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
