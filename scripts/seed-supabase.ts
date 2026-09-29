// npm run seed:supabase → carga supabase/seed.sql en la base de Supabase.
// Requiere SUPABASE_DB_URL en .env.local (Dashboard → Connect → Session pooler). Nunca se imprime.
import { promises as fs } from "node:fs"
import path from "node:path"
import { Client } from "pg"

async function main() {
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    console.error("Falta SUPABASE_DB_URL en .env.local (Dashboard → Connect → Session pooler).")
    process.exit(1)
  }
  const sql = await fs.readFile(path.join(process.cwd(), "supabase", "seed.sql"), "utf8")
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    const { rows } = await client.query(`
      select (select count(*) from public.miembros) miembros,
             (select count(*) from public.eventos_cobro) eventos,
             (select count(*) from public.obligaciones) obligaciones,
             (select count(*) from public.comprobantes where estado = 'pendiente') pendientes,
             (select count(*) from public.bitacora) bitacora`)
    console.log("Seed cargado:", rows[0])
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
