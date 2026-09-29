import "server-only"
import type { Store } from "./types"
import { JsonStore } from "./json-store"

// Sobrevive a los recargos de módulos en dev (HMR) para no duplicar el mutex.
const globalForStore = globalThis as unknown as { __razaStore?: Store }

export function getStore(): Store {
  if (!globalForStore.__razaStore) {
    const backend = process.env.DATA_BACKEND ?? "json"
    if (backend !== "json") {
      throw new Error(`DATA_BACKEND=${backend} aún no está implementado (solo "json").`)
    }
    globalForStore.__razaStore = new JsonStore()
  }
  return globalForStore.__razaStore
}
