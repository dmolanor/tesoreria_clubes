import type { NextRequest } from "next/server"
import { getStore } from "@/lib/data"
import { getSession } from "@/lib/auth/session"
import { nombreUsuario } from "@/lib/domain/ledger"
import { readFile } from "@/lib/storage"
import { formatCOP, formatFecha } from "@/lib/format"

// Sirve archivos de comprobantes. Acceso: el dueño, o tesorero/admin del club (como haría RLS en Storage).
export async function GET(_req: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  const { path } = await ctx.params
  const s = await getSession()
  const db = await getStore().read()

  const isDemo = path[0] === "demo"
  const c = isDemo ? db.comprobantes.find((c) => c.id === path[1]) : db.comprobantes.find((c) => c.archivo_url === path.join("/"))
  if (!c) return new Response("No encontrado", { status: 404 })
  const owner = db.usuarios.find((u) => u.id === c.usuario_id)
  const puedeVer =
    c.usuario_id === s.usuario.id ||
    (owner?.club_id === s.club_id && s.roles.some((r) => r === "tesorero" || r === "administrativo"))
  if (!puedeVer) return new Response("Sin permiso", { status: 403 })

  if (isDemo) {
    const esc = (t: string) => t.replace(/[<>&"]/g, "")
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520" font-family="IBM Plex Sans, Arial, sans-serif">
<rect width="360" height="520" rx="16" fill="#faf9f6" stroke="#d4d4d4"/>
<text x="180" y="60" text-anchor="middle" font-size="15" fill="#737373">Comprobante de transferencia (demo)</text>
<text x="180" y="100" text-anchor="middle" font-size="13" fill="#0e6b5c" font-weight="700">¡Transferencia exitosa!</text>
<text x="180" y="170" text-anchor="middle" font-size="36" font-weight="700" fill="#1c1c1c">${formatCOP(c.monto_total)}</text>
<text x="32" y="240" font-size="13" fill="#737373">De</text><text x="328" y="240" text-anchor="end" font-size="14" fill="#1c1c1c">${esc(nombreUsuario(db, c.usuario_id))}</text>
<text x="32" y="275" font-size="13" fill="#737373">Para</text><text x="328" y="275" text-anchor="end" font-size="14" fill="#1c1c1c">Llave Bre-B @razaultimate</text>
<text x="32" y="310" font-size="13" fill="#737373">Fecha</text><text x="328" y="310" text-anchor="end" font-size="14" fill="#1c1c1c">${formatFecha(c.fecha_carga)}</text>
<text x="32" y="345" font-size="13" fill="#737373">Referencia</text><text x="328" y="345" text-anchor="end" font-size="14" fill="#1c1c1c">${c.id.slice(-8).toUpperCase()}</text>
</svg>`
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" } })
  }

  const file = await readFile(c.archivo_url!)
  if (!file) return new Response("Archivo no encontrado", { status: 404 })
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=3600" } })
}
