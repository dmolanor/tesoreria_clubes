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
- Un único tratamiento: títulos en Plex Sans 600/700, cuerpo en Plex Sans 400/500. No mezclar una serif como acento decorativo — esto es una herramienta de trabajo, no un sitio de marketing.
- Encabezados y etiquetas de sección en **sentence case** ("Eventos de cobro"), nunca en mayúsculas sostenidas salvo micro-etiquetas de 11-12px (como las etiquetas de columna de tabla, donde sí es aceptable por convención de UI de datos).

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

## Checklist rápido antes de dar por terminada una pantalla

- [ ] ¿Usa `--accent` una sola vez por contexto de decisión, no como color decorativo repetido?
- [ ] ¿Cero gradientes, glow, glassmorphism?
- [ ] ¿Cero Inter, cero combo tipográfico clichê?
- [ ] ¿Las tarjetas son iguales entre sí solo cuando el contenido realmente lo es (no copy-paste sin pensar)?
- [ ] ¿Funciona bien en celular (390px de ancho) sin scroll horizontal?
- [ ] ¿Un jugador no técnico entiende qué hacer en la pantalla sin explicación?

## Sobre `design-references/`

Cuando el club suba capturas o mockups (por ejemplo desde Muse) a `design-references/`, esos archivos son la referencia visual más reciente y tienen prioridad sobre los wireframes de baja fidelidad ya existentes — pero las reglas de paleta/tipografía/layout de este documento siguen aplicando salvo que el club indique explícitamente lo contrario.
