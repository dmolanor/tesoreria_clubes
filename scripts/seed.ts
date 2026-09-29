// npm run seed → reescribe .data/db.json con los datos demo.
import { promises as fs } from "node:fs"
import path from "node:path"
import { buildSeed } from "../lib/data/seed"

async function main() {
  const dir = path.join(process.cwd(), ".data")
  await fs.mkdir(dir, { recursive: true })
  const db = buildSeed()
  await fs.writeFile(path.join(dir, "db.json"), JSON.stringify(db, null, 1))
  const pendientes = db.comprobantes.filter((c) => c.estado === "pendiente").length
  console.log(
    `Datos demo: ${db.usuarios.length} usuarios, ${db.eventos_cobro.length} eventos, ` +
      `${db.obligaciones.length} obligaciones, ${db.comprobantes.length} comprobantes (${pendientes} pendientes), ` +
      `${db.bitacora.length} entradas de bitácora.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
