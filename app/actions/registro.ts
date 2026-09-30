"use server"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizarTelefono } from "@/lib/invitaciones"
import type { ActionResult } from "@/lib/action-result"

/**
 * Primer ingreso de un invitado: confirma su nombre y deja su celular.
 * RLS solo deja editar `miembros` a la administración, así que se escribe con la secret key,
 * limitado a las filas vinculadas a la sesión y a estas dos columnas.
 */
export async function completarRegistroAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const s = await getSession()
  const nombre = String(formData.get("nombre") ?? "").trim()
  if (!nombre) return { ok: false, error: "Escribe tu nombre" }
  const telefono = normalizarTelefono(String(formData.get("telefono") ?? ""))
  if (!telefono) return { ok: false, error: "Escribe un celular válido, por ejemplo 300 123 4567" }
  const { error } = await createAdminClient().from("miembros").update({ nombre, telefono }).eq("auth_user_id", s.userId)
  if (error) throw error
  redirect("/")
}
