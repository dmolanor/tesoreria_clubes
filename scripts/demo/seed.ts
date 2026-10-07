// Datos demo deterministas. El historial (jul–sep 2026) se construye ejecutando
// la misma lógica de dominio que usa la app, así que es coherente con el motor.

import type { Categoria, Db, Usuario } from "./types"
import {
  aceptarComprobante,
  anularEgreso,
  cambiarEstadoJugador,
  crearEvento,
  guardarConciliacion,
  pendientesDe,
  propuestaPara,
  rechazarComprobante,
  registrarCruce,
  registrarEgreso,
  reglasPorDefecto,
  subirComprobante,
  totalAceptadoMes,
  totalEgresosMes,
  type Ctx,
} from "./ledger"

export const CLUB_ID = "00000000-0000-4000-8000-00000000c1b0"
export const DEMO_IDS = {
  tesorera: "00000000-0000-4000-8000-0000000000a1", // tesorera + jugadora Élite
  admin: "00000000-0000-4000-8000-0000000000a2", // solo administrativo
  adminJugador: "00000000-0000-4000-8000-0000000000a3", // administrativo + jugador Élite
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOMBRES = [
  "Camila", "Santiago", "Valentina", "Mateo", "Mariana", "Sebastián", "Daniela", "Nicolás", "Sara", "Juan José",
  "Isabella", "Samuel", "Gabriela", "Tomás", "Laura", "Alejandro", "Natalia", "Felipe", "Juliana", "David",
  "Paula", "Andrés", "Manuela", "Esteban", "Luisa", "Martín", "Catalina", "Julián", "Sofía", "Emilio",
  "Ana María", "Simón", "Carolina", "Miguel", "Lucía", "Jerónimo", "Antonia", "Pablo", "Valeria", "Diego",
]
const APELLIDOS = [
  "Ruiz", "Gómez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Ramírez", "Torres", "Castro",
  "Vargas", "Moreno", "Rojas", "Jiménez", "Ortiz", "Suárez", "Restrepo", "Cárdenas", "Ospina", "Mejía",
  "Salazar", "Arango", "Quintero", "Zapata", "Rincón", "Molina", "Pardo", "Duque", "Escobar", "Valencia",
]

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, ".")
}

type Perfil = "puntual" | "atrasado" | "moroso" | "parcial"

export function buildSeed(): Db {
  const rand = mulberry32(20260928)
  let counter = 0
  const newId = () => `00000000-0000-4000-8000-${(++counter).toString(16).padStart(12, "0")}`
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]

  const db: Db = {
    clubes: [{ id: CLUB_ID, nombre: "Raza Ultimate", created_at: "2026-06-15T15:00:00.000Z" }],
    usuarios: [],
    roles_usuario: [],
    eventos_cobro: [],
    obligaciones: [],
    comprobantes: [],
    pagos_aplicados: [],
    saldo_a_favor: [],
    reglas_conciliacion: [],
    conciliaciones: [],
    egresos: [],
    tarifas_estado: [
      { club_id: CLUB_ID, estado: "lesionado", monto_mensual: 40_000, updated_at: "2026-06-15T15:00:00.000Z" },
      { club_id: CLUB_ID, estado: "inactivo", monto_mensual: 60_000, updated_at: "2026-06-15T15:00:00.000Z" },
    ],
    bitacora: [],
  }
  const ctx = (fecha: string, actor: string | null, hora = "15:00"): Ctx => ({
    club_id: CLUB_ID,
    actor_id: actor,
    now: `${fecha}T${hora}:00.000Z`,
    newId,
  })

  // ---- Usuarios y roles ----
  const creado = "2026-06-15T15:00:00.000Z"
  const addUser = (id: string, nombre: string, categoria: Categoria | null, roles: Array<"administrativo" | "tesorero" | "jugador">) => {
    const u: Usuario = {
      id,
      club_id: CLUB_ID,
      nombre,
      correo: `${slug(nombre)}@example.com`,
      categoria,
      estado: "activo",
      created_at: creado,
    }
    db.usuarios.push(u)
    for (const rol of roles) {
      db.roles_usuario.push({ id: newId(), usuario_id: id, club_id: CLUB_ID, rol, activo: true, created_at: creado })
    }
    return u
  }
  addUser(DEMO_IDS.tesorera, "Laura Gómez", "Élite", ["tesorero", "jugador"])
  addUser(DEMO_IDS.admin, "Andrés Molina", null, ["administrativo"])
  addUser(DEMO_IDS.adminJugador, "Diego Rincón", "Élite", ["administrativo", "jugador"])

  const usados = new Set(db.usuarios.map((u) => u.nombre))
  const jugadores: Usuario[] = db.usuarios.filter((u) => u.categoria)
  for (const categoria of ["Élite", "Junior"] as const) {
    while (jugadores.filter((u) => u.categoria === categoria).length < 24) {
      const nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)}`
      if (usados.has(nombre)) continue
      usados.add(nombre)
      jugadores.push(addUser(newId(), nombre, categoria, ["jugador"]))
    }
  }

  db.reglas_conciliacion.push(...reglasPorDefecto(ctx("2026-06-15", null)))

  // Perfil de pago por jugador (la tesorera y el admin-jugador son puntuales).
  const perfil = new Map<string, Perfil>()
  for (const u of jugadores) {
    const r = rand()
    perfil.set(u.id, r < 0.5 ? "puntual" : r < 0.72 ? "parcial" : r < 0.9 ? "atrasado" : "moroso")
  }
  perfil.set(DEMO_IDS.tesorera, "puntual")
  perfil.set(DEMO_IDS.adminJugador, "puntual")

  const A = DEMO_IDS.admin
  const T = DEMO_IDS.tesorera

  const pagar = (u: Usuario, monto: number, fecha: string, hora = "13:00") => {
    const id = subirComprobante(db, ctx(fecha, u.id, hora), { usuario_id: u.id, monto_total: monto, archivo_url: "demo" })
    aceptarComprobante(db, ctx(fecha, T, "22:00"), id, propuestaPara(db, id).lineas)
    return id
  }
  const deudaEnMes = (u: Usuario, mes: string) =>
    pendientesDe(db, u.id).filter((p) => p.fecha_limite.startsWith(mes)).reduce((s, p) => s + p.saldo_pendiente, 0)
  const dia = (n: number) => String(n).padStart(2, "0")

  // ---- Julio ----
  crearEvento(db, ctx("2026-07-01", A), { nombre: "Mensualidad julio · Élite", monto: 120_000, fecha_limite: "2026-07-10", alcance: "grupo", alcance_valor: "Élite" })
  crearEvento(db, ctx("2026-07-01", A, "15:05"), { nombre: "Mensualidad julio · Junior", monto: 80_000, fecha_limite: "2026-07-10", alcance: "grupo", alcance_valor: "Junior" })
  crearEvento(db, ctx("2026-07-02", A), { nombre: "Afiliación liga 2026", monto: 90_000, fecha_limite: "2026-07-31", alcance: "todos", alcance_valor: null })
  for (const u of jugadores) {
    const p = perfil.get(u.id)!
    if (p === "moroso") continue
    const monto = p === "parcial" ? deudaEnMes(u, "2026-07") - 90_000 : deudaEnMes(u, "2026-07")
    if (monto > 0) pagar(u, monto, `2026-07-${dia(3 + Math.floor(rand() * 20))}`)
  }

  // Un jugador se retira en agosto (se prorratea su mensualidad).
  const retirado = jugadores.find((u) => u.categoria === "Junior" && perfil.get(u.id) === "atrasado")!

  // ---- Agosto ----
  crearEvento(db, ctx("2026-08-01", A), { nombre: "Mensualidad agosto · Élite", monto: 120_000, fecha_limite: "2026-08-10", alcance: "grupo", alcance_valor: "Élite" })
  crearEvento(db, ctx("2026-08-01", A, "15:05"), { nombre: "Mensualidad agosto · Junior", monto: 80_000, fecha_limite: "2026-08-10", alcance: "grupo", alcance_valor: "Junior" })
  crearEvento(db, ctx("2026-08-03", A), { nombre: "Póliza deportiva 2026", monto: 45_000, fecha_limite: "2026-08-15", alcance: "todos", alcance_valor: null })
  cambiarEstadoJugador(db, ctx("2026-08-14", A), retirado.id, "retirado")

  let sobrepagos = 0
  let rechazado = false
  for (const u of jugadores) {
    const p = perfil.get(u.id)!
    if (p === "moroso" || p === "atrasado") continue
    const fecha = `2026-08-${dia(2 + Math.floor(rand() * 20))}`
    if (p === "parcial") {
      // Se pone al día con la afiliación, pero deja la póliza pendiente.
      const mensualidad = u.categoria === "Élite" ? 120_000 : 80_000
      pagar(u, mensualidad + 90_000, fecha)
      continue
    }
    let monto = deudaEnMes(u, "2026-08")
    if (!rechazado && u.id !== T) {
      const id = subirComprobante(db, ctx(fecha, u.id, "08:30"), { usuario_id: u.id, monto_total: monto, archivo_url: "demo" })
      rechazarComprobante(db, ctx(fecha, T, "21:00"), id, "La imagen está cortada y no se ve el valor — vuelve a subirla completa")
      rechazado = true
    }
    // Dos jugadores redondean hacia arriba → saldo a favor que se consume en septiembre.
    if (sobrepagos < 2 && u.categoria === "Junior") {
      monto += 20_000
      sobrepagos++
    }
    if (monto > 0) pagar(u, monto, fecha)
  }

  // ---- Septiembre ----
  crearEvento(db, ctx("2026-09-01", A), { nombre: "Mensualidad septiembre · Élite", monto: 120_000, fecha_limite: "2026-09-10", alcance: "grupo", alcance_valor: "Élite" })
  crearEvento(db, ctx("2026-09-01", A, "15:05"), { nombre: "Mensualidad septiembre · Junior", monto: 80_000, fecha_limite: "2026-09-10", alcance: "grupo", alcance_valor: "Junior" })
  const torneoId = crearEvento(db, ctx("2026-09-04", A), { nombre: "Team fee · Torneo Nacional Élite", monto: 180_000, fecha_limite: "2026-10-05", alcance: "grupo", alcance_valor: "Élite" })
  const conUniforme = jugadores.filter(() => rand() < 0.15).slice(0, 6)
  crearEvento(db, ctx("2026-09-12", A), { nombre: "Uniformes 2026 (nuevos)", monto: 95_000, fecha_limite: "2026-10-15", alcance: "individual", alcance_valor: conUniforme.map((u) => u.id).join(",") })

  const lesionado = jugadores.find((u) => u.categoria === "Élite" && perfil.get(u.id) === "parcial" && u.id !== T && u.id !== DEMO_IDS.adminJugador)!
  cambiarEstadoJugador(db, ctx("2026-09-15", A), lesionado.id, "lesionado")

  let pagaronTorneo = 0
  let conSaldo = false
  for (const u of jugadores) {
    const p = perfil.get(u.id)!
    if (u.estado !== "activo") continue
    if (p === "parcial") {
      // La mayoría de los "parciales" se pone al día en septiembre (póliza + mensualidad).
      if (rand() < 0.7) pagar(u, (u.categoria === "Élite" ? 120_000 : 80_000) + 45_000, `2026-09-${dia(5 + Math.floor(rand() * 5))}`)
      continue
    }
    if (p !== "puntual") continue
    // Un Junior puntual redondea hacia arriba → queda saldo a favor visible.
    const extra = !conSaldo && u.categoria === "Junior" ? 30_000 : 0
    if (extra) conSaldo = true
    pagar(u, deudaEnMes(u, "2026-09") + extra, `2026-09-${dia(2 + Math.floor(rand() * 8))}`)
    // Algunos pagan el torneo por adelantado (monto exacto → va directo al torneo).
    if (u.categoria === "Élite" && pagaronTorneo < 8) {
      pagar(u, 180_000, `2026-09-${dia(14 + Math.floor(rand() * 10))}`)
      pagaronTorneo++
    }
  }

  // ---- Comprobantes pendientes: diseñados para ejercitar cada regla ----
  const pendienteDe = (u: Usuario, monto: number, fecha: string, hora: string) =>
    subirComprobante(db, ctx(fecha, u.id, hora), { usuario_id: u.id, monto_total: monto, archivo_url: "demo" })
  const usados2 = new Set<string>([T])
  const buscar = (pred: (u: Usuario) => boolean) => {
    const u = jugadores.find((u) => !usados2.has(u.id) && u.estado === "activo" && pred(u))
    if (u) usados2.add(u.id)
    return u
  }
  const pend = (u: Usuario) => pendientesDe(db, u.id)

  // 1. Monto exacto del torneo con mensualidades viejas pendientes → monto_exacto lo manda al torneo.
  const u1 = buscar((u) => pend(u).some((p) => p.evento_cobro_id === torneoId) && pend(u).length >= 3)
  if (u1) pendienteDe(u1, 180_000, "2026-09-26", "19:12")
  // 2. Sobrepago: debe una sola cosa y paga de más → saldo a favor.
  const u2 = buscar((u) => pend(u).length === 1 && pend(u)[0].evento_cobro_id !== torneoId)
  if (u2) pendienteDe(u2, pend(u2)[0].saldo_pendiente + 50_000, "2026-09-27", "08:40")
  // 3. Pago parcial de un Junior en mora → FIFO parcial.
  const u3 = buscar((u) => u.categoria === "Junior" && pend(u).length >= 2)
  if (u3) pendienteDe(u3, 50_000, "2026-09-27", "12:05")
  // 4. Paga dos mensualidades juntas (sin coincidencia exacta con una sola) → FIFO.
  const u4 = buscar((u) => pend(u).length >= 3)
  if (u4) pendienteDe(u4, pend(u4)[0].saldo_pendiente + pend(u4)[1].saldo_pendiente, "2026-09-27", "20:30")
  // 5. Paga el valor de la afiliación teniendo mensualidades más viejas → monto_exacto.
  const u5 = buscar((u) => pend(u).some((p) => p.saldo_pendiente === 90_000) && pend(u).length >= 2)
  if (u5) pendienteDe(u5, 90_000, "2026-09-28", "07:55")
  // 6. Pago redondo de un moroso.
  const u6 = buscar((u) => perfil.get(u.id) === "moroso")
  if (u6) pendienteDe(u6, 200_000, "2026-09-28", "09:20")

  // ---- Egresos (ids y bitácora con contador propio: no corren los ids del resto del seed) ----
  let egresoN = 0
  const ctxEgreso = (fecha: string, hora: string): Ctx => ({
    ...ctx(fecha, T, hora),
    newId: () => `00000000-0000-4000-8000-0000000eb${(++egresoN).toString(16).padStart(3, "0")}`,
  })
  const egresos = [
    ["2026-07-04", 1_200_000, "Arriendo cancha julio (sábados)", "canchas"],
    ["2026-07-10", 600_000, "Inscripción liga 2026", "liga_federacion"],
    ["2026-08-02", 1_200_000, "Arriendo cancha agosto (sábados)", "canchas"],
    ["2026-08-14", 450_000, "Discos de juego x10", "uniformes"],
    ["2026-08-23", 300_000, "Observadores Torneo Regional", "torneos"],
    ["2026-09-05", 1_200_000, "Arriendo cancha septiembre (sábados)", "canchas"],
    ["2026-09-06", 1_200_000, "Arriendo cancha septiembre (sábados)", "canchas"],
    ["2026-09-20", 350_000, "Observadores Torneo Nacional", "torneos"],
  ] as const
  egresos.forEach(([fecha, monto, concepto, categoria], i) => {
    const id = `00000000-0000-4000-8000-0000000e${(i + 1).toString(16).padStart(4, "0")}`
    registrarEgreso(db, ctxEgreso(fecha, "17:00"), { id, fecha, monto, concepto, categoria })
  })
  // El segundo arriendo de septiembre quedó duplicado y la tesorera lo anuló.
  anularEgreso(db, ctxEgreso("2026-09-06", "17:30"), "00000000-0000-4000-8000-0000000e0007")
  // Un egreso de categoría "Otros" con el texto libre que exige esa categoría.
  registrarEgreso(db, ctxEgreso("2026-09-12", "16:30"), {
    id: "00000000-0000-4000-8000-0000000e0009",
    fecha: "2026-09-12",
    monto: 180_000,
    concepto: "Transporte al Torneo Nacional",
    categoria: "otros",
    categoria_otro: "Bus del equipo",
  })
  // Cruce de cuentas: un jugador que entrena a los Junior se le descuenta de su mensualidad.
  const u7 = buscar((u) => pend(u).length >= 1)
  if (u7) {
    registrarCruce(db, ctxEgreso("2026-09-29", "18:00"), {
      comprobanteId: "00000000-0000-4000-8000-0000000e0101",
      egresoId: "00000000-0000-4000-8000-0000000e0102",
      usuario_id: u7.id,
      monto: 60_000,
      fecha: "2026-09-29",
      concepto: "Entrenamiento Junior septiembre",
    })
  }

  // ---- Conciliaciones cerradas (julio y agosto cuadradas: ingresos − egresos = movimiento del banco) ----
  let saldo = 2_850_000
  const cierres = { "2026-07-01": "2026-08-03", "2026-08-01": "2026-09-03" }
  for (const [mes, fechaCierre] of Object.entries(cierres)) {
    const neto = totalAceptadoMes(db, CLUB_ID, mes) - totalEgresosMes(db, CLUB_ID, mes)
    guardarConciliacion(db, ctx(fechaCierre, T), { mes, saldo_inicial: saldo, saldo_final: saldo + neto, notas: "Cuadra con el extracto" })
    saldo += neto
  }

  return db
}
