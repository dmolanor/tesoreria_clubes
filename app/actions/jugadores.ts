"use server"

import ExcelJS from "exceljs"
import { getStore } from "@/lib/data"
import { ctxFrom, requireRole } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { cambiarEstadoJugador, crearJugador, setRol, DomainError } from "@/lib/domain/ledger"
import type { Categoria, EstadoJugador, Rol } from "@/lib/data/types"

export async function cambiarEstadoAction(usuarioId: string, estado: EstadoJugador): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    await getStore().transaction((db) => cambiarEstadoJugador(db, ctxFrom(s), usuarioId, estado))
    return `Estado cambiado a ${estado}`
  })
}

export async function setRolAction(usuarioId: string, rol: Rol, activo: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    await getStore().transaction((db) => setRol(db, ctxFrom(s), usuarioId, rol, activo))
  })
}

type Fila = { nombre: string; correo: string; categoria: string }

function normalizarCategoria(raw: string): Categoria | null {
  const c = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
  if (c.startsWith("elite")) return "Élite"
  if (c.startsWith("junior")) return "Junior"
  return null
}

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

/** Carga masiva: crea los nuevos (con "invitación" simulada) y omite los correos que ya existen. */
export async function importarJugadoresAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireRole("administrativo")
    const file = formData.get("archivo")
    if (!(file instanceof File) || file.size === 0) throw new DomainError("Elige un archivo .xlsx o .csv")
    const filas = mapearFilas(await leerArchivo(file))
    if (filas.length === 0) throw new DomainError("El archivo no tiene filas de jugadores")
    const { creados, existentes } = await getStore().transaction((db) => {
      const ctx = ctxFrom(s)
      let creados = 0
      let existentes = 0
      for (const f of filas) {
        const r = crearJugador(db, ctx, { nombre: f.nombre, correo: f.correo, categoria: normalizarCategoria(f.categoria) })
        if (r === "creado") creados++
        else existentes++
      }
      return { creados, existentes }
    })
    return `${creados} jugadores creados y "invitados"; ${existentes} omitidos porque su correo ya existía`
  })
}
