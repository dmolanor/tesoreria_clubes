# Motor de reglas de conciliación

Esto es lo que hace que la plataforma sea mejor que un Excel — trátalo con ese peso. No es un detalle de implementación secundario.

## Por qué no FIFO fijo

El diseño original aplicaba cada comprobante a la obligación pendiente más antigua, en orden, sin excepción. Pero en la práctica del club:

- Los jugadores a veces pagan un monto que coincide exactamente con un cobro específico (ej. el team fee de un torneo) y esperan que se aplique ahí, no a la mensualidad atrasada más antigua.
- La tesorera tiene acuerdos de pago flexibles caso por caso.
- Puede haber más combinaciones de este tipo en el futuro que hoy no conocemos.

La conclusión del club fue explícita: **necesitamos reglas configurables, combinables, con buenos valores por defecto** — no una regla fija en el código, ni tampoco un lenguaje de reglas tan abierto que sea difícil de configurar sin ser programador.

## Quién configura las reglas

**Solo el tesorero** (decisión explícita del club — el administrador no edita esta configuración, aunque puede verla en modo lectura). El tesorero es quien conoce el flujo de caja real y los casos borde.

## Cómo funciona

Cuando se sube un comprobante (monto total, jugador):

1. Se toman las **reglas activas del club**, ordenadas por `prioridad` ascendente.
2. Se evalúan en orden, contra el monto **restante** del comprobante y las **obligaciones pendientes** del jugador (`obligaciones.estado in ('pendiente','parcial')`).
3. La primera regla cuya `condicion` haga match consume del monto restante según su `accion`, y genera una o más filas de `aplicaciones` (con `regla_id` para auditoría).
4. El monto restante (si queda) sigue evaluándose contra las siguientes reglas en orden.
5. Si después de todas las reglas activas queda saldo sin aplicar, queda como saldo a favor del jugador (derivado: monto aceptado − aplicado; comportamiento por defecto, no configurable — siempre hay un catch-all).
6. El resultado completo es una **propuesta**: el tesorero la ve en la bandeja de comprobantes, puede editarla manualmente (mover montos entre obligaciones, como ya está en el wireframe), y solo al aceptar se escribe de forma definitiva.

Esto es exactamente combinable en el sentido que pidió el club: "si pagan un monto que cuadra con un evento específico, va ahí independientemente de qué tan vieja sea otra deuda" es una regla de prioridad 1, y "lo que sobra va a lo más antiguo" es la regla de prioridad 2 — ambas pueden estar activas a la vez y el resto del monto fluye de una a la otra.

## Tipos de regla (v1 — mantener pocos, extensible después)

Empezar con un catálogo cerrado y pequeño, no un lenguaje de expresiones genérico — eso es sobre-ingeniería para un solo club hoy. El campo `tipo` es un enum; `condicion`/`accion` son `jsonb` para no requerir migración al ajustar parámetros de una regla existente.

| `tipo` | `condicion` (ejemplo) | `accion` (ejemplo) | Qué hace |
|---|---|---|---|
| `monto_exacto` | `{}` (sin parámetros — siempre intenta el match) | `{}` | Si el monto restante coincide exactamente con el monto de alguna obligación pendiente del jugador, aplica ahí primero |
| `evento_especifico` | `{"evento_cobro_id": "..."}` | `{}` | Si el club quiere que un evento de cobro puntual (ej. un torneo) siempre se cubra antes que el resto, mientras la regla esté activa |
| `mas_antiguo_primero` | `{}` | `{}` | FIFO — aplica el monto restante a la obligación pendiente con `fecha_limite` más antigua, permitiendo pago parcial en la última que alcance a cubrir. **Regla por defecto, activa en todo club nuevo como fallback de prioridad más baja.** |

Reglas por defecto al crear un club: `monto_exacto` (prioridad 1) + `mas_antiguo_primero` (prioridad 2, no desactivable — siempre debe haber un fallback determinístico). El tesorero puede agregar `evento_especifico` cuando lo necesite, y reordenar/desactivar `monto_exacto` si no lo quiere.

Agregar un `tipo` nuevo en el futuro (ej. "priorizar categoría de cobro X sobre Y") es un enum value + lógica de evaluación nueva, no un rediseño de esquema.

## UI (tesorero, ver `04-ux-ia.md`)

Pantalla de configuración con:
- Lista de reglas activas en orden de prioridad, con reordenamiento (drag o botones subir/bajar).
- Activar/desactivar sin borrar.
- Formulario simple por tipo de regla (dropdown de `tipo` + los parámetros que ese tipo necesita — no un editor de JSON crudo).
- La bandeja de comprobantes siempre muestra qué regla produjo cada línea del desglose propuesto (trazabilidad), y el tesorero puede sobrescribir manualmente antes de aceptar — la regla nunca es la última palabra, es una propuesta.

## Explícitamente fuera de v1

- Motor de reglas con condiciones combinadas por el usuario (AND/OR arbitrario) — el catálogo cerrado de tipos ya cubre los casos reales conocidos hoy.
- Simulador/preview de una regla contra datos históricos antes de activarla — deseable, no bloqueante para el lanzamiento.
