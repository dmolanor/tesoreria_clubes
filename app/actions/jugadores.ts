"use server"

import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/session"
import { check, runAction, DomainError, type ActionResult } from "@/lib/action-result"
import { categoriasDelClub } from "@/lib/db/admin"
import { invitarCorreo, origenDeLaPeticion } from "@/lib/auth/invitar"
import { correoValido, esCorreoDemo, normalizarCategoria, normalizarCorreo } from "@/lib/invitaciones"
import type { EstadoMiembro, Rol } from "@/lib/db/types"

/**
 * Cambia el estado; al dejar de estar activo la base prorratea la mensualidad del mes de la fecha
 * efectiva (YYYY-MM-DD). Sin fecha, la base usa hoy; una fecha futura la rechaza la base.
 */
export async function cambiarEstadoAction(
  miembroId: string,
  estado: EstadoMiembro,
  fechaEfectiva?: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    if (fechaEfectiva !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fechaEfectiva)) {
      throw new DomainError("Elige una fecha válida para el cambio de estado")
    }
    check(
      await s.supabase.rpc("cambiar_estado_miembro", {
        p_miembro_id: miembroId,
        p_estado: estado,
        ...(fechaEfectiva ? { p_fecha_efectiva: fechaEfectiva } : {}),
      }),
    )
    return `Estado cambiado a ${estado}`
  })
}

/** Multi-rol: agrega o quita un rol del arreglo `miembros.roles`. */
export async function setRolAction(miembroId: string, rol: Rol, activo: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const m = check(await s.supabase.from("miembros").select("roles").eq("id", miembroId).single())
    const actuales = m?.roles ?? []
    const roles = activo ? [...new Set([...actuales, rol])] : actuales.filter((r) => r !== rol)
    if (roles.length === 0) throw new DomainError("Un miembro debe conservar al menos un rol")
    check(await s.supabase.from("miembros").update({ roles }).eq("id", miembroId))
  })
}

type Fila = { nombre: string; correo: string; categoria: string }

/** Encuentra columnas por nombre de encabezado (nombre, correo/email, categoría). */
function mapearFilas(rows: string[][]): Fila[] {
  const [header, ...data] = rows
  if (!header) return []
  const norm = header.map((h) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase())
  const iNombre = norm.findIndex((h) => h.startsWith("nombre"))
  const iCorreo = norm.findIndex((h) => h.startsWith("correo") || h.includes("email") || h.includes("mail"))
  const iCat = norm.findIndex((h) => h.startsWith("categoria"))
  if (iNombre < 0 || iCorreo < 0) throw new DomainError("El archivo necesita columnas 'nombre' y 'correo'")
  return data
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => ({ nombre: r[iNombre] ?? "", correo: r[iCorreo] ?? "", categoria: iCat >= 0 ? (r[iCat] ?? "") : "" }))
}

async function leerArchivo(file: File): Promise<string[][]> {
  const buf = Buffer.from(await file.arrayBuffer())
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = buf.toString("utf8").replace(/^﻿/, "")
    const sep = text.split("\n")[0].includes(";") ? ";" : ","
    return text.split(/\r?\n/).map((line) => line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()))
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows: string[][] = []
  ws.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1)
    rows.push(
      values.map((v) => {
        if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text)
        return v == null ? "" : String(v)
      }),
    )
  })
  return rows
}

/** Carga masiva: crea los nuevos y omite los correos que ya existen. Entran con magic link por su correo. */
export async function importarJugadoresAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const file = formData.get("archivo")
    if (!(file instanceof File) || file.size === 0) throw new DomainError("Elige un archivo .xlsx o .csv")
    const filas = mapearFilas(await leerArchivo(file))
    if (filas.length === 0) throw new DomainError("El archivo no tiene filas de jugadores")
    const categorias = await categoriasDelClub(s.supabase, s.club_id)
    const invalidas = filas.filter((f) => !f.nombre.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo.trim()))
    if (invalidas.length) throw new DomainError(`Fila inválida: ${invalidas[0].nombre || "(sin nombre)"} <${invalidas[0].correo}>`)

    const unicas = [...new Map(filas.map((f) => [f.correo.trim().toLowerCase(), f])).values()]
    const creados = check(
      await s.supabase
        .from("miembros")
        .upsert(
          unicas.map((f) => ({
            club_id: s.club_id,
            nombre: f.nombre.trim(),
            correo: f.correo.trim().toLowerCase(),
            categoria: normalizarCategoria(f.categoria, categorias),
            roles: ["jugador" as const],
          })),
          { onConflict: "club_id,correo", ignoreDuplicates: true },
        )
        .select("id"),
    )
    const n = creados?.length ?? 0
    return `${n} jugadores creados; ${filas.length - n} omitidos porque su correo ya existía. Podrán entrar cuando les envíes la invitación desde el inicio.`
  })
}

/**
 * Alta individual: crea el miembro (jugador) y le envía la invitación. Si el correo ya estaba en el
 * club sin cuenta, solo reenvía la invitación. La bitácora registra la alta (trigger de `miembros`).
 */
export async function agregarJugadorAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const nombre = String(formData.get("nombre") ?? "").trim()
    const correo = normalizarCorreo(String(formData.get("correo") ?? ""))
    if (!nombre) throw new DomainError("Escribe el nombre")
    if (!correoValido(correo)) throw new DomainError("Escribe un correo válido")
    const categoria = normalizarCategoria(String(formData.get("categoria") ?? ""), await categoriasDelClub(s.supabase, s.club_id))

    const existente = check(
      await s.supabase.from("miembros").select("nombre, auth_user_id").eq("club_id", s.club_id).eq("correo", correo).maybeSingle(),
    )
    if (existente?.auth_user_id) throw new DomainError(`${existente.nombre} ya está en el club con ${correo} y tiene cuenta`)
    if (!existente) {
      check(await s.supabase.from("miembros").insert({ club_id: s.club_id, nombre, correo, categoria, roles: ["jugador"] }))
    }
    const quien = existente?.nombre ?? nombre

    let r: Awaited<ReturnType<typeof invitarCorreo>>
    try {
      r = await invitarCorreo(s.club_id, correo, await origenDeLaPeticion())
    } catch (e) {
      // El miembro ya quedó creado: refrescar para que aparezca en "Invitar a los N sin cuenta".
      revalidatePath("/", "layout")
      const motivo = e instanceof Error ? e.message : String(e)
      throw new DomainError(`${quien} quedó en el club, pero la invitación no salió (${motivo}). Reintenta desde "Invitar a los sin cuenta"`)
    }
    if (r === "demo") return `${quien} agregado. Es un correo de demo, así que no se envía invitación`
    if (r === "ya_tenia_cuenta") return `${quien} agregado. Ya tenía cuenta, así que puede entrar con ${correo}`
    return existente ? `${quien} ya estaba en el club; le reenviamos la invitación a ${correo}` : `${quien} agregado. Le enviamos la invitación a ${correo}`
  })
}

/**
 * Invita por correo a los miembros del club que aún no tienen cuenta. Es un botón explícito
 * (no se dispara al importar) porque son decenas de correos y Supabase limita los envíos por hora.
 */
export async function invitarPendientesAction(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const pendientes = check(
      await s.supabase.from("miembros").select("correo").eq("club_id", s.club_id).is("auth_user_id", null).neq("estado", "retirado"),
    )
    const correos = (pendientes ?? []).map((p) => p.correo).filter((c) => !esCorreoDemo(c))
    if (correos.length === 0) throw new DomainError("Todos los miembros ya tienen cuenta")
    const origen = await origenDeLaPeticion()
    let enviadas = 0
    let vinculadas = 0
    const fallidos: string[] = []
    let primerError = ""
    const resumen = () =>
      [
        `${enviadas} de ${correos.length} invitaciones enviadas`,
        vinculadas ? `${vinculadas} ya tenían cuenta y quedaron vinculados` : "",
        fallidos.length ? `no se pudo invitar a ${fallidos.join(", ")} (${primerError})` : "",
      ]
        .filter(Boolean)
        .join("; ")
    for (const correo of correos) {
      try {
        const r = await invitarCorreo(s.club_id, correo, origen)
        if (r === "enviada") enviadas++
        else if (r === "ya_tenia_cuenta") vinculadas++
      } catch (e) {
        // Límite de envíos: no tiene sentido seguir intentando.
        if (e instanceof DomainError) throw new DomainError(`${resumen()}. ${e.message}`)
        fallidos.push(correo)
        primerError ||= e instanceof Error ? e.message : String(e)
      }
    }
    if (enviadas + vinculadas === 0) throw new DomainError(resumen())
    return resumen()
  })
}
