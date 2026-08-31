# Bitácora de errores y aciertos — web Waly.AI (`conejeros-solution`)

Qué es esto: lo que salió mal (y lo que salió bien) trabajando esta web, para no repetirlo.
Se consulta ANTES de improvisar y se escribe al cerrar cada arreglo.

Datos fijos del proyecto: sitio estático de un solo `index.html`, GitHub `lukasconejeros/conejeros-solution`
(rama `main`, **Vercel auto-despliega en cada push**, ~1-2 min). Dominio actual `www.conejeros-solutions.cl`.

---

## #1 — 08-08-2026 · La web nunca se había mirado en un teléfono de verdad

**Cómo apareció:** Lukas abrió su propia web desde Instagram en el móvil y mandó una captura: el logo
enorme y el botón de agendar saliéndose por la derecha.

**Qué estaba pasando (medido con Playwright a 320 / 360 / 390 / 430 px):**
- El botón `📅 Agendar Reunión` medía **188 px** y terminaba en el píxel **373**, con la barra acabando
  en **304** (pantalla de 320) y en **344** (pantalla de 360) ⇒ se salía literalmente de la barra.
  A 390 px terminaba en 373 con la barra en 374: **1 px de aire**, que es lo que se ve en la captura.
- El logo medía **136 px de ancho** (fuente 25,2 px) — casi la mitad de la barra de un teléfono.
  Ojo: el `:root` de esta web usa **18 px** de base, así que cada `rem` es un 12,5 % más grande
  de lo normal. Un `1.4rem` que en otra web son 22 px, aquí son 25.
- El hero se comía **~180 px** de aire antes del título (nav sticky de 102 px + `padding-top` de 80).
- Dos placeholders del modal de reserva salían **cortados**: «…empresa o cl» y «+56 9 1234 567».
- El botón flotante de WhatsApp (52 px) tapaba el chip «Reservo», los **días 29 y 30 del calendario**
  (clickeables) y el precio del plan Pro AI.

**Arreglo** (commit `9554950`): todo dentro de `@media (max-width:640px)` y `(max-width:480px)`, más un
`<span class="nav-btn-largo">` que en móvil esconde la palabra « Reunión» y deja el botón en «Agendar».

**La lección que vale para la próxima:**
1. **Cada arreglo móvil se mide, no se mira.** El script que lo hace vive en
   `huevos-dashboard-web\audit-movil-waly.cjs`: recorre 4 anchos, lista TODO elemento cuyo borde derecho
   pase del viewport y guarda capturas. Sin él, «se ve bien» es una opinión.
2. **Tocar móvil obliga a comprobar el escritorio** (`audit-escritorio.cjs`, 1440/1024/768): se verificó
   que el texto del botón, el tamaño del logo y el ancho siguen idénticos. Cambiar el CSS de la barra sin
   ese chequeo es como se rompen las tres pantallas a la vez.
3. **Nunca bajar la letra de un `input` por debajo de 16 px reales**: iOS hace zoom solo al tocarlo y
   descoloca la página. Aquí se dejó en 16,2 px (`.9rem` sobre base 18).
4. **Los pop-ups tapan las capturas.** `AdSequence` saca su anuncio a los ~10 s y arruina la auditoría:
   hay que sembrar `localStorage` con `orion_adpop<N>_v1 = '1'` (N de 1 a 4) *antes* de cargar la página.
5. `.hero-content` se estiraba a 332 px en pantallas de 320 por ser un *flex item* que se dimensiona a su
   contenido mínimo. Se arregla con `width:100%;min-width:0`, no con `max-width`.

**Acierto que conviene repetir:** antes de tocar nada se listaron los anchos afectados y los NO afectados,
y se dejó por escrito qué le pasaba a cada uno antes y después. Ningún cambio se coló al escritorio.

---

## #2 — 08-08-2026 · Las notas decían «falta desplegar» y ya estaba desplegado

**Qué pasó:** la memoria del proyecto daba por pendiente que Lukas apretara «Desplegar» en la app y que la
web estaba commiteada sin publicar. Al comprobarlo en vivo, las dos cosas ya estaban hechas: `origin/main`
tenía `cb66211` y `GET /api/agenda-web?date=…` respondía 200 con los 6 horarios.

**Lección:** el estado real se comprueba con **una llamada al servidor y un `git log origin/main`**, nunca
con lo que dice la nota de la sesión anterior. Cuesta 20 segundos y evita rehacer trabajo hecho.

**Prueba de punta a punta que sí se corrió** (08-08, 22:00, ver también #3): con la web publicada y en un móvil simulado de
390 px se reservó de verdad el martes 11 a las 18:00 → pantalla «¡Reunión Agendada!» y el servidor pasó a
devolver `busy:["18:00"]` para ese día. La cadena web → app → agenda funciona en producción.
⚠️ Esa reunión es de PRUEBA y hay que borrarla, o el martes a las 17:30 saldrá un recordatorio real.

---

## #3 — 08-08-2026 · «Que avise si el WhatsApp no se pudo enviar»: no se puede saber en el momento

**Qué pidió Lukas:** que si la persona se equivoca de número, la pantalla diga «no se pudo enviar el
mensaje, verifica tu número».

**Lo que se encontró al ir a hacerlo:** el servidor **no manda** el WhatsApp, lo **encola**
(`enqueueOutbox` en `src/app/api/agenda-web/route.ts` de `whatsapp-conejeros`). El envío real lo hace
después el bot. Por eso `aviso_fallido` solo se enciende si falla el encolado — que casi nunca falla —
y **un número que no existe en WhatsApp NO se detecta mientras la persona está en la página**.

**Lo que sí se hizo, que cubre el 95 % de los casos reales:**
1. **Validar el número antes de agendar**, en la web y en el servidor, como móvil chileno de verdad
   (`9XXXXXXXX` o `569XXXXXXXX`). Antes bastaban 8 dígitos cualesquiera. Los errores de tipeo —que son
   casi todos los casos— se paran ahí, con un mensaje que enseña el formato.
2. **Mostrar el aviso ámbar cuando `aviso_fallido` sí llega**, con el número que escribió.

**Lo que queda sin cubrir y hay que decirlo en voz alta:** un número bien escrito que no tenga WhatsApp.
Para eso habría que preguntarle a WhatsApp si el número existe (`onWhatsApp` de Baileys) o avisarle a
Lukas cuando el envío falle en la cola. **Decidir con Lukas antes de construirlo.**

**La otra lección, de orden:** al quitar el correo, la web nueva manda `email: ""` y el servidor viejo lo
exigía ⇒ publicar la web antes que la app habría roto **todas** las reservas con «Necesito un correo
real». Cuando el cambio toca los dos lados, **primero se despliega la app y después se publica la web** —
es la misma regla que ya estaba escrita para el 07-08, y sigue valiendo.

---

## 31-08-2026 — El medidor de indexación mentía: Bing y Google devuelven basura a la automatización

**El error:** el 30-08 se afirmó *«`site:conejeros-solutions.cl` da 0 en Google y 0 en Bing»* midiendo con
`curl` contra `bing.com/search`. **Ese dato no estaba probado.** Al validarlo hoy con dominios de control
(`mercadolibre.cl`, `miagenda.cl`) el mismo método devolvió **exactamente el mismo «0»** para sitios que
obviamente sí están indexados ⇒ el instrumento estaba roto, no el sitio.

**Lo que se probó hoy, uno por uno:**

| Método | Qué devolvió |
|---|---|
| `curl` a `bing.com/search` | Página degradada sin resultados; la frase «No se encontraron resultados» está en el HTML **siempre**, hasta para `site:mercadolibre.cl` |
| `lite.duckduckgo.com` (POST) | Respuesta fija de ~14 KB, 0 resultados para todo |
| Mojeek, Brave, Ecosia por `curl` | Bloqueados |
| Playwright **headless** contra Bing | 10 resultados de **relleno aleatorio** (duchas, Minecraft) |
| Playwright **con ventana** contra Bing | Sigue el relleno: para `site:conejeros-solutions.cl` devolvió bancos alemanes |
| Playwright contra Google | **captcha** siempre |
| `WebFetch` a Bing | Resultados de alquiler de coches |

**La regla que queda:** *un buscador consultado por script no es una medición.* Si hay que medir
indexación, las únicas fuentes válidas son **Google Search Console**, **Bing Webmaster Tools** o que
**Lukas lo mire en su navegador**. Y cualquier medidor nuevo se valida antes con un dominio de control
que se sabe indexado: si el control también da cero, el cero no vale.

**Lo que sí quedó medido de forma válida** (con la herramienta de búsqueda del asistente, que sí
devuelve resultados reales y se contrastó con controles): buscando el H1 exacto de nuestra guía de
precios salen **10 competidores chilenos** con páginas del mismo tipo y **ninguna nuestra**; buscando el
dominio literal `conejeros-solutions.cl` **no aparece ni una página del sitio**, sale «Conejeros y Cía»
(otra empresa). Cero menciones en internet = cero enlaces entrantes.

**La causa de fondo, con fecha:** el repo arranca el **01-11-2025**, o sea la web lleva **10 meses**
publicada, nunca se dio de alta en Search Console ni en Bing Webmaster, y nadie la enlaza. Los
buscadores descubren webs por enlaces o porque el dueño las registra; no había ninguna de las dos.
