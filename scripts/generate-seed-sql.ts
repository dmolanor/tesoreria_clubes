// npm run seed:sql → escribe supabase/seed.sql con los datos demo en el esquema de Supabase.
// Reutiliza buildSeed() (el mismo historial jul–sep 2026 del prototipo JSON) y lo mapea:
//   usuarios + roles_usuario → miembros; pagos_aplicados + saldo_a_favor → aplicaciones.
// Se aplica con `supabase db reset` o ejecutándolo como postgres (MCP execute_sql).

import { promises as fs } from "node:fs"
import path from "node:path"
import { buildSeed, DEMO_IDS } from "./demo/seed"
import { diaLocal } from "../lib/format"
import type { Db, EventoCobro } from "./demo/types"

type Val = string | number | boolean | null | undefined | string[] | Record<string, unknown>

function lit(v: Val): string {
  if (v === null || v === undefined) return "null"
  if (typeof v === "number") return String(v)
  if (typeof v === "boolean") return v ? "true" : "false"
  if (Array.isArray(v)) return `'{${v.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(",")}}'`
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${v.replace(/'/g, "''")}'`
}

// Lotes de 50 filas: sentencias legibles y fáciles de partir en bloques.
function insert(table: string, cols: string[], rows: Val[][]): string {
  let out = ""
  for (let i = 0; i < rows.length; i += 50) {
    const values = rows.slice(i, i + 50).map((r) => `  (${r.map(lit).join(", ")})`).join(",\n")
    out += `insert into public.${table} (${cols.join(", ")}) values\n${values};\n\n`
  }
  return out
}

function tipoCobro(e: EventoCobro): string {
  const n = e.nombre.toLowerCase()
  if (n.startsWith("mensualidad")) return "mensualidad"
  if (n.startsWith("afiliaci")) return "afiliacion"
  if (n.includes("torneo") || n.includes("team fee")) return "torneo"
  if (n.startsWith("uniforme")) return "uniforme"
  return "otro"
}

export function seedSql(db: Db): string {
  const club = db.clubes[0]
  const byTime = <T extends { t: string }>(xs: T[]) => xs.sort((a, b) => a.t.localeCompare(b.t))
  const rolesDe = (id: string) => db.roles_usuario.filter((r) => r.usuario_id === id && r.activo).map((r) => r.rol)
  const adminId = db.usuarios.find((u) => rolesDe(u.id).includes("administrativo"))!.id

  // Aplicaciones: las de comprobantes (propuesta/manual) + las de saldo a favor consumido, en orden temporal.
  const comp = new Map(db.comprobantes.map((c) => [c.id, c]))
  const obl = new Map(db.obligaciones.map((o) => [o.id, o]))
  const huerfanos = db.saldo_a_favor.filter((s) => s.origen_comprobante_id === null)
  if (huerfanos.length) throw new Error(`Saldo a favor sin comprobante de origen (${huerfanos.length}); el esquema no lo soporta`)
  const aplicaciones = byTime([
    ...db.pagos_aplicados
      .filter((p) => p.obligacion_id)
      .map((p) => ({
        t: comp.get(p.comprobante_id)!.revisado_en!,
        row: [p.id, club.id, p.comprobante_id, p.obligacion_id, p.monto_aplicado, p.regla_aplicada ? "propuesta" : "manual", p.regla_aplicada, comp.get(p.comprobante_id)!.revisado_por, comp.get(p.comprobante_id)!.revisado_en] as Val[],
      })),
    ...db.saldo_a_favor
      .filter((s) => s.consumido && s.consumido_en_obligacion_id)
      .map((s) => ({
        t: obl.get(s.consumido_en_obligacion_id!)!.created_at,
        row: [s.id, club.id, s.origen_comprobante_id, s.consumido_en_obligacion_id, s.monto, "saldo_a_favor", null, adminId, obl.get(s.consumido_en_obligacion_id!)!.created_at] as Val[],
      })),
  ])

  const objetivo: Record<string, string> = { usuario: "miembro" }

  // Tres acuerdos de pago demo: jugadores activos con deudas sin pagar, de la más reciente primero.
  const nombreEvento = new Map(db.eventos_cobro.map((e) => [e.id, e]))
  const limiteDe = (eventoId: string) => nombreEvento.get(eventoId)!.fecha_limite
  const especiales = new Set(Object.values(DEMO_IDS))
  const activos = new Set(db.usuarios.filter((u) => u.estado === "activo" && !especiales.has(u.id)).map((u) => u.id))
  const candidatas = db.obligaciones
    .filter((o) => o.estado !== "pagado" && activos.has(o.usuario_id))
    .sort((a, b) => limiteDe(b.evento_cobro_id).localeCompare(limiteDe(a.evento_cobro_id)))
  const elegidas = [...new Map(candidatas.map((o) => [o.usuario_id, o])).values()].slice(0, 3)
  const nombreUsuario = new Map(db.usuarios.map((u) => [u.id, u.nombre]))
  const tesoreraId = DEMO_IDS.tesorera
  const acuerdos = elegidas.map((o, i) => {
    const id = `00000000-0000-4000-8000-a0000000000${i + 1}`
    const fechas = ["2026-10-05", "2026-10-15", "2026-10-25"].slice(0, i === 0 ? 3 : 2)
    const base = Math.floor(o.monto / fechas.length)
    const cuotas = fechas.map((fecha, j) => ({
      id: `00000000-0000-4000-8000-b000000000${i}${j}`,
      numero: j + 1,
      fecha,
      monto: j === fechas.length - 1 ? o.monto - base * (fechas.length - 1) : base,
    }))
    return { id, obligacion: o, created_at: `2026-09-${20 + i}T15:00:00.000Z`, cuotas }
  })

  let sql = `-- Generado por scripts/generate-seed-sql.ts — no editar a mano.
-- Datos demo: Raza Ultimate, ~48 jugadores, historial jul–sep 2026.
begin;
select set_config('app.seed', 'on', true);  -- la bitácora se copia del seed, sin duplicar por triggers

truncate public.bitacora, public.tareas_miembros, public.tareas, public.cuotas_acuerdo, public.acuerdos_pago, public.aplicaciones,
  public.conciliaciones, public.egresos, public.comprobantes, public.obligaciones, public.reglas_conciliacion,
  public.tarifas_estado, public.eventos_cobro, public.miembros, public.clubes
  restart identity cascade;

`
  sql += insert("clubes", ["id", "nombre", "categorias", "created_at"], [[club.id, club.nombre, ["Élite", "Junior"], club.created_at]])
  sql += insert(
    "tarifas_estado",
    ["club_id", "estado", "monto_mensual", "updated_at"],
    db.tarifas_estado.map((t) => [t.club_id, t.estado, t.monto_mensual, t.updated_at]),
  )
  sql += insert(
    "miembros",
    ["id", "club_id", "nombre", "correo", "categoria", "estado", "roles", "created_at"],
    db.usuarios.map((u) => [u.id, u.club_id, u.nombre, u.correo, u.categoria, u.estado, rolesDe(u.id), u.created_at]),
  )
  sql += insert(
    "reglas_conciliacion",
    ["id", "club_id", "nombre", "tipo", "parametros", "prioridad", "activa", "created_at"],
    db.reglas_conciliacion.map((r) => [r.id, r.club_id, r.nombre, r.tipo, r.condicion, r.prioridad, r.activa, r.created_at]),
  )
  sql += insert(
    "eventos_cobro",
    ["id", "club_id", "nombre", "tipo", "monto", "fecha_limite", "alcance", "categoria", "estado", "cancelado_en", "creado_por", "created_at"],
    db.eventos_cobro.map((e) => [
      e.id, e.club_id, e.nombre, tipoCobro(e), e.monto, e.fecha_limite, e.alcance,
      e.alcance === "grupo" ? e.alcance_valor : null, e.estado, e.estado === "cancelado" ? e.fecha_creacion : null, adminId, e.fecha_creacion,
    ]),
  )
  sql += insert(
    "obligaciones",
    ["id", "club_id", "evento_id", "miembro_id", "monto", "created_at"],
    db.obligaciones.map((o) => [o.id, club.id, o.evento_cobro_id, o.usuario_id, o.monto, o.created_at]),
  )
  if (acuerdos.length) {
    sql += insert(
      "acuerdos_pago",
      ["id", "club_id", "miembro_id", "obligacion_id", "notas", "creado_por", "created_at"],
      acuerdos.map((a) => [a.id, club.id, a.obligacion.usuario_id, a.obligacion.id, "Acuerdo demo", tesoreraId, a.created_at]),
    )
    sql += insert(
      "cuotas_acuerdo",
      ["id", "club_id", "acuerdo_id", "numero", "fecha", "monto", "created_at"],
      acuerdos.flatMap((a) => a.cuotas.map((c) => [c.id, club.id, a.id, c.numero, c.fecha, c.monto, a.created_at])),
    )
  }
  // Dos tareas demo (no financieras): una de grupo (Élite) y una para todos los jugadores activos.
  // Algunos jugadores ya la marcaron como hecha, para mostrar el progreso en la tarjeta del admin/tesorero.
  const jugadoresElite = db.usuarios.filter((u) => u.categoria === "Élite" && rolesDe(u.id).includes("jugador") && u.estado === "activo")
  const jugadoresActivos = db.usuarios.filter((u) => rolesDe(u.id).includes("jugador") && u.estado === "activo")
  const tareasDemo = [
    {
      id: "00000000-0000-4000-8000-d00000000001",
      nombre: "Entrega de uniformes nuevos",
      link: "https://forms.gle/raza-uniformes-2026",
      fecha_limite: "2026-10-15",
      alcance: "grupo" as const,
      categoria: "Élite" as string | null,
      asignados: jugadoresElite,
      cada: 2, // la mitad ya la marcó
      created_at: "2026-09-22T14:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-d00000000002",
      nombre: "Diligenciar encuesta de la liga",
      link: "https://tally.so/r/raza-encuesta-liga",
      fecha_limite: "2026-10-25",
      alcance: "todos" as const,
      categoria: null as string | null,
      asignados: jugadoresActivos,
      cada: 3, // uno de cada tres ya la marcó
      created_at: "2026-09-24T09:00:00.000Z",
    },
  ]
  sql += insert(
    "tareas",
    ["id", "club_id", "nombre", "link", "fecha_limite", "alcance", "categoria", "creado_por", "created_at"],
    tareasDemo.map((t) => [t.id, club.id, t.nombre, t.link, t.fecha_limite, t.alcance, t.categoria, adminId, t.created_at]),
  )
  sql += insert(
    "tareas_miembros",
    ["tarea_id", "miembro_id", "club_id", "completada_en"],
    tareasDemo.flatMap((t) => t.asignados.map((u, i) => [t.id, u.id, club.id, i % t.cada === 0 ? "2026-09-27T16:00:00.000Z" : null])),
  )
  sql += insert(
    "comprobantes",
    ["id", "club_id", "miembro_id", "monto", "fecha_pago", "canal", "estado", "motivo_rechazo", "revisado_por", "revisado_en", "created_at"],
    db.comprobantes.map((c) => [
      c.id, club.id, c.usuario_id, c.monto_total, diaLocal(c.fecha_carga), c.canal, c.estado, c.motivo_rechazo, c.revisado_por, c.revisado_en, c.fecha_carga,
    ]),
  )
  sql += insert(
    "aplicaciones",
    ["id", "club_id", "comprobante_id", "obligacion_id", "monto", "origen", "regla_id", "creado_por", "created_at"],
    aplicaciones.map((a) => a.row),
  )
  // Antes que las conciliaciones: su trigger calcula `total_egresos` al insertarlas.
  // Después que comprobantes: un cruce enlaza `comprobante_id` a un comprobante que ya existe.
  sql += insert(
    "egresos",
    ["id", "club_id", "fecha", "monto", "concepto", "categoria", "categoria_otro", "evento_id", "comprobante_id", "creado_por", "anulado_en", "created_at"],
    db.egresos.map((e) => [
      e.id, e.club_id, e.fecha, e.monto, e.concepto, e.categoria, e.categoria_otro, e.evento_id, e.comprobante_id, e.creado_por, e.anulado_en, e.created_at,
    ]),
  )
  sql += insert(
    "conciliaciones",
    ["id", "club_id", "mes", "saldo_inicial", "saldo_final", "notas", "creado_por", "created_at"],
    db.conciliaciones.map((c) => [c.id, c.club_id, c.mes, c.saldo_inicial, c.saldo_final, c.notas, c.creado_por, c.created_at]),
  )
  const bitacoraAcuerdos: Val[][] = acuerdos.map((a) => {
    const evento = nombreEvento.get(a.obligacion.evento_cobro_id)!
    const total = a.cuotas.reduce((s, c) => s + c.monto, 0)
    return [
      club.id,
      "acuerdo_pago_cambiado",
      tesoreraId,
      "acuerdo_pago",
      a.id,
      `Laura Gómez registró el acuerdo de pago de ${nombreUsuario.get(a.obligacion.usuario_id)} ($${total.toLocaleString("es-CO")} en ${a.cuotas.length} cuotas, para "${evento.nombre}")`,
      { accion: "registró", total, cuotas: a.cuotas.length },
      a.created_at,
    ]
  })
  const bitacoraTareas: Val[][] = tareasDemo.map((t) => [
    club.id,
    "tarea_creada",
    adminId,
    "tarea",
    t.id,
    `Andrés Molina creó la tarea "${t.nombre}" (vence ${t.fecha_limite.split("-").reverse().join("/")})`,
    { alcance: t.alcance, categoria: t.categoria },
    t.created_at,
  ])
  sql += insert(
    "bitacora",
    ["club_id", "tipo", "actor_id", "objetivo_tipo", "objetivo_id", "descripcion", "metadata", "created_at"],
    [
      ...[...db.bitacora]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((b) => [b.club_id, b.tipo, b.actor_id, objetivo[b.objetivo_tipo] ?? b.objetivo_tipo, b.objetivo_id, b.descripcion, b.metadata, b.created_at] as Val[]),
      ...bitacoraAcuerdos,
      ...bitacoraTareas,
    ],
  )
  sql += "commit;\n"
  return sql
}

/**
 * Parte el seed en bloques autocontenidos (cada uno en su transacción) para cargarlo por
 * canales con límite de tamaño, como `execute_sql` del MCP. El orden de los bloques importa.
 */
function bloques(sql: string, maxBytes: number): string[] {
  // Los ids demo comparten prefijo: se abrevian y una función temporal los reconstruye.
  const U = "create or replace function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(x, 12, '0'))::uuid $$;"
  const cuerpo = sql
    .slice(sql.indexOf("truncate"), sql.lastIndexOf("commit;"))
    .replace(/'00000000-0000-4000-8000-0*([0-9a-f]+)'/g, "pg_temp.u('$1')")
    .replace(/\.000Z'/g, "Z'")
  const sentencias = cuerpo.split(/;\n\n/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  let actual: string[] = []
  const cierra = () => {
    if (actual.length) out.push(`begin;\nselect set_config('app.seed', 'on', true);\n${U}\n${actual.join(";\n")};\ncommit;\n`)
    actual = []
  }
  for (const s of sentencias) {
    if (actual.join("").length + s.length > maxBytes) cierra()
    actual.push(s)
  }
  cierra()
  return out
}

async function main() {
  const sql = seedSql(buildSeed())
  const out = path.join(process.cwd(), "supabase", "seed.sql")
  await fs.writeFile(out, sql)
  console.log(`Escrito ${path.relative(process.cwd(), out)}`)
  const dir = process.argv[2]
  if (dir) {
    await fs.mkdir(dir, { recursive: true })
    const partes = bloques(sql, 45_000)
    await Promise.all(partes.map((p, i) => fs.writeFile(path.join(dir, `seed-${String(i + 1).padStart(2, "0")}.sql`), p)))
    console.log(`${partes.length} bloques en ${dir}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
