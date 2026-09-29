import "server-only"
import { revalidatePath } from "next/cache"
import { DomainError } from "@/lib/domain/ledger"
import { ForbiddenError } from "@/lib/auth/session"

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null

/** Ejecuta una mutación y traduce errores de negocio/permisos a un resultado mostrable. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn()
    revalidatePath("/", "layout")
    return { ok: true, message: message ?? undefined }
  } catch (err) {
    if (err instanceof DomainError || err instanceof ForbiddenError) return { ok: false, error: err.message }
    throw err
  }
}
