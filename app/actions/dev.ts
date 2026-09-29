"use server"

import { getStore } from "@/lib/data"
import { buildSeed } from "@/lib/data/seed"
import { AUTH_MODE } from "@/lib/auth/session"
import { runAction, type ActionResult } from "@/lib/action-result"

export async function reiniciarDemoAction(): Promise<ActionResult> {
  return runAction(async () => {
    if (AUTH_MODE !== "dev") throw new Error("Solo disponible en modo dev")
    await getStore().reset(buildSeed())
    return "Datos demo restaurados"
  })
}
