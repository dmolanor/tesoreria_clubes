import "server-only"
import { promises as fs } from "node:fs"
import path from "node:path"
import type { Db, Store } from "./types"
import { buildSeed } from "./seed"

export const DATA_DIR = path.join(process.cwd(), ".data")
const DB_FILE = path.join(DATA_DIR, "db.json")

/**
 * Store en archivo JSON local. Un solo proceso Node escribe (dev o `next start`),
 * así que basta un mutex en memoria para serializar transacciones.
 */
export class JsonStore implements Store {
  private queue: Promise<unknown> = Promise.resolve()

  async read(): Promise<Readonly<Db>> {
    await this.queue
    return this.load()
  }

  transaction<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load()
      const result = await fn(db)
      await this.save(db)
      return result
    })
    // La cola sigue aunque una transacción falle (el archivo no se escribió).
    this.queue = run.catch(() => undefined)
    return run
  }

  async reset(db: Db): Promise<void> {
    await this.transaction((current) => {
      Object.assign(current, db)
    })
  }

  private async load(): Promise<Db> {
    try {
      return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      const seed = buildSeed()
      await this.save(seed)
      return seed
    }
  }

  private async save(db: Db): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const tmp = `${DB_FILE}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(db, null, 1))
    await fs.rename(tmp, DB_FILE)
  }
}
