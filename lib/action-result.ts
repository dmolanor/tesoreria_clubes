import "server-only"
import { revalidatePath } from "next/cache"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { ForbiddenError } from "@/lib/auth/session"

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null

/** Error de negocio con mensaje para mostrar tal cual. */
export class DomainError extends Error {}

/** Códigos de Postgres cuyo mensaje ya viene en español desde la base (raise exception, checks). */
const MENSAJES_DE_LA_BASE = new Set(["42501", "23514", "P0002", "P0001"])

interface PgError {
  code?: string
  message?: string
}

/** Lanza un error de Supabase como DomainError si es de negocio; si no, lo relanza tal cual. */
export function check<T>(res: { data: T; error: PgError | null }): T {
  if (res.error) {
    const e = res.error
    if (e.code === "23505") throw new DomainError("Ya existe un registro con esos datos")
    if (e.code === "42501" && /row-level security|permission denied/i.test(e.message ?? "")) {
      throw new DomainError("No tienes permiso para hacer esto")
    }
    if (e.code && MENSAJES_DE_LA_BASE.has(e.code) && e.message) throw new DomainError(e.message)
    throw new Error(e.message ?? "Error de base de datos")
  }
  return res.data
}

/** Ejecuta una mutación y traduce errores de negocio/permisos a un resultado mostrable. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn()
    revalidatePath("/", "layout")
    return { ok: true, message: message ?? undefined }
  } catch (err) {
    if (isRedirectError(err)) throw err
    if (err instanceof DomainError || err instanceof ForbiddenError) return { ok: false, error: err.message }
    throw err
  }
}
