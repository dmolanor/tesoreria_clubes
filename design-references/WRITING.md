---
name: anti-ai-slop
description: Linter estilístico y guía prescriptiva para eliminar prosa sintética, muletillas de IA, relleno retórico y monotonía de cadencia en textos técnicos — español e inglés. Usar antes de enviar cualquier reporte, correo o mensaje a un tercero (banco, cliente, equipo).
---

# Guía anti-slop y redacción directa

Aplica esta guía a todo texto dirigido a un tercero: reportes técnicos, correos,
mensajes de Telegram/WhatsApp, documentación, resúmenes de commits. El objetivo
es que el texto lea como lo escribió una persona que entiende el problema, no
un modelo rellenando espacio.

## 1. Español

### 1.1 La raya suelta («—»)
Prohibida como conector informal (*«El algoritmo es eficiente — supera al
anterior»*). Es un calco del inglés. Usar punto o punto y coma.
Reservar la raya exclusivamente para incisos en pareja (`—como se vio en la prueba—`).

### 1.2 Encapsulamiento relativo / pseudo-hendidas
Prohibido envolver la acción en frases neutras: *«Lo que se hizo fue...»*,
*«Lo que el análisis arroja es...»*, *«Lo que concierne a...»*.
- Mal: «Lo que la arquitectura aporta es mayor tolerancia a fallos.»
- Bien: «La arquitectura tolera fallos de red sin interrumpir el proceso.»

### 1.3 Pasiva refleja burocrática
Evitar *«Se procedió a realizar el despliegue»*, *«Se llevó a cabo la
medición»*. Usar *«Desplegamos»*, *«Medimos»*, *«El script ejecutó»*.

### 1.4 Gerundio de consecuencia colgante
Prohibido cerrar oración con gerundio evaluativo no justificado: *«...,
garantizando una experiencia óptima»*, *«..., sentando las bases para»*.
Cortar en punto. Si la consecuencia es real, describirla en oración aparte
con sujeto activo.

### 1.5 Falsos rangos
Mal: «Sistemas aplicables a sectores que van desde la agricultura hasta la
ciberseguridad.» Bien: nombrar los dos casos reales sin fingir un continuo.

### 1.6 Variación elegante forzada
No cambiar de sinónimo por miedo a repetir un término técnico (*el
servidor... el nodo... la entidad centralizada...*). En prosa técnica, la
precisión importa más que la variedad léxica.

### 1.7 Solemnidad y ponderación gratuita
Prohibidos sin métrica: *se erige como, juega un papel fundamental, da
testimonio de, marca un hito, indiscutible relevancia, ecosistema* (para
software ordinario), *robusto* (sin medida de resiliencia), *holístico,
crucial, pivotal, intrincado, sinergia, multifacético*.
Demostrar impacto con datos (`latencia < 20ms`, `caída del 30%`), no con
adjetivos.

### 1.8 Atribución difusa
Prohibidos: *los expertos coinciden, diversos estudios sugieren, es
ampliamente aceptado, como es sabido*. Nombrar la fuente concreta o borrar
la afirmación.

### 1.9 Metatexto y relleno de apertura/cierre
Eliminar: *«En este documento abordaremos...»*, *«Cabe destacar que...»*,
*«Es menester señalar que...»*, *«En resumen/A modo de conclusión...»*.

### 1.10 Abuso de dos puntos y titulación interna (Inline Labels)
Prohibido arrancar párrafos u oraciones con etiquetas de una o dos palabras
seguidas de dos puntos como si fueran diapositivas (*«Latencia: el sistema...»*,
*«En pocas palabras: el proceso falló»*, *«Un reto clave: la memoria»*).
Prohibido sustituir conectores causales por dos puntos (*«El servicio cayó:
se agotó la RAM»*).
- Mal: «Rendimiento: el motor optimiza las consultas concurrentes.»
- Bien: «El motor optimiza las consultas concurrentes para reducir contención de hilos.»

### 1.11 Frases cortas de carraspeo (Throat-Clearing Starters)
Prohibido abrir párrafos con oraciones telegráficas vacías (1–4 palabras)
que intentan resumir vagamente lo que sigue sin decir nada concreto:
*«Un enfoque clave.»*, *«La realidad es clara.»*, *«En términos simples.»*,
*«Un cambio necesario.»*.
Entrar directo con el sujeto y la acción técnica en la primera oración.

### 1.12 Parataxis excesiva y prosa telegráfica (Choppy Staccato / Estilo "Log")
Prohibido encadenar micro-oraciones independientes y secas (sujeto + verbo + punto) que narran una secuencia paso a paso como si fueran líneas de un log o viñetas disfrazadas de párrafo.
- **El síntoma:** Oraciones de 4 a 8 palabras aisladas (*«El handshake se completa. El servidor negocia TLS. La caída ocurre después.»*). Destruye la cohesión y traslada al lector la carga de conectar causas y efectos.
- **Regla:** Jerarquice la información mediante subordinación causal y concesiva (*aunque*, *pese a que*, *al momento de*, *lo que provoca*). Agrupe la condición, el síntoma y el resultado en una estructura con relieve argumentativo.
  - *Mal (telegráfico):* «El servidor completa el handshake TLS. Entrega un certificado válido. El fallo aparece un paso después. El gateway recibe la petición y no la procesa.»
  - *Bien (cohesionado):* «Pese a que el servidor completa el handshake y valida el certificado, el gateway rechaza la primera petición apenas la recibe, respondiendo con una alerta fatal decode_error.»

### 1.13 Abuso del punto y coma
El punto y coma es gramatical y por eso se vuelve muletilla: pega dos oraciones independientes sin declarar cómo se relacionan, y el lector infiere el vínculo Reservarlo para dos casos: separar elementos de una enumeración que ya trae comas internas, y unir dos cláusulas donde la segunda precisa a la primera sin que ninguna conjunción encaje mejor. En la práctica técnica casi siempre encaja mejor una conjunción (porque, aunque, mientras, así que) o un punto con sujeto explícito.
  - *Mal:* «El servidor acepta la conexión; el modelo responde.»
  - *Bien:* «El servidor acepta la conexión y el modelo responde.»

Límite práctico: uno por párrafo como máximo. Dos puntos y coma en el mismo párrafo delatan plantilla aunque cada uso aislado sea correcto.

## 2. English

Same failure modes, same fix: cut the padding, name the mechanism, keep
sentence length uneven.

- **Em-dash cascades**: one pair per ~500 words, never a lone connective dash.
- **Pseudo-cleft framing**: "What this shows is X" → "X happened."
- **False ranges**: "from A to Z" only when A and Z are real scalar extremes.
- **Elegant variation**: keep calling the *gateway* a gateway.
- **Trailing -ing clauses**: "..., ensuring optimal performance" → cut it,
  or state the real consequence as its own sentence.
- **Significance inflation**: ban *stands as, serves as a testament to,
  plays a pivotal role, underscores the significance*. State what it does.
- **Vague attribution**: ban *studies show, experts argue* without a name.
- **Banned words**: *delve, showcase, bolster, foster, harness, leverage,
  tapestry, testament, landscape, myriad, paramount, vibrant, seamless,
  robust* (unmeasured), *key* (as filler adjective).
- **Inline topic labels & colon overuse**: ban "Label: description" starters
  and replacing causal conjunctions with colons. No telegraphic slide headings in prose.
- **Staccato throat-clearing**: ban 1–4 word vacuous openers ("A critical distinction.",
  "In practical terms."). Start immediately with the active agent and empirical fact.
- **Excessive parataxis & choppy staccato (log-style prose)**: ban strings of disjointed 4–8 word micro-sentences that narrate events like execution logs to show hierarchy, contrast, and cause rather than flat sequential steps.
- **Semicolon chaining**: at most one per paragraph. Prefer a causal conjunction or a full stop with an explicit subject over gluing independent clauses; two in one paragraph read as template even when each is grammatical.

## 3. Protocolo de dos pasadas

1. **Barrido mecánico**: quitar rayas sueltas, vocabulario prohibido,
   gerundios de cola, encapsulamientos relativos, dos puntos de etiquetado, aperturas telegráficas vacías y puntos y coma de plantilla..
2. **Control de cadencia**: ninguna oración exportada debe superar dos
   vecinas de longitud casi idéntica. Vigilar que la prosa no caiga en ráfagas de 3 o más oraciones cortas consecutivas sin nexos de subordinación. Las oraciones deben articular relaciones causales, no listar eventos cronológicos planos. Todo número o afirmación empírica debe tener un dato, comando o resultado concreto detrás — si no lo tiene, se borra o se marca como hipótesis. El punto y coma suma a la monotonía igual que la longitud: más de uno por párrafo es plantilla.

## 4. Antes de entregar

Releer el texto final una vez buscando específicamente: rayas sueltas,
"lo que", dos puntos (`:`) usados como etiquetas, gerundios al final de oración, puntos y coma (más de uno por párrafo), y cualquier adjetivo de la lista prohibida. Si aparece alguno, reescribir esa oración completa, no solo parchar la palabra.