# Lineamientos de diseño — Raza Ultimate Tesorería

Léelo antes de escribir markup, estilos o componentes nuevos, siempre — incluso para un ajuste pequeño. El objetivo de este archivo es que cada sesión de Claude Code tome las mismas decisiones visuales en vez de "redecidir" cada vez y terminar en la estética genérica que cualquier IA produce por defecto (referencia: [AI Design Slop and How to Spot It](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)). Las reglas de abajo son compromisos concretos, no sugerencias — si algo no está definido aquí, pregunta antes de inventar.

## Paleta (comprometida)

Un solo acento, alto contraste, nada de morado/lavanda por defecto ni de "glow" decorativo.

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#1C1C1C` | Texto primario, headers, botones primarios |
| `--paper` | `#FAF9F6` | Fondo base (off-white cálido, no blanco puro ni gris frío) |
| `--surface` | `#FFFFFF` | Tarjetas y superficies elevadas sobre `--paper` |
| `--border` | `#D4D4D4` | Bordes y separadores |
| `--muted` | `#737373` | Texto secundario |
| `--faint` | `#A3A3A3` | Texto terciario, estados inactivos |
| `--accent` | `#0E6B5C` (Raza Teal) | Único color de acento: acciones positivas, estado "al día", enlaces destacados, foco |
| `--accent-warn` | `#B45309` (ámbar/óxido) | Atención — mora, diferencias de conciliación. Nunca rojo puro |

Reglas:
- **Un acento, no dos.** Todo lo que hoy usa "verde/rojo semáforo" en los wireframes se resuelve con `--ink`/`--accent`/`--accent-warn` + forma (relleno vs. contorno vs. punteado), nunca con más de un color de estado a la vez en la misma vista.
- Nada de gradientes, sombras de color ("glow"), ni glassmorphism (tarjetas de vidrio esmerilado). Sombras, si se usan, son neutras y sutiles (`0 1px 2px rgba(0,0,0,0.06)`).
- Si se agrega modo oscuro, el texto de cuerpo debe pasar WCAG AA (4.5:1) contra el fondo oscuro real, no un gris medio "seguro a simple vista" — verificarlo, no asumirlo.

## Tipografía (comprometida)

Una sola familia tipográfica deliberada, en vez del default de cualquier framework:

- **Familia:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) (variable, pesos 400/500/600/700). **No usar Inter** (el default de facto de todo lo generado por IA) ni la combinación clichê Space Grotesk + Instrument Serif + Geist.
- Un único tratamiento: títulos en Plex Sans 600/700, cuerpo en Plex Sans 400/500. No mezclar una serif como acento decorativo — esto es una herramienta de trabajo, no un sitio de marketing. (Ver "Referencias externas" abajo: esto es una decisión deliberada de *no* adoptar el par serif-editorial/sans que usa Handle — esa combinación transmite "premium B2B" y no encaja con una app de tesorería de un club deportivo.)
- Encabezados y etiquetas de sección en **sentence case** ("Eventos de cobro"), nunca en mayúsculas sostenidas salvo micro-etiquetas de 11-12px (como las etiquetas de columna de tabla, donde sí es aceptable por convención de UI de datos).

### Escala tipográfica (comprometida)

Máximo dos tamaños de peso por nivel, escala racional en vez de valores arbitrarios por pantalla:

| Nivel | Tamaño | Peso | Uso |
|---|---|---|---|
| H1 | 24px | 700 | Título de página (poco frecuente — la mayoría de pantallas no necesita uno) |
| H2 | 18px | 700 | Título de sección/tarjeta ("Eventos de cobro", "Comprobantes pendientes") |
| H3 | 15px | 600 | Subtítulo, nombre en una fila de lista |
| Body | 14px | 400 | Texto de tablas, listas, contenido general |
| Small | 13px | 500 | Texto secundario, metadatos (fecha, correo) |
| Label | 11px | 700, uppercase, tracking +0.03em | Encabezado de columna de tabla — única excepción a "sentence case" |

No usar `clamp()` ni tamaños distintos por breakpoint salvo el propio H1: esta es una app de datos que se lee sentado o en el bus, no un sitio con jerarquía cinematográfica.

## Layout — un primitivo, repetido

El primitivo de esta app es: **barra superior + pestañas de navegación + tarjetas de contenido sobre `--paper`**, tal como se ve en los wireframes existentes. Repetirlo consistentemente en toda la app es la firma visual, no una limitación:

- Nada de héroes centrados con badge sobre un H1, ni de landing-page patterns — esto no es un sitio de marketing.
- Tarjetas: borde `1px solid var(--border)`, radio 12px, sin borde de color lateral/superior (patrón muy reconocible de UI genérica de IA).
- Evitar filas de tarjetas idénticas con ícono arriba + título + descripción cuando el contenido es en realidad una tabla o lista de datos — usar tabla/lista real (más legible, más rápida de escanear para un tesorero revisando comprobantes).
- Estados (activo/pendiente/en mora/etc.) se comunican con forma + peso tipográfico + el único acento, no con una paleta semáforo completa (ver wireframes: punto relleno = al día, punto con contorno punteado = parcial/atención, punto vacío = inactivo).

## Componentes

- Base: `shadcn/ui` sobre Tailwind, pero **con los tokens de arriba aplicados antes de usar cualquier componente** (color, radio, sombra) — nunca los defaults de shadcn tal cual salen del generador.
- Iconos: un solo set, [Lucide](https://lucide.dev/) (el que acompaña a shadcn por convención). Nunca emoji como ícono funcional en la interfaz.
- Formularios: inputs con label visible siempre (no placeholder-como-label), tamaño de toque ≥44px (la mayoría de jugadores usarán esto desde el celular).

## Movimiento

Regla general: **algo se mueve solo si comunica un cambio de estado real.** Nada de movimiento ambiental/decorativo (blobs de fondo, marquee de logos, gradientes animados tipo "shimmer") — eso es lenguaje de landing page de ventas, no de herramienta de trabajo.

Lo que sí:
- Transición de estado al aceptar/rechazar un comprobante, al guardar una conciliación, al enviar un formulario (feedback inmediato de que la acción se registró).
- Hover/focus states en botones y filas de tabla (cambio de fondo o borde, `duration-150` a `200`, sin rebote).
- Un indicador sutil (ej. un punto o contador que cambia de color) cuando llega un comprobante nuevo a la bandeja del tesorero — el único caso donde algo "llama la atención" sin que el usuario haya actuado, y aun así es informativo, no decorativo.

Obligatorio:
- Honrar `prefers-reduced-motion` en cualquier transición o animación que se agregue.
- Todo elemento interactivo tiene un estado `focus-visible` claro (anillo de foco con `--accent`) — no confiar en que el navegador lo resuelva solo.

## Copy

- **Números concretos sobre adjetivos.** "38/47 al día", "$2.700.000 recaudados de $4.100.000", "vence en 3 días" — nunca "la mayoría está al día" o "recaudo saludable". Un número es verificable y un tesorero/administrador lo escanea en un vistazo; un adjetivo hay que interpretarlo.
- Mensajes de error y de éxito son específicos, no genéricos: "El comprobante no coincide con ninguna obligación pendiente — revísalo manualmente" en vez de "Ocurrió un error".

## Checklist rápido antes de dar por terminada una pantalla

- [ ] ¿Usa `--accent` una sola vez por contexto de decisión, no como color decorativo repetido?
- [ ] ¿Cero gradientes, glow, glassmorphism, blobs o marquees decorativos?
- [ ] ¿Cero Inter, cero combo tipográfico clichê, cero serif decorativa?
- [ ] ¿Las tarjetas son iguales entre sí solo cuando el contenido realmente lo es (no copy-paste sin pensar)?
- [ ] ¿Funciona bien en celular (390px de ancho) sin scroll horizontal?
- [ ] ¿Todo elemento interactivo tiene `focus-visible` y respeta `prefers-reduced-motion`?
- [ ] ¿El copy usa números en vez de adjetivos donde hay un dato disponible?
- [ ] ¿Un jugador no técnico entiende qué hacer en la pantalla sin explicación?

## Referencias externas y qué tomamos de cada una

Dos referencias externas entraron a la conversación de diseño de este proyecto. Ninguna se adopta completa — ambas son sitios de marketing/producto B2B, y esto es una herramienta interna de datos financieros para un club deportivo, usada mayormente desde el celular por gente no técnica. La disciplina de este documento es filtrar el mecanismo útil y descartar el resto, no copiar estética.

### [AI Design Slop and How to Spot It](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)
Ya es la base de este documento (paleta de un acento, una tipografía, un primitivo de layout, cero glassmorphism/gradientes). No repetido aquí.

### [Best Website Design Examples](https://www.wavespace.agency/blog/best-website-design-examples) (Wavespace)

Los 15 ejemplos destacados (Jeton, Lusion, Gufram, Apple Siri, etc.) son en su mayoría sitios *award-winning* de portafolio/marketing con WebGL, scroll storytelling y animación 3D inmersiva — **esto no aplica a esta app y se descarta explícitamente**: nuestro usuario no está "navegando una experiencia", está revisando cuánto debe o aprobando un comprobante en 30 segundos desde el bus.

De los lineamientos al final del artículo, lo que sí es transferible a una app de datos:

| Lineamiento del artículo | Qué tomamos |
|---|---|
| "Empieza con un sistema de grid" | Ya lo tenemos: el primitivo barra+tabs+tarjetas sobre grid de Tailwind. |
| "Máximo dos tipografías, escala racional (H2=24px, body=16px)" | Reforzó la necesidad de una escala explícita — agregada arriba en "Escala tipográfica". Nosotros usamos **una** tipografía, no dos — más estricto que la recomendación, deliberado. |
| "Contraste para llamar la atención (texto claro sobre oscuro, botones brillantes sobre fondo neutro)" | Aplica, pero dentro de la regla de un solo acento — el "botón brillante" es siempre `--accent`, nunca un color nuevo por contexto. |
| "Micro-interacciones (hover, estados de error) que hacen la interfaz sentirse viva" | Aplica — ver sección "Movimiento" arriba. |
| "Elimina elementos que empeoran la experiencia, conserva solo lo que aporta claridad" | Es literalmente el principio de "pocos clics" del club (`CLAUDE.md`) — mismo objetivo, dicho distinto. |

Descartado explícitamente: layouts experimentales/asimétricos, "storytelling" narrativo por sección, media custom ilustrada, "color y tipografía como herramienta emocional" (nuestra app comunica con claridad, no con personalidad de marca), y "sorpresas interactivas" — nada en esta app debe sorprender a un tesorero revisando pagos.

### `design-references/handle_ai_design_extraction.md` (auditoría de Handle.ai)

Auditoría detallada de un sitio B2B de IA para seguros — landing page de ventas, no una app de uso diario. Su propia sección 12 ("Transferible") ya distingue qué robar, adaptar o descartar; aplicamos ese mismo criterio a nuestro contexto:

**Robamos (el mecanismo, no la estética):**
- **Un solo color cromático con significado.** Handle usa lima-verde como único acento; nosotros ya teníamos esta misma regla con Raza Teal antes de leer esta referencia — se mantiene, reforzada por precedente.
- **Números concretos sobre adjetivos** ("de 4 días a 3 horas") — incorporado arriba en "Copy".
- **Alternancia sutil de fondos sin bordes duros** (blanco / `#fafafa`) para separar secciones — ya está en nuestra distinción `--paper`/`--surface`.
- **Un único elemento con movimiento en estado idle, cuando de verdad informa algo** — adaptado (no un CTA que brilla para vender, sino un indicador de "comprobante nuevo" en la bandeja del tesorero — ver "Movimiento").

**Adaptamos:**
- El par tipográfico serif-editorial + sans (Sentient + Inter) — la propia auditoría dice que esto es para audiencia "premium B2B" y hay que sustituirlo fuera de ese contexto. Lo adaptamos a **una sola sans** (IBM Plex Sans) — nuestra audiencia es un jugador de Ultimate en su celular, no un comprador corporativo.

**Descartamos:**
- Todo el aparato de landing page de ventas: banner de anuncio, funnel "Contáctanos", lava blobs, shimmer/gradiente animado en CTA, marquee de logos, storytelling de scroll de 17 secciones. Nada de esto tiene sentido en una app que se abre todos los meses para hacer lo mismo rápido.
- La ausencia de `focus-visible` y de `prefers-color-scheme` que la propia auditoría señala como huecos del sitio auditado — al contrario, nosotros sí exigimos `focus-visible` (ver checklist). Dark mode queda fuera de v1 por alcance, no por decisión de accesibilidad.

## Sobre `design-references/`

Cuando el club suba capturas o mockups (por ejemplo desde Muse) a `design-references/`, esos archivos son la referencia visual más reciente y tienen prioridad sobre los wireframes de baja fidelidad ya existentes — pero las reglas de paleta/tipografía/layout de este documento siguen aplicando salvo que el club indique explícitamente lo contrario.
