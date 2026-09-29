# Product brief

## El problema

Raza Ultimate es un club de Ultimate Frisbee con ~24 jugadores Élite y ~24 Junior. Cobra mensualidades (arriendo de cancha, entrenadores, tesorera) y cobros adicionales durante el año (afiliación a liga/federación, póliza, team/player fee de torneos, uniformes, concentraciones, eventos extraordinarios).

Hoy todo se hace a mano:

- Los jugadores pagan por transferencia (llave Bre-B) y envían un screenshot del comprobante al correo del equipo — muchas veces se les olvida.
- La tesorera cruza comprobantes contra deudas manualmente, en un Excel propio.
- Cuando hay dos deudas a la vez (mensualidad atrasada + torneo), los jugadores priorizan pagar lo que quieren pagar (típicamente el torneo), no necesariamente lo más antiguo.
- Varios jugadores tienen acuerdos de pago flexibles negociados directamente con la tesorera, que ella maneja a criterio propio y no están en ningún sistema.
- Jugadores que van y vienen (pausan un mes sin avisar) generan confusión porque igual les llega el cobro de la mensualidad, aunque hay un monto mínimo que aplica independientemente de si entrenan o no.
- La única transparencia hoy es una lista de deudores que la tesorera manda al grupo de WhatsApp cada cierto tiempo, revisada a mano.

El dolor no es el canal de cobro (Bre-B ya funciona bien) — es la visibilidad de quién debe qué, la aplicación de pagos a la deuda correcta, y el trabajo manual de conciliación mensual.

## Usuarios

| Rol | Quién | Qué necesita |
|---|---|---|
| Jugador | ~48 jugadores (Élite + Junior) | Saber cuánto debe y para cuándo, subir comprobantes fácil desde el celular |
| Tesorero | 1 persona (hoy: la tesorera) | Revisar y aplicar comprobantes rápido, saber quién está en mora, conciliar el banco cada mes sin tener que perseguir números |
| Administrador | 1-2 personas | Crear cobros, mantener la lista de jugadores y su estado (activo/lesionado/retirado) |

Una misma persona puede tener más de un rol (ver `02-data-model.md`).

## Qué resuelve v1 (plataforma web)

1. Cada jugador ve su estado de cuenta en cualquier momento, sin preguntarle a la tesorera.
2. Subir un comprobante es un solo paso (monto total, sin tener que saber a qué evento corresponde — el sistema propone cómo aplicarlo).
3. La tesorera revisa comprobantes con una propuesta de aplicación ya calculada según reglas configurables (no un FIFO rígido) y puede ajustarla antes de aceptar.
4. La conciliación bancaria mensual (saldo inicial/final vs. total aceptado en la plataforma) toma minutos, no una tarde.
5. El administrador gestiona eventos de cobro y jugadores sin depender de un Excel paralelo.

## Qué queda fuera de v1 (y por qué)

- **OCR de comprobantes** — valioso, pero no es el problema principal; se evalúa después de validar que la reconciliación manual asistida ya reduce el trabajo.
- **Bot de WhatsApp** — los jugadores seguirán recibiendo cobros y subiendo comprobantes desde la web en v1; WhatsApp como canal adicional (recordatorios + subida de comprobantes) es la fase inmediatamente siguiente, ya contemplada en el modelo de datos.
- **Pasarela de pago (Wompi u otra)** — decisión pendiente de confirmar con el club. Wompi ofrecería conciliación 100% automática vía webhook para lo que pase por ahí (con comisión ~2.65% + $700 COP + IVA por transacción), pero cualquier pago fuera de Wompi (p. ej. Bre-B directo) seguiría necesitando comprobante manual — así que no elimina el flujo manual, lo reduce parcialmente. El modelo de datos deja espacio (`comprobantes.canal`) para agregarlo sin rediseñar.
- **Multi-club con autoservicio** — el modelo de datos ya aísla todo por `club_id` para que esto sea viable después, pero el flujo de alta de un club nuevo no se construye en v1.
- **Planes de pago en cuotas explícitos, exportación a Excel general** — se evalúan en una fase posterior.

## Cómo se mide que funcionó

No hay KPIs formales definidos todavía, pero la señal cualitativa que importa es: la tesorera deja de mantener el Excel en paralelo, y los recordatorios de mora dejan de requerir revisión manual antes de enviarse.
