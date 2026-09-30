# Navegación y experiencia por rol

Principio rector del club: **pocos clics, sin sobrecarga de menú**. No es minimalismo por estética — es que cualquier acción primaria debe estar a ≤2 clics desde la pantalla de inicio del rol, y la pantalla de inicio debe decirle a cada persona qué hacer *hoy*, no mostrarle un dashboard estático que no cambia su comportamiento.

## Selector de rol (multi-rol)

Cuando una persona tiene más de un rol activo (`miembros.roles`), un selector tipo pestañas/segmented control aparece junto al nombre en la barra superior (ej. `[ Jugador | Tesorero ]`). Cambiar de pestaña cambia el contexto completo (navegación + pantalla de inicio) del rol seleccionado — nunca se muestran ambos menús fusionados ni duplicados. Por defecto abre en el último rol usado.

## Navegación por rol (máximo 3-4 ítems)

**Jugador:** Inicio (única vista real — no necesita más pestañas).

**Tesorero:** Inicio · Comprobantes pendientes · Conciliación mensual · Jugadores en mora · Acuerdos de pago · (Configuración de reglas, accesible desde un ícono de ajustes, no como pestaña principal — es infrecuente). Los recordatorios viven dentro de la vista de mora, no como pestaña propia.

**Administrador:** Eventos de cobro · Jugadores.

Nada de una pestaña "Actividad" separada a nivel top: la bitácora vive como una sección filtrable dentro de la vista donde tiene sentido (ver abajo), no como un quinto ítem de navegación.

## Pantalla de inicio por rol

Reemplaza los KPIs estáticos de los wireframes iniciales (jugadores activos, recaudo del mes, etc. — información real pero que nadie necesita ver a diario) por algo accionable. Esos números no desaparecen, se mueven a una sección secundaria dentro de cada vista, no a la pantalla de inicio.

### Jugador
Lo primero que ve: su estado de cuenta como hero, no una tabla.
- Saldo pendiente (monto + próximo vencimiento) o "Estás al día" si no debe nada.
- Botón primario: **Subir comprobante** — siempre visible, 1 clic desde aquí.
- Estado del último comprobante subido, si hay uno pendiente/rechazado (con motivo si fue rechazado).
- Debajo: detalle por evento (lo que ya estaba en el wireframe original), como sección secundaria, no como lo primero que se ve.

### Tesorero
Lo primero: el estado del mes de un vistazo, y solo después lo que necesita su acción *hoy*.
- Fila de KPIs: recaudado del mes, comprobantes por revisar (con cuántos requieren revisión), jugadores en mora y estado de la conciliación del mes.
- Cobros en curso con barras de progreso grandes (pagado / en acuerdo / pendiente).
- Comprobantes que requieren revisión humana (sin match de jugador o de pago, monto ambiguo, lectura automática fallida), no toda la bandeja — el resto vive en la vista de Comprobantes ordenado igual.
- Jugadores en mora recientes (solo nombres, como ya se definió), con link a la vista completa.
- El detalle de los totales agregados sigue en la vista de Conciliación, donde tiene contexto útil.

### Administrador
Lo primero: qué requiere atención, no un conteo estático.
- Eventos de cobro activos con bajo % de recaudo cerca de su fecha límite (los que sí necesitan seguimiento).
- Cambios de estado de jugador recientes o pendientes de confirmar.
- Acceso directo a "+ Nuevo evento de cobro" y "Cargar jugadores (Excel)".
- Conteos generales (jugadores activos por categoría, etc.) se mueven a la vista de Jugadores como encabezado de esa tabla, no a la pantalla de inicio.

## Progreso por evento y por jugador (tesorero)

Pedido explícito del club, agregar en v1:

- **Por evento de cobro:** dentro del detalle de cada evento, barra de progreso con `pagado/total` y `%` (ej. "38/47 · 81%"), no solo el número crudo que ya estaba en la tabla.
- **Por jugador:** dentro del detalle de cada jugador, un indicador de qué tan al día está (al día / parcial / en mora, con el mismo lenguaje visual de forma+punto que ya se usa en el resto de la app — ver `DESIGN.md`), y el historial de sus obligaciones/comprobantes.

## Bitácora de actividad

Vive como una sección filtrable dentro de las vistas de Tesorero y Administrador (no como pestaña propia) — ej. un panel colapsable "Actividad reciente" en Eventos de cobro y en Jugadores, filtrable por tipo/actor/fecha, paginado (cursor, ~20-30 registros por carga, "cargar más" en vez de scroll infinito para no dar la sensación de un feed sin fin).

Solo eventos de negocio significativos (ver enum en `02-data-model.md`) — nunca vistas o navegación. Esto es deliberado para que la bitácora siga siendo útil como historial revisable y no se vuelva ruido.

## Principio de clics

Antes de dar una pantalla por terminada, verificar:
- ¿Subir un comprobante toma 1 clic desde el inicio del jugador?
- ¿Aprobar un comprobante sin cambios toma 1 clic desde la bandeja del tesorero?
- ¿Crear un evento de cobro toma 1 clic desde el inicio del administrador?

Si alguna de estas necesita más de 2 clics, es una señal de que la navegación se está complicando — revisar antes de agregar la siguiente pantalla.
