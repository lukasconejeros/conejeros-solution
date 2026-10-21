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


## 20-09-2026 — La web nueva (walybot.cl) llevaba 20 días sin poder reservar

**Síntoma**: nadie lo reportó. Se cazó al preparar la landing: en walybot.cl, elegir día, hora y
datos terminaba en "Ocurrió un error al agendar". Reproducido con navegador real (Playwright) sobre
la web publicada: `blocked by CORS policy: No 'Access-Control-Allow-Origin'`.

**Causa**: el 31-08 la web se mudó de conejeros-solutions.cl a walybot.cl, y `/api/agenda-web` de
whatsapp-conejeros solo le respondía al dominio viejo (lista fija en `route.ts`, con
`AGENDA_WEB_ORIGENES` que la REEMPLAZABA). El navegador bloqueaba la reserva antes de que llegara:
no se creó ninguna reunión fantasma, simplemente no entraba ninguna.

**Arreglo** (whatsapp-conejeros `3bd326b`): `ORIGENES_WEB` + `origenPermitido()` en
`src/lib/agenda-web.ts`, con walybot.cl, www.walybot.cl y el dominio viejo; la variable de EasyPanel
ahora SUMA. 10 comprobaciones nuevas. Probado con la app levantada en local: walybot.cl recibe el
permiso, una web cualquiera no.

**Lección (la de fondo)**: una mudanza de dominio tiene casos hermanos fuera del repo de la web. Al
cambiar de dominio hay que buscar el dominio viejo en TODOS los servicios que la web llama (acá, la
app de la agenda), no solo en los archivos de la web.

**De paso, medido el 20-09 a las 20:50 con `/api/diag-envio`**: el WhatsApp de la app está
`disconnected` desde el 19-09 11:02 (caída del VPS) y `TELEFONO_LUKAS` NO está configurado ⇒ aunque
la reserva entre, la confirmación queda en cola hasta que se escanee el QR, y a Lukas no le llega
ningún aviso. La prueba de envío en esta app es `outbox.sent=1`, que se escribe DESPUÉS de
`sock.sendMessage` (sale de la cola), no una confirmación de entrega en el teléfono.

**Acierto**: la confirmación que recibe la persona (`b152d83`) pasó a usted, un párrafo, hora sin
cero, Waly.IA y el nombre bien escrito aunque lo tipeen mal (13 comprobaciones). Se probó pasando la
reserva que mandó el navegador por `procesarReserva()` real.

## 27-09-2026 — página nueva del ángulo dolor + la sospecha del dominio que resultó falsa

**El error más grave, cazado antes de publicar:** el agente que redactó
`no-doy-abasto-whatsapp-clinica.html` metió **tres cifras que nadie le dio**, en una página que se iba a
subir a producción:
1. *«Un asistente con IA: desde $244.000 al mes»* — el precio real es **$300.000 a $370.000**. Los
   $244.000 se parecen sospechosamente a los USD 249 de Dentiqa convertidos a pesos: mezcló el precio de
   un competidor con el nuestro. Publicar eso obliga a negociar hacia abajo desde un número falso.
2. *«Un bot de botones: desde unos $50.000 al mes»* — precio de un tercero, sin ninguna fuente.
3. El cálculo del costo: partía de *«5 pacientes nuevos perdidos AL DÍA»* ⇒ **$6.600.000 al mes**. Además
   de inverosímil, había un salto lógico: los 10 mensajes sin contestar del ejemplo eran mezcla de
   pacientes nuevos y de siempre, y los contaba **todos** como pacientes nuevos perdidos.
**Corregido:** 3 pacientes nuevos de esos 10, uno perdido cada dos días ⇒ 11 al mes ⇒ **$660.000 al mes**,
más una línea que dice que es un ejemplo con supuestos y no una medición de esa clínica.
**Regla que queda:** a un agente redactor hay que **contarle los números que puede usar y después
verificar uno por uno los que aparecen en el texto** (`grep` de cada cifra). Las instrucciones decían
«no inventes datos» y los inventó igual.

**De paso:** usaba `class="nota"`, que no existe en el CSS de la página (las clases reales son caja,
lede, tabla, legal, cierre…). Cambiado a `legal`.

**La sospecha que motivó la auditoría era FALSA, y está bien que lo sea:** se creía que la mudanza de
`conejeros-solutions.cl` a `walybot.cl` había roto el posicionamiento. Medido: el dominio viejo aparece
**solo 2 veces en todo el repo**, en `vercel.json` líneas 9 y 20, que son justamente las reglas de
redirección (tienen que decir el dominio viejo). Canonical, og:url, sitemap (31 URLs), robots.txt y
llms.txt ya apuntan todos a walybot.cl. Nivel de lectura por robots de IA: **3 de 5**, el mismo del
29-08 (`curl -s -X POST https://isitagentready.com/api/scan`).

**Por qué NO se tocó el redirect de dos saltos:** medido, `conejeros-solutions.cl` → 308 a
`www.conejeros-solutions.cl` → 308 a `walybot.cl`. El primer salto **no lo hace `vercel.json`** (la regla
del apex ya existe, líneas 15-24): lo hace la configuración del dominio en el panel de Vercel, que manda
el apex a www antes de que corra cualquier regla del archivo. Es decir, **no se arregla desde el código**,
y dos redirecciones permanentes seguidas no dañan el posicionamiento. Queda anotado para no volver a
"arreglarlo" acá.

**Y por qué NO se va a subir del nivel 3 al 4:** los requisitos del nivel 4 que devuelve la API son MCP
Server Card, A2A Agent Card, Agent Skills index, API Catalog y OAuth discovery. Todos consisten en
**declarar capacidades que esta web no tiene** (no hay servidor MCP, ni agente A2A, ni API pública).
Es la misma decisión del 29-08 y sigue en pie: no se miente para subir un puntaje.

## 29-09-2026 — Fuera las clínicas cliente, franja «Se conecta con» y sección de planes

**Pedido de Lukas:** sacar a las clínicas de las páginas, mostrar logos de Dentalink, Dentalsoft,
WhatsApp, Reservo y Medilink, y 3 planes con solo precio ($200.000 / $310.000 / $420.000).

**Dónde estaban las clínicas (grep de anpalex|medifis|yaber|mónaco):** portada (franja con logos y
direcciones de Anpalex y Medifis), el pie de 30 guías («Hoy funcionando en Dental Anpalex… y Clínica
Medifis…»), `llms.txt` (sección «Clínicas que ya usan Waly») y `og-image.svg` (la imagen al compartir
el link). Yaber y Mónaco no aparecían. Quedan los casos anónimos («un centro médico de Temuco»).

**Error cazado en la captura, no en el código:** la tarjeta de plan salía con el nombre gigante porque
`index.html` todavía guarda el CSS de la sección de planes vieja (`.plan-card`, `.plan-name` en las
líneas ~440-490 y ~727-742) aunque ya no exista su HTML. Las clases nuevas se renombraron a
`precio-card`, `precio-nombre`, etc. **Regla:** en `index.html` buscar el nombre de una clase antes de
usarla; hay CSS muerto de versiones anteriores que la pisa.

**Captura a 390 px:** Edge headless no achica la ventana bajo ~500 px y la captura sale cortada a la
derecha. Se captura metiendo la página en un `<iframe style="width:390px">`.

## 15-10-2026 — Landing compacta: cifras medidas, franja Ley 21.719 y fuera el recuadro «Aquí va el video»

**Pedido:** que se vea más como landing y más compacta, con «100 % legales con la nueva ley» (o escrito de
forma que no sea mentira) y cuántas citas agendó el bot y cuánta plata dejó.

**Lo que se publicó y de dónde sale:**
- Cifras = la medición del 14-10-2026 17:22-18:10 (`conejeros-lab/creativos-waly-ads/DATO-PACIENTES-Y-PLATA-WALY-2026-10-14.md`).
  «+400 citas» es un PISO de citas nuevas de la IA (61 Anpalex + 197 Medifis + 146 Yaber = 404; sin pruebas
  ni horas que solo movió; con las movidas son 476). «+120 pacientes» = el estricto (132; 108 nuevos y el
  resto con 90+ días sin venir, por eso NO dice «120 nuevos»). «+$15 millones» = $16.319.118 de esos 132.
- Ley: NO dice «100 % legal» ni «cumplimos» (el plan de la ley no está hecho). Solo 4 hechos verificables:
  contrato de encargo, no vendemos datos, borrar datos (eliminar-datos.html), «no me escriban más» (opt-out
  determinista en los 3 bots: Medifis y Yaber `handler.ts`, Anpalex `proactivo-regla.ts`).

**Error evitado:** la web publicada mostraba un recuadro negro «Aquí va el video» porque `video/landing-waly.mp4`
no existe (404). Ahora el bloque queda plegado y aparece solo cuando se sube el archivo (probado con un mp4
de prueba que se borró después).

**Caso que casi se cuela:** al poner las cifras arriba, el botón «Agendar» quedó bajo el pliegue en 375×667
(iPhone SE/8) y 320×640, y con video también en 1366×800. Arreglo: en el teléfono el botón va antes de las
cifras, y en todas las pantallas el video va después del botón. Pruebas: `pruebas.cjs` 85/85 sin video y
85/85 con video en 390, 375, 320, 768, 1366 y 1920.

**Regla:** las cifras de la portada NO se suben «porque ya pasó tiempo»: se vuelven a medir con el mismo
método y se cambia la fecha de la nota.

## 15-10-2026 (2) — Reserva: primero los datos, después el calendario; reunión de 45 minutos

**Pedido:** sacar el calendario de la página; que «Reservar reunión de 45 minutos» pida nombre, cargo, correo,
WhatsApp y clínica, y recién ahí aparezca el calendario. Sobre el teléfono mal escrito, Lukas eligió «revisar y
confirmar»: solo pasa un celular chileno y antes del calendario se le muestra su número en grande
(«¿Está bien escrito?» / «No, lo corrijo»). El correo queda de respaldo si igual se equivoca.

**Cambios:** fuera la sección del calendario grande y su código (`AgendaInline`); `AgendaFlow` reescrito (datos →
confirmar número → calendario → «Confirmar reunión»); horas de 45 min (mismas horas de inicio); `walybot.cl/#reservar`
abre la ventana directo. App Conejeros `791e7cd`: horas de 45 min y el cargo en la nota y en el aviso a Lukas.
«Diagnóstico de una hora» → 45 minutos también en secretaria-virtual, waly-vs-dentipilot y llms.txt.

**Caso hermano que apareció:** hoy se ofrecían horas que ya habían pasado (a las 17:00 dejaba reservar las 9:00 de
hoy). Arreglado en la web: hoy solo salen las horas que parten en 1 hora o más (`yaPaso`). La app Conejeros todavía
acepta una hora pasada si alguien la manda a mano: pendiente.

**Pruebas:** `prueba_reserva.cjs` 53/53 (con la app reemplazada por un doble: no se reservó nada de verdad),
`prueba_hoy.cjs` con reloj fijo, `pruebas.cjs` 85/85. App: test:agenda-web 83+64+23, separación 24.

## 19-10-2026 — Video corto + formulario a la vista → /metodologia (video largo + calendario)

**Pedido:** el video corto arriba para que llenen el formulario, sin el nombre de la clínica, y que al llenarlo los
lleve a la página del video largo. Hecho: `video/landing-intro.mp4` arriba del hero, formulario de 4 campos a la vista
(nombre, cargo, correo, WhatsApp + confirmar el número), `metodologia.html` (`/metodologia`, noindex) con el video largo
y el calendario debajo. La lógica y los estilos de la reserva salieron de `index.html` a `agenda.js` y `agenda.css`, que
usan las dos páginas. Se manda `empresa:''` (la app pone el nombre de la persona en el título).

**Error cazado por la prueba:** `walybot.cl/#reservar` bajaba al formulario pero el nombre quedaba SIN foco. El navegador
salta solo al `id="reservar"` después de cargar y en ese salto suelta el foco. Arreglo: esperar a `load` (+60 ms).
`#agendaInline` funcionaba porque ya no existe ningún elemento con ese id.

**Lo que queda abierto (decidir con Lukas):** el video corto dice «nos contactamos contigo por WhatsApp», pero los
datos del formulario solo viven en el navegador. A la app llegan únicamente si la persona RESERVA. Quien llena el
formulario y no agenda queda solo como evento `Lead` en Meta (sin nombre ni teléfono). Para cumplir esa frase hace falta
una ruta pública nueva en whatsapp-conejeros que reciba el lead.

**Lecciones para la próxima:**
1. Para probar video con Playwright usar `channel:'msedge'`: el Chromium de Playwright no reproduce H.264.
2. Un chequeo con expresión regular de «los datos no van en la URL» buscaba «8765» y chocaba con el puerto local 8765.
3. La bandera 🇨🇱 sale como «CL» en Windows (el emoji de bandera no existe ahí). Se sacó de `/metodologia`.
4. Con portada (`poster`) el video se ve desde el primer momento. Antes quedaba invisible hasta cargar y empujaba lo de abajo.

**Pruebas:** `pruebas.cjs` 196/196 en local (servidor que aplica los rewrites de `vercel.json`) y 196/196 contra
walybot.cl ya publicado, con la app y el pixel reemplazados por dobles: no se creó ninguna reunión de verdad.

## 19-10-2026 (2) — Sin el campo cargo, y el contacto llega a la app al confirmar el número

**Pedido (Lukas):** «sácale el puesto de la clínica» y que la persona que llena el formulario reciba un WhatsApp a
los 3 minutos (y otro a la hora si no contesta). Cierra lo que quedó abierto en la entrada de arriba: hasta hoy los
datos solo llegaban a la app si la persona reservaba.

**Cambios:** fuera el cargo en todos lados (`CARGOS`, el `<select>`, su validación, `CAMPOS`, `datos()`, `rellenar`,
lo guardado y el CSS `.ag-select`); la reserva manda `cargo:''`. Al confirmar el número, `avisarContacto` manda
`{nombre, email, whatsapp}` a `POST /api/agenda-web/contacto` de la app Conejeros (que guarda el contacto, avisa a
Lukas y programa los dos mensajes). Espera como máximo 2,5 s y se va al video conteste o no; el botón queda tomado
mientras espera; una sola vez por número en la pestaña (`sessionStorage waly_contacto_avisado`), y si falló se
reintenta al confirmar otra vez (la app igual descarta un formulario repetido).

**Familia revisada:** el formulario se confirma en 3 lugares (portada, /metodologia sin datos y «Cambiar mis datos»).
El aviso vive dentro de `formulario()`, así que los 3 avisan; con el mismo número no se repite y con un número
nuevo sí (es otra persona o un número corregido).

**Orden al publicar:** primero Implementar la app y después subir la web. Si la web sale antes, el aviso del
contacto da error (la ruta no existe), la persona igual llega al video y no se pierde nada más que ese contacto.

**Trampa:** mientras se probaba, otra conversación estaba reemplazando los videos (`video/*.mp4` y `.jpg`) en este
mismo árbol y el video largo no cargaba. No se tocaron ni se commitearon: las pruebas se corrieron sobre una copia
de HEAD con solo los 3 archivos de este cambio.

**Pruebas:** `pruebas.cjs` 196/196 antes (HEAD) → 228/228 después, con la app y el pixel reemplazados por dobles
(nada sale a la app de verdad). Nuevas: 3 campos sin cargo, el contacto sale una vez con nombre, correo y WhatsApp,
/metodologia no lo repite, dos toques mandan uno, app caída (500) y app que no contesta (se va a los ~2,5 s).

## 19-10-2026 (tarde) — Video corto sin «Eso, nos vemos» + código por WhatsApp en el formulario

**Video** (`7b61191`, en vivo): Lukas pidió que termine en «…nos contactamos contigo por WhatsApp». Corte del render
`out/landing-horizontal/INTRO.mp4` a 21,8 s, justo en el silencio (21,44-21,88 s) entre «WhatsApp» y «Eso»; la
tarjeta de los 3 pasos queda completa. Verificado: transcripción del archivo nuevo termina en «WhatsApp» y el
Content-Length de walybot.cl = 4.084.775 = el archivo subido. Ojo: el `edit.data.json` de Remotion sigue en 23,13 s;
si se vuelve a renderizar, hay que volver a cortar.

**Código por WhatsApp** (agenda.js): pasos campos → «Te estamos mandando un código…» → casilla de 4 números. Número
sin WhatsApp ⇒ vuelve al campo con el aviso. La app no puede (sin red, 401 porque falta Implementar, tope, fallo, o
15 s sin salir) ⇒ el «¿Está bien escrito?» de antes: nunca se pierde un contacto. Número ya verificado en ese
navegador (`waly_tel_verificado`) ⇒ no pide código otra vez.
- Error propio cazado por la prueba: con `maxlength="4"` un código pegado como «48-21» se cortaba en «48-2» y no
  pasaba. Ahora `maxlength="9"` y el código se limpia a 4 dígitos.
- La batería vieja (`pruebas.cjs`) fallaba por tiempos: ahora hay una consulta antes del «¿Está bien escrito?». Se le
  agregó esperar a ese paso y contestar `sin_conexion` al verificar (prueba el camino sin código).

**Pruebas**: `prueba_codigo.cjs` 82/82 (teléfono y computador, Edge, la app reemplazada por un doble) + `pruebas.cjs`
228/228 ajustada. Nada salió a la app de verdad.

## 19-10-2026 (tarde) — SIN código: un solo paso y la app revisa el número por detrás
Lukas, apenas vio el código: *«no me gusta con un código. Es mucho enredo… mucho hueveo»*. Fuera la casilla del código
Y el «¿Está bien escrito?» (el 19-10 a las 13:00 ya había dicho que no quería «ese es tu número»). Ahora: 3 campos →
«Ver el video» → «Revisando tu WhatsApp…» (campos de solo lectura) → `/api/agenda-web/revisar-numero` de la app
Conejeros, que pregunta a WhatsApp SIN mandar nada. «no_existe» ⇒ error bajo el campo y no pasa; cualquier otra cosa
(app caída, 401, topes, 6 s sin respuesta) ⇒ pasa. Lo que se pierde: un número mal escrito que existe (de otro).
- Orden de despliegue pensado antes: ruta nueva ⇒ con la app vieja da 401 y la página pasa directo (nunca un código).
**Pruebas** (subagente, Edge, la app reemplazada por un doble): `prueba_revisar.cjs` 421/0 (teléfono y computador,
48 escenarios; peor caso medido 9 s) y `pruebas.cjs` adaptada 259/0; control negativo: la misma prueba contra el código
viejo se queda en «¿Está bien escrito?». Producción (curl, Origin walybot.cl): su número ⇒ verificado en 1 s,
569 0000 0000 ⇒ no_existe, /verificar ⇒ sin_conexion, otra web ⇒ 403.

## 19-10-2026 (noche) — Lectura fácil de la portada
**Pedido (Lukas):** «la landing no se deja leer bien». La auditoría de lectura (Edge, teléfono y computador) midió:
formulario fuera de la primera pantalla en computador (empezaba a 833 px con 768), qué hace Waly recién en los planes,
grises de 13 px con contraste 2,6 a 1, la frase clave del título en degradado (2,4 a 1), cifras seguidas con frases de
85 letras y «su clínica» mezclado con «tu clínica». No eligió titular: se usó el recomendado (su idea pulida).

**Cambios:** título «Deja de perder pacientes por no contestar el WhatsApp» en un solo color; bajo él las 3 cosas que
hace (contesta, deja la hora en la agenda, confirma el día antes); en computador video y formulario lado a lado; etiqueta
arriba de cada campo (agenda.js, vale también para /metodologia); grises a #475569/#64748b y 15 px; una cifra por fila,
+130 y +$16 millones (las del video, decidido el 15-10) y «entre junio y el 14 de octubre»; «tu clínica» en los planes;
planes uno debajo del otro en el teléfono (fuera el carrusel); la Ley debajo de los planes; menú y planes dicen «Ver el
video» como el formulario (fuera el botón naranja «Reservar»).

**Trampa:** el puerto 8771 lo tenía tomado otro servidor viejo (de otra conversación) que servía una versión con el campo
cargo: la batería falló en la versión de partida por eso, no por la web. Antes de probar, mirar que el servidor propio
arrancó (`srv.log` sin EADDRINUSE) y usar un puerto libre.

**Lo que se pierde:** en el teléfono la página quedó más larga (los 3 planes ya no van de lado).

## 21-10-2026 (noche) — Videos v2 y cuánto del video ven
**Pedido (Lukas):** «me gusta lo que dices, hazlo» a la revisión de videos. Hecho: `235323f` (medir-video.js: cada hito
una vez por pestaña a la app Conejeros, sin datos de la persona) y `05734fc` (corto 21 s con el resultado primero y
subtítulos, sin «de seis minutos»; largo 4:17 sin los 4 pasos, sin «400, 600 o un millón», sin «3 horas antes» y sin
«con otra clínica»). Cómo se hicieron: `conejeros-lab/creativos-waly-ads/edit-landing-horizontal/cortar_intro.py`,
`preparar.py` y `cortar_largo_web.py`.
**Para leer los números:** los dos videos arrancan sin sonido, así que «play» ≈ visita; lo que dice si lo miraron es
«sonido» y s25…s100. Las visitas de Lukas también cuentan.
**Cortes en un video ya renderizado:** se corta el MISMO largo de video (en cuadros) y de audio (en un silencio medido
cada 10 ms): así no se desfasan aunque el instante del corte difiera unos ms. Revisar cada corte transcribiéndolo.
**Pruebas:** `prueba_medir.cjs` 27/27 (Edge 390 y 1366, app reemplazada; contra la versión anterior 0 avisos). En vivo:
Content-Length de los dos videos = los archivos subidos.
