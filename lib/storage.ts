import "server-only"
import { promises as fs } from "node:fs"
import path from "node:path"
import { DATA_DIR } from "@/lib/data/json-store"

// Sustituto de Supabase Storage: archivos en .data/uploads/.

const UPLOADS = path.join(DATA_DIR, "uploads")
const PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
}
export const MAX_BYTES = 8 * 1024 * 1024

/** Guarda el archivo y devuelve su ruta relativa (lo que va en `comprobantes.archivo_url`). */
export async function saveFile(file: File): Promise<string> {
  const ext = PERMITIDOS[file.type]
  if (!ext) throw new Error(`Tipo de archivo no permitido: ${file.type || "desconocido"}`)
  if (file.size > MAX_BYTES) throw new Error("El archivo pesa más de 8 MB")
  await fs.mkdir(UPLOADS, { recursive: true })
  const name = `${crypto.randomUUID()}.${ext}`
  await fs.writeFile(path.join(UPLOADS, name), Buffer.from(await file.arrayBuffer()))
  return `uploads/${name}`
}

export async function readFile(rel: string): Promise<{ data: Buffer; type: string } | null> {
  const name = path.basename(rel) // nunca permitir rutas fuera de uploads/
  const ext = path.extname(name).slice(1)
  const type = Object.entries(PERMITIDOS).find(([, e]) => e === ext)?.[0]
  if (!type) return null
  try {
    return { data: await fs.readFile(path.join(UPLOADS, name)), type }
  } catch {
    return null
  }
}

export function isAllowedType(type: string) {
  return type in PERMITIDOS
}
