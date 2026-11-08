# Sistema 3.0: entrenador en casa (versión 6.0)

Es tu guía de sesiones del Sistema 3.0 (semanas A/B, filtro de rodilla, escaleras de progresión, registro de series) como app que se instala en el celular y la laptop, funciona sin internet y puede usar la cámara.

**Lo nuevo en la versión 6.0:**

- **Sesión continua: no tienes que tocar el celular.** Al terminar el descanso, la serie empieza sola; con tempo, termina sola al llegar al tope del rango (si no llegas, di «listo» o toca Hecho); sin tempo, la serie tiene su tiempo y pasa sola al descanso. Isométricos y estiramientos también arrancan solos. Se apaga con el botón **Continua** o en Ajustes.
- **Cambios entre ejercicios con su cuenta.** Cuando dos ejercicios distintos van seguidos sin descanso (por ejemplo el circuito D), hay unos segundos de «Cambio» que te dicen qué hacer: dejar la antigua, pisar la liga, bajar al piso…
- **Cada descanso te prepara con detalle, no con una lista de nombres:** «Ahora, mientras descansas» (los discos exactos, la liga, qué mancuerna tomar), «Sigue» (serie, repeticiones, carga, en qué postura empieza y cómo) y «Deja listo para después» solo cuando hay algo que preparar antes de que llegue (lo de un circuito sin descansos largos).
- **El reloj dice la verdad:** arriba ves si vas atrasado (+1:20) o adelantado, y a qué hora terminas. El plan ya cuenta lo que de verdad dura cada serie con tu peldaño de hoy (si una variante cambia el tempo, las repeticiones o deja de ser por lado, el tiempo cambia solo). Al final te dice dónde se fue el tiempo (series más largas, descansos alargados, cambios lentos, pausas).
- **Figuras con cuerpo y movimiento.** Ya no son palitos: maniquí con volumen, cabeza que mira hacia donde mira, el lado lejano más oscuro y una flecha que muestra hacia dónde se mueve. Se mueven siempre (antes, el ahorro de batería del celular podía dejarlas quietas). Y si tu peldaño cambia la forma (pies en la silla, barra, a una pierna, búlgara, pino contra la pared…), la figura es la de tu peldaño.
- **Todo en una pantalla, en vertical y en horizontal.** En horizontal, la figura a la izquierda y lo demás a la derecha. El giro lo acomoda el diseño al instante (sin recalcular nada). Si tu celular gira cuando no quieres, en Ajustes puedes fijar el giro con pantalla completa.
- **Ajustes aparte.** El botón de engranaje (arriba) abre los Ajustes por secciones; dentro de la sesión abre una hoja con lo de la sesión (el reloj espera mientras ajustas). La página del día quedó limpia.

**Lo que trajo la versión 5.0:**

- **«Prepara tu equipo» al empezar.** Antes de que corra el reloj ves (y escuchas) cómo armar las mancuernas para el primer ejercicio, los cambios que harás durante la sesión y la lista del 3.0 de lo que tienes que dejar listo, con casillas para marcar.
- **Descansos que te adelantan el trabajo.** En cada descanso: anotas reps y RIR; «Mientras descansas» te dice qué preparar ahora (discos, liga, la mancuerna que sigue), pensando 2 o 3 ejercicios adelante y eligiendo el descanso más largo para los cambios de discos; «Sigue» te muestra el próximo ejercicio con su figura y su posición; «Luego», lo que viene después y con qué.
- **Figura animada de cada ejercicio** (los 36, sin internet). Durante la serie se mueve con el mismo tempo que suena: rojo = fuerza, azul = regreso, morado = mantener. En «Detalles» y en Dudas («¿cómo se hace?») también está, con un enlace a videos de YouTube si tienes internet.
- **Sonidos, uno por estímulo:** «tuiii» que sube = fuerza; «tiuuu» que cae = regreso; «tu-tu-tu» parejo = mantener. Duran lo que dura la fase. Ningún otro aviso sube ni cae de tono.
- **Ejercicios por lado:** al terminar el lado 1, el lado 2 empieza solo con 6 s para cambiar (con tempo, arranca solo y termina solo al igualar las repeticiones del lado 1). Reps y RIR se anotan una vez, al final de los dos lados.
- **Avisos sin repetir:** el siguiente ejercicio se nombra una vez; a los 10 s solo «Diez segundos, ponte en posición».
- **Pantalla más limpia:** arriba y abajo más delgados; nada tapa el contador.
- **Un solo botón «Asistente»** en vez de «Manos libres» y «Conversar». Con tu clave gratis de Google usa Gemini Live; sin eso, los comandos de voz del celular. Ya no se oye a sí misma, pide una voz clara para interrumpirla y entiende mejor los comandos («ok listo», «me quedaron dos», «llegué al fallo», «¿qué preparo?»).

**Lo que trajo la versión 4.1:**

- **Una sola contraseña para tus equipos.** Ya no pegas claves en cada equipo: uno nuevo abre la app, escribe la contraseña y recibe todo (sesiones, progreso, ajustes y tu clave de Google). Los que ya conectaste siguen igual.
- **Tus ajustes también viajan:** discos, tempo, voz y su velocidad, cámara y conversación. Y la clave de Google, cifrada.

**Lo que trajo la versión 4:**

- **Un entrenador que piensa a largo plazo.** Lee tus repeticiones, el RIR, lo que mide la cámara, la rodilla, tu peso y tus medidas, y con las reglas del 3.0 te dice qué subir, qué repetir, qué bajar, cuándo descargar y qué está estancado. Todo en el botón **Progreso**.
- **Tus datos en todos tus equipos.** El celular y la laptop guardan en un repositorio privado tuyo de GitHub y se juntan solos.
- **Se actualiza sola.** Cuando subes una versión nueva, la app se pone al día sola, nunca en medio de una sesión.
- **Conversación en tiempo real.** Le hablas a la IA como a un entrenador: te responde al instante, puedes interrumpirla, anota tus series y maneja la sesión.

## Qué hay en esta carpeta

- `index.html`: la página (lo que se ve).
- `estilos.css`: los colores y el diseño.
- `programa.js`: **tu programa** (quién eres, tu equipo, tus ejercicios y tu semana).
- `figuras.js`: las figuras que muestran cada ejercicio.
- `motor.js`: lo que hace funcionar todo (sesiones, registro, entrenador, voz, cámara, GitHub).
- `fuente.woff2`: la letra de la app.
- `sw.js`: hace que funcione sin internet y que se actualice sola.
- `manifest.webmanifest` y los 3 íconos: para instalarla como app.
- `LEEME.md`: esta guía.

## 1. Subirla o actualizarla en GitHub Pages

**Si ya la tienes (para pasar a la 6.0):** en tu repositorio de la app toca "Add file" → "Upload files", arrastra **todos los archivos del zip** (son 12: la app ahora va en varios archivos) y toca "Commit changes". La próxima vez que abras la app con internet se actualiza sola en todos tus equipos, nunca en medio de una sesión. Tus datos no se borran.

**En las siguientes versiones** basta subir los archivos que cambien (la guía de cada versión te dice cuáles); si dudas, súbelos todos: no pasa nada.

**Si es la primera vez:**

1. En GitHub crea un repositorio público, por ejemplo `entreno`.
2. "Add file" → "Upload files" → arrastra los 12 archivos juntos → "Commit changes".
3. "Settings" → "Pages" → en "Branch" elige `main` y la carpeta `/ (root)` → "Save".
4. Espera 1 o 2 minutos y abre `https://TUUSUARIO.github.io/entreno/`.

La cámara, la voz y el modo sin internet solo funcionan desde esa dirección (https).

## 2. Instalarla en el celular

Abre la dirección en Chrome y toca "Instalar app" arriba (o ⋮ → "Instalar app"). Queda con su ícono, como una app normal.

## 3. Tus datos en todos tus equipos (GitHub)

Lo que haces en un equipo aparece en los otros, sin pasar archivos. Se guarda unos segundos después de cada cambio y al cerrar cada sesión. Sin internet, espera y lo sube cuando vuelve la conexión.

**Cómo funciona ahora:** conectas **un** equipo con la clave de GitHub (ya lo hiciste), creas una **contraseña de tus equipos** y subes un archivo, una vez. Desde ahí, cada equipo nuevo solo pide esa contraseña.

### Paso A. Crear la contraseña (una vez, en un equipo que ya guarda en GitHub)

1. Abajo, en "Tus datos en todos tus equipos (GitHub)" → "Contraseña de tus equipos".
2. Escribe 3 o 4 palabras que recuerdes y que no tengan que ver contigo (como `sapo-montaña-guitarra-azul`, pero no uses esa: inventa las tuyas), repítela y toca **Crear contraseña**. Anótala donde no la pierdas: no se guarda en ningún lado.
3. Toca **Descargar equipos.json**.
4. En github.com abre el repositorio **de la app** (el que tiene `index.html`, no el de tus datos) → **Add file** → **Upload files** → arrastra `equipos.json` → **Commit changes**.
   Desde el celular: **Copiar equipos.json** → en GitHub **Add file** → **Create new file** → nombre `equipos.json` → pega → **Commit changes**.

GitHub tarda 1 o 2 minutos en publicarlo. Cuando la app lo ve, te dice "equipos.json ya está en tu app".

### Paso B. Cada equipo nuevo

Abre la dirección de la app. Aparece "Une este equipo a tus datos": escribe la contraseña y toca **Unir**. En unos segundos tiene tus sesiones, tu progreso, tus ajustes y tu clave de Google.

**Sin subir el archivo:** "Copiar enlace para unir", mándatelo (por ejemplo por WhatsApp), ábrelo en el equipo nuevo y escribe la contraseña.

### Los equipos que ya conectaste

Siguen guardando igual. Te conviene escribir la contraseña una vez en cada uno (aparece en ese mismo lugar): así reciben los cambios de tu clave de Google y se arreglan solos cuando cambies la clave de GitHub.

### Es seguro

- `equipos.json` queda público, pero va cifrado (AES de 256 bits, con una llave que sale de tu contraseña después de 600 000 vueltas). Sin la contraseña no sirve.
- La clave de Google viaja cifrada igual dentro de tus datos.
- La contraseña nunca se guarda ni se sube. Cada equipo unido guarda solo la llave que sale de ella.
- Por eso importa que sea larga: 3 o 4 palabras al azar es mucho más difícil de adivinar que una palabra con números.

### Si algo cambia

- **La clave de GitHub vence o la cambias:** pega la nueva en un equipo ("Cambiar la clave de GitHub o desconectar este equipo"), toca **Descargar equipos.json** y súbelo otra vez. Los demás equipos la toman solos.
- **Cambias la contraseña:** "Cambiar la contraseña" y sube el `equipos.json` nuevo. Tus otros equipos siguen guardando y te piden la nueva una vez.
- **Olvidaste la contraseña:** en cualquier equipo que ya guarda, crea una nueva con "Cambiar la contraseña".
- **Pierdes un equipo:** borra la clave en GitHub (Settings → Developer settings → Fine-grained tokens), crea otra, pégala en un equipo, **cambia la contraseña** y sube el `equipos.json` nuevo. Si quieres, cambia también la clave de Google.

### Primer equipo (solo si empiezas de cero)

1. En github.com toca **+** → **New repository**. Nombre: `entreno-datos`. Marca **Private** y **Add a README file**. Toca **Create repository**. Es un repositorio aparte del de la app y debe ser privado: son tus datos de salud. Si es público, la app no lo usa.
2. Crea la clave: tu foto (arriba a la derecha) → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Nombre: `Entreno`. Vencimiento: el que quieras (por ejemplo, 1 año). En **Repository access** elige «Only select repositories» y marca `entreno-datos`.
4. En **Permissions** → Repository permissions → **Contents**: «Read and write». Nada más. Toca **Generate token** y copia la clave (empieza con `github_pat_`).
5. En la app: abajo, "Tus datos en todos tus equipos (GitHub)" → pega la clave → **Probar y guardar**. Después, el paso A.

### Cómo se juntan los datos

Cada registro tiene su hora. Si dos equipos cambiaron cosas distintas, quedan las dos. Si cambiaron lo mismo, gana lo más nuevo, parte por parte: el peldaño de cada ejercicio, cada semana de descarga y cada nota por separado. Nada se pisa entero.

**Lo que viaja:** sesiones, chequeos, semanas, pruebas, peldaños, fase, descargas, notas, la charla con la IA, tus discos, cómo registras, el tempo, la voz y su velocidad, la cámara, los ajustes de la conversación y la clave de Google (cifrada).
**Lo que queda en cada equipo:** la clave de GitHub, el volumen y la IA elegida (Ollama, por ejemplo, solo está en la laptop).

**Dónde queda:** en `entreno-datos/datos/`, un archivo por mes (`2026-10.json`), uno por año para las semanas y `estado.json` para lo demás. Cada guardado aparece en GitHub con el nombre del equipo. "Exportar mi historial" sigue disponible como respaldo extra.

## 4. Tu entrenador a largo plazo

Toca **Progreso** (arriba) o "Ver tu progreso" en la tarjeta "Tu entrenador" de cada día. Decide con las reglas del 3.0, nada inventado.

**Cómo decide cada ejercicio:**

| Ve esto | Te propone |
|---|---|
| Tope del rango en todas las series, dos sesiones seguidas | **Subir** un peldaño |
| Llegaste al tope pero con RIR 0-1 en un ejercicio de rodilla (pide 2-3) | **Repetir** el peldaño con 2-3 en reserva |
| La cámara midió la bajada mucho más rápida que el tempo | **Repetir**, bajando lento |
| La cámara avisó 3 o más veces el mismo error en una serie | **Repetir** con técnica limpia |
| Bajaste más hondo que tu altura segura | **Repetir** cuidando la profundidad |
| Te quedaban 3 o más en la última serie (cuando pide 0-1) | **Apretar más** la última serie |
| Dos sesiones bajo el rango | **Bajar** un peldaño |
| La rodilla avisó en la sesión o amaneció peor | **Bajar** (regla de 24 horas) |
| 6 sesiones y 4 semanas sin mejorar | **Estancado**, con qué mover primero: comida, descarga o la tercera ronda de brazos |

Las semanas de descarga y las sesiones modificadas por el filtro no cuentan para subir. Las series sin confirmar tampoco.

**Subidas solas:** los ejercicios que no cargan la rodilla y ya cumplieron la regla suben solos al cerrar la sesión, y la tarjeta del día te muestra "Subí solo… Deshacer". Los de rodilla siempre te preguntan. Se apaga en "Entrenador a largo plazo" (en Ajustes).

**Bloques y descargas:** ves en qué semana del bloque vas (descarga cada 6-8 semanas). Te propone descargar si:
- se juntan 2 señales de fatiga en la semana (la app detecta sola el pulso en reposo 5 lpm sobre tu promedio y la fuerza que cae dos sesiones seguidas en un ejercicio clave; el sueño y el hambre los marcas tú el domingo),
- llegas a la semana 8, o
- en la semana 6-7 hay señales o varios ejercicios estancados.

Con "Esta semana" o "La próxima" tengo exámenes, esa semana queda como descarga, como pide el 3.0.

**Rodilla:** si amanece peor dos semanas seguidas, te propone con un toque "Una semana sin pierna": ese miércoles y ese sábado van con el plan sin pierna.

**Cuerpo:** el ritmo de peso se calcula con varias semanas, no con dos pesadas sueltas. Meta: +0.3 a +0.6 kg al mes. Si sube menos, te dice que sumes 200-300 kcal. Si la cintura sube más de 1 cm en un mes sin que suba el brazo, que quites 200. El techo de cintura es 88 cm. Si el brazo no cambia en 8-12 semanas, te propone la tercera ronda del circuito D del lunes (el lunes dura unos 5 minutos más; se quita en Ajustes).

**También ves:** tu semana (sesiones, series, rodilla, señales), tus 10 ejercicios clave con su línea de progreso, logros (récords, peldaños, constancia, pruebas de 3 meses) y "Lo que viene" (descarga, pruebas, fotos, puerta de la fase 2, qué está por subir).

**Revisión con IA:** si tienes una IA configurada, una vez por semana te da una segunda opinión con tus números al abrir Progreso (o cuando toques el botón). Lo que propone pasa por las reglas del 3.0 antes de mostrarse: por ejemplo, no te deja subir un ejercicio de rodilla que no cumplió la regla.

## 5. La pantalla de la sesión

- Arriba, en una franja delgada: Salir, el reloj (con «a tiempo», «+1:20» si vas atrasado o «−0:40» si vas adelantado, y a qué hora terminas), Dudas y el engranaje de Ajustes. Debajo, cinco botones que se prenden y apagan: **Voz**, **Tempo**, **Continua**, **Cámara** y **Asistente**.
- **Todo cabe sin bajar la pantalla**, en vertical y en horizontal. En horizontal la figura va a la izquierda.
- **Al empezar:** «Prepara tu equipo». El reloj no corre hasta que tocas **Empezar** (o dices «listo»). Se apaga en Ajustes si no la quieres.
- **En cada serie** ves grande lo que importa: el ejercicio, la serie, las repeticiones, las mancuernas y, a la derecha, la figura que hace el movimiento con tu tempo. Lo demás está en «Detalles», donde también ves qué te falta para subir.
- **En el descanso:** el reloj grande y, al lado, la figura del ejercicio que sigue; «Ahora, mientras descansas» (discos exactos, liga, qué mancuerna tomar); «Sigue» (serie, repeticiones, carga y en qué postura empieza); «Deja listo para después» solo si hace falta; y el cuadro para anotar reps y RIR. Abajo: **Empezar** (no esperar el resto del descanso) y «+15 s». Anotar el RIR ayuda mucho al entrenador.
- **En un cambio** (dos ejercicios seguidos sin descanso): una cuenta corta con lo que tienes que hacer y lo que sigue. **Listo** lo salta.
- **Ajustes en plena sesión:** el engranaje abre una hoja con la sesión continua, el tempo, la voz, la figura y el giro de la pantalla. El reloj espera hasta que tocas **Listo**.

## 6. Sonidos y voz

Cada estímulo tiene su sonido y ningún otro aviso lo imita:

| Sonido | Qué significa | Color en la figura |
|---|---|---|
| «Tuiii», tono que **sube** | **Fuerza**: subes, empujas, tiras o levantas | Rojo |
| «Tiuuu», tono que **cae** | **Regreso**: bajas o regresas el peso | Azul |
| «Tu-tu-tu», tono **parejo** que late | **Mantener**: quieto, aguantas o resistes (también al empezar una plancha) | Morado |
| «Toc» corto | Empieza otra repetición | – |
| Campana | Llegaste al tope del rango | – |
| «Pip» | Cuenta 3-2-1 | – |
| «Piiip» largo | ¡Vamos! | – |
| «Tin-tin» | Cambia de lado | – |
| Gong | Fin del tiempo | – |

Con «Sonido del tempo: Largo» (en Ajustes) el tono dura lo mismo que la fase: te mueves al ritmo del sonido. Con «Corto», es un toque al empezar cada fase y un tic por segundo en las fases largas.

En «Ajustes» eliges también el volumen (Normal, Alto o Máximo), la velocidad de la voz y «Probar sonido» (o tecla S). Las respuestas de la IA se leen frase por frase apenas llegan.

**Los avisos ya no se repiten:** al empezar el descanso te dice cuánto dura, qué hacer ahora (discos, liga, mancuerna), lo que conviene dejar listo y qué sigue con su postura; a los 10 s solo «Diez segundos. En posición, en el piso» (o de pie, sentado…); en un cambio, qué hacer en esos segundos; y al empezar la serie, la dosis sin repetir el nombre. Con la sesión continua, la cuenta 3-2-1 del final del descanso ya es la salida: la serie arranca sin otra cuenta.

## 7. El asistente de voz (manos libres)

Toca **Asistente** en la sesión (o tecla M o H en la laptop). Es uno solo:

- **Con tu clave gratis de Google e internet:** Gemini Live. Le hablas como a un entrenador y te responde; además, los comandos de abajo se hacen **al instante** con lo que Gemini transcribe de tu voz (no espera a que la IA decida). Si la IA igual intenta hacer lo mismo, la app no lo repite.
- **Sin clave o sin internet:** el reconocimiento de voz del celular entiende los comandos de abajo y responde dudas con tu ficha (o con tu IA local).
- Si Gemini se corta o se acaba la cuota gratis, el asistente sigue solo con los comandos del celular.

**Para que no se oiga a sí misma ni al entorno:** mientras la app anuncia algo no escucha nada; mientras Gemini habla, aprende cuánto se oye su propia voz por el parlante y solo una voz tuya más fuerte y seguida la interrumpe. En «Asistente de voz» (Ajustes) eliges el micrófono: **Normal**, **Hay ruido o tele** (pide voz más clara) o **Estoy lejos del celular** (más sensible). Si aun así se interrumpe sola, activa «Parlante fuerte» en «Asistente con IA».

| Dices | Pasa esto |
|---|---|
| "Listo", "hecho", "siguiente" (también «ok listo», «listo ya está», «eh siguiente por favor») | Lo mismo que el botón azul |
| "Pausa" / "sigue" | Detiene y reanuda el tiempo |
| "Anterior" | Vuelve un paso |
| "Más tiempo" | +15 s al descanso |
| "Hice ocho" | Anota 8 repeticiones ("hice ocho y me quedaban dos" anota también el RIR) |
| "Me quedaban dos", "me quedaron dos", "llegué al fallo" | Anota el RIR de la serie que terminaste (en los dos lados si es por lado) |
| Un número suelto en el descanso ("ocho") | Corrige las repeticiones de la serie que terminaste |
| "¿Qué preparo?" | Te dice qué discos, liga o mancuerna dejar lista ahora y lo que viene |
| "Repite" / "silencio" | Repite el aviso o calla la voz |
| "¿Qué sigue?", "¿cuánto falta?", "¿cuánto peso?" | Te responde con voz |
| "Me duele la rodilla" | Te pregunta si corta ese ejercicio |
| "Conversemos" | Abre la conversación por voz con la IA |
| "Recuerda que…" | Guarda una nota para la IA, en todos tus equipos |
| Cualquier pregunta | Responde con tu ficha o con tu IA |

**Gesto con la cámara:** las dos manos sobre la cabeza 1 segundo = "Hecho".

El reconocimiento de voz de Chrome en el celular normalmente usa internet; el gesto funciona sin internet.

## 8. La cámara

1. Con internet: "Ajustes" → "Preparar la cámara para usarla sin internet" (unos 17 MB, una vez).
2. En la sesión toca "Cámara" y dale "Permitir".

De lado: a la altura de tu cadera, a 2 o 3 metros. De frente: a la altura del pecho. En el piso: celular bajo, a unos 2 metros. Buena luz, sin ventana detrás de ti.

Además de contar y corregir, ahora guarda cuánto tardaste en bajar, si te frenaste al final de la serie y los avisos de técnica. El entrenador lo usa para decidir si subes (por ejemplo, no sube si bajaste mucho más rápido que el tempo).

**Límite de rodilla (goblet, split squat, step-down):** "Marcar mi profundidad segura" y una repetición hasta tu caja. Desde ahí te avisa si bajas más.

## 9. Dudas sin internet

El botón "Dudas" responde con tu ficha, sin internet: cómo se hace, errores, qué peso, cómo respirar, más fácil o más difícil, dónde poner el celular, qué sigue, qué discos pongo, en qué fase estoy. Nuevo: "¿cómo voy?" te resume el bloque, las señales, el peso y lo que está por subir o estancado. "Recuerda que…" guarda una nota.

## 10. Conversar por voz en tiempo real

En la sesión es el botón **Asistente** (arriba). Fuera de la sesión, «Conversar por voz» en Dudas o en la tarjeta del día. Termina con el mismo botón o diciendo «terminamos».

**Con tu clave gratis de Google (celular y laptop, con internet): Gemini Live.**
- Hablas y responde al instante con voz natural. Si hablas mientras responde, se calla y te escucha.
- En la sesión: "hice diez, me quedaban dos" anota la serie; "pasa", "pausa", "dame más tiempo" manejan la sesión; "me duele la rodilla" te pregunta y corta el ejercicio si confirmas; "¿cómo voy con el press?" te responde con tus números; "recuerda que…" guarda una nota.
- Conoce tu plan, tu fase, tus reglas de rodilla, tus mancuernas, tu progreso y lo último que hablaron.
- Opcional: que vea la cámara mientras le hablas ("Ajustes" → "Asistente con IA").
- La clave se saca en aistudio.google.com → "Get API key" y se pega en "Ajustes" → "Asistente con IA". La app elige sola el modelo de conversación.
- Manda audio solo cuando hablas (ahorra datos) y nunca mientras la app está anunciando un paso.
- El plan gratis tiene límites por minuto y por día, y no todos los modelos de conversación están siempre en el plan gratis. Si el modelo más nuevo no tiene cuota, la app **prueba sola el siguiente** que tu clave tenga disponible; si no queda ninguno, sigue con los comandos del celular. El audio (y la cámara, si lo permites) va a Google, y en el plan gratis Google puede usarlo para mejorar sus productos.
- **Tu Gemini Pro de estudiante** sube tus límites en la app de Gemini y en AI Studio. Esta app, en cambio, usa tu clave de API, que va por el plan gratis de la API, y no hay información pública de que la suscripción amplíe esa cuota. Igual no pagas nada: la clave sigue siendo gratis.

**Sin clave o sin internet: conversación local.** Escucha continuo y responde con tu IA (Ollama en la laptop, IA de Chrome u otra) o con las respuestas sin internet. Lee cada frase apenas está lista y se calla si hablas.

**Si la IA se interrumpe sola** porque se escucha a sí misma por el parlante: usa audífonos o activa "Parlante fuerte" en "Asistente con IA" (entonces no te escucha mientras habla).

## 11. IA para Dudas y revisión (opcional y gratis)

En "Ajustes" → "Asistente con IA" eliges una. Con IA responde preguntas libres, recuerda lo último que hablaron (también en tus otros equipos), conoce tu sesión y tu progreso a largo plazo, y hace la revisión semanal.

| Opción | Dónde funciona | Internet |
|---|---|---|
| Ollama (laptop) | Laptop; desde el celular con la misma wifi | No |
| Gemini gratis | Celular y laptop | Sí |
| IA de Chrome | Solo laptop con Chrome 148 o más nuevo | No (después de descargarla) |
| Otro servidor | LM Studio, llama.cpp, Jan… | Depende |

**Ollama:**
1. Instala Ollama desde ollama.com.
2. En la terminal: `ollama pull gemma3:4b` (unos 3.3 GB; lee texto e imágenes).
3. En Windows: "Editar las variables de entorno" → "Variables de usuario" → "Nueva": `OLLAMA_ORIGINS` con valor `https://TUUSUARIO.github.io`. Solo para usarla desde el celular, agrega `OLLAMA_HOST` con valor `0.0.0.0` (solo con el wifi de tu casa).
4. Cierra Ollama (ícono junto al reloj → Quit) y ábrelo otra vez.
5. En la app elige "Ollama (laptop)". Dirección: en la laptop `http://localhost:11434`; desde el celular, la IP de la laptop (por ejemplo `http://192.168.1.20:11434`) y acepta el permiso de "red local".
6. Toca "Probar conexión".

**Gemini gratis:** clave en aistudio.google.com → "Get API key". Elige "Gemini gratis", pega la clave y toca "Probar conexión": la app elige el modelo de texto y el de conversación que estén disponibles. Si creaste la contraseña de tus equipos, la clave llega cifrada a tus otros equipos; si no, queda solo en ese.

**IA de Chrome:** sin internet ni cuenta, solo en laptop; pide unos 22 GB libres y una tarjeta de video de más de 4 GB, o 16 GB de RAM con 4 núcleos. En el celular no está.

## 12. Tu fase y las pruebas

En "Tu fase" ves las 3 fases y lo que pide cada puerta. Fase 1 · Proteger; puerta 1: visto bueno del profesional, dolor de 1/10 o menos por 4 semanas, step-down de 20 cm × 10 limpio y 30 s con ojos cerrados por pierna. Fase 2 · Recuperar: el sábado suma 10 saltos pequeños (21 min), en el martes se abre el 4×4 trotando y se desbloquean los peldaños "Fase 2". Fase 3 · Agilidad: sigue tu evaluación.

En el seguimiento del domingo: peso, cintura, pulso, brazo y pecho (mensual), señales de fatiga, pruebas cada 3 meses y fotos del mes.

## 13. Tus mancuernas en la app

Tus discos: 4 de 2.5 kg, 4 de 1.25 kg y 4 de 0.5 kg (17 kg). Con las 2 barras, el juego pesa 20 kg. La barra conectora no se usa.

| Nombre en la app | Qué es |
|---|---|
| Las 2 principales · 7.5 kg c/u | El par armable, con 2.5 + 1.25 por lado. Con la barra, 9 kg cada una. |
| 1 principal · 15 kg | 2.5 + 2.5 + 1.25 + 1.25 por lado (16.5 kg con la barra). La otra queda vacía. |
| 2 principales · 8.5 kg c/u | Tu primer paso para subir: 2.5 + 1.25 + 0.5 por lado. |
| 2 principales · 5 kg c/u | Solo los discos de 2.5. |
| 2 principales · 2.5 kg c/u | Solo los discos de 1.25. |
| 2 principales sin discos | Solo las barras, 1.5 kg cada una. |
| La antigua (5 kg) | Tu mancuerna vieja de una pieza. |
| 2 vinilos (1 kg c/u) | Las de vinilo. |

Los kilos que se ven son de discos; la barra (1.5 kg) se suma aparte. Si compras discos, agrégalos en "Ajustes" → "Mis mancuernas".

## 14. Para seguir mejorándola en otro chat

**Lo más eficiente:** conecta GitHub a Claude una vez (en claude.ai: Ajustes → Conectores → GitHub, y dale acceso al repositorio de la app). Desde ahí, en cada chat nuevo solo escribes: «Sigamos con la app de entreno (repositorio TUUSUARIO/entreno). Quiero: …». La IA trae el repositorio, lee `CONTEXTO.md`, cambia solo lo necesario, corre las pruebas con un navegador de verdad y lo publica; la app se actualiza sola en tus equipos. Sin zips ni subir archivos a mano.

**Sin conectar GitHub:** en un chat nuevo adjunta solo `entreno-proyecto.zip` (ya trae la carpeta `app/`; el otro zip sobra) y escribe: «Lee CONTEXTO.md y sigamos con la app de entreno. Quiero: …».

**Para la app de otra persona (por ejemplo Milu):** en su proyecto adjunta `entreno-proyecto.zip` y escribe: «Lee COMO-REPLICAR.md y arma la app de Milu con su programa». La app se copia tal cual y solo se escribe su `programa.js` (y las figuras de los ejercicios que no existan). Sus datos quedan aparte de los tuyos aunque las dos apps estén en tu misma cuenta de GitHub.
