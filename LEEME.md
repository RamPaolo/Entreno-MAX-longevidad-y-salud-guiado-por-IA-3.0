# Sistema 3.0: entrenador en casa

Es tu misma guía de sesiones (semanas A/B, filtro de rodilla, escaleras de progresión, registro de series), ahora como app que se instala en el celular y la laptop, funciona sin internet y puede usar la cámara.

## Qué hay en esta carpeta

- `index.html`: la app completa.
- `sw.js`: hace que funcione sin internet.
- `manifest.webmanifest` y los 3 íconos: para instalarla como app.
- `LEEME.md`: esta guía.

## 1. Subirla a GitHub Pages (como el cancionero)

1. En GitHub crea un repositorio público, por ejemplo `entreno`.
2. "Add file" → "Upload files" → arrastra los 7 archivos juntos → "Commit changes".
3. "Settings" → "Pages" → en "Branch" elige `main` y la carpeta `/ (root)` → "Save".
4. Espera 1 o 2 minutos y abre `https://TUUSUARIO.github.io/entreno/`.

La cámara solo funciona desde esa dirección (https). Si abres el archivo directo desde tu computadora, la app sirve pero sin cámara ni modo sin internet.

## 2. Instalarla en el celular

Abre la dirección en Chrome y toca "Instalar app" arriba (o ⋮ → "Instalar app" / "Agregar a la pantalla principal"). Queda con su ícono, como una app normal.

## 3. Pasar tu historial de la guía anterior

La app nueva vive en otra dirección, así que empieza vacía.

1. En la guía anterior (la de Claude): abajo, "Datos y respaldo" → "Exportar mi historial". Copia todo el texto que aparece.
2. En la app nueva: "Datos y respaldo" → pega el texto en el cuadro → "Importar lo pegado".

Cada equipo guarda sus propios datos. Para pasarlos entre celular y laptop usa "Compartir respaldo" (por WhatsApp o Drive) y luego "Importar desde archivo".

## 4. La cámara, la primera vez

1. Con internet: "Ajustes" → "Preparar la cámara para usarla sin internet". Descarga unos 17 MB una sola vez.
2. En la sesión toca "Cámara" y dale "Permitir".
3. Activa "Voz" y sube el volumen: la app te habla desde lejos.

Cómo poner el celular (cada ejercicio te lo dice en la pantalla):

- **De lado:** a la altura de tu cadera, a 2 o 3 metros, que entres entero.
- **De frente:** a la altura del pecho, que se vean tus manos y tus pies.
- **En el piso:** celular bajo (20 a 40 cm del suelo), de lado, a unos 2 metros.
- **En ejercicios a un brazo:** que el brazo que trabaja quede del lado del celular.
- **Luz:** buena luz y sin contraluz de ventana detrás de ti.

Antes de cada serie quédate quieto un segundo en la posición inicial. Cuando suena el pitido y dice "Listo: empieza", ya está contando.

## 5. Límite de rodilla (goblet, split squat, step-down)

Toca "Marcar mi profundidad segura" y haz una repetición hasta tu caja o tu cojín. Desde ahí te avisa si bajas más. Usa siempre el mismo lugar para el celular, porque si cambias el ángulo, cambia la medida.

## 6. Qué hace la cámara y qué no

Hace esto:
- Cuenta las repeticiones y las anota solas.
- Mide cuánto tardas en bajar y en subir, y te avisa si vas más rápido que el tempo.
- Avisa errores claros: cadera hundida, codos que se mueven, rodilla hacia adentro, torso que se balancea.
- Avisa cuando baja la velocidad en las series de potencia del viernes.
- Cierra la serie sola si paras unos segundos. Te da 3 segundos para seguir: muévete o toca "Sigo".

No hace esto:
- No ve la curva de tu espalda.
- No sigue el bicho muerto, las caminatas con peso ni el trote.
- En pantorrillas cuenta de forma aproximada.

Si se equivoca, corrige el número con − y + antes de la siguiente serie.

## 7. Tus mancuernas en la app

| Nombre en la app | Qué es |
|---|---|
| Las 2 principales · 7.5 kg c/u | El par armable, con 2.5 + 1.25 por lado. Con la barra, 9 kg cada una. |
| 1 principal con todos los discos | 2.5 + 2.5 + 1.25 + 1.25 por lado, 15 kg de discos (16.5 kg con la barra). La otra queda vacía. |
| 2 principales · 5 kg c/u | Solo los discos de 2.5. |
| 2 principales · 2.5 kg c/u | Solo los discos de 1.25. |
| La antigua (5 kg) | Tu mancuerna vieja de una pieza. |
| 2 vinilos (1 kg c/u) | Las de vinilo. |

Los kilos que se ven son de discos, y la app suma la barra (1.5 kg) aparte. Si compras discos, agrégalos en "Ajustes" → "Mis mancuernas": la app recalcula qué puedes armar y te avisa cuándo te faltan discos para subir de peldaño.

## 8. IA en tu laptop (opcional, gratis)

Sin esto, las dudas se responden con tu ficha, sin internet, y la cámara funciona igual. Con esto, además, contesta preguntas libres y puede mirar una foto tuya.

1. Instala Ollama desde ollama.com.
2. En la terminal, corre `ollama pull gemma3:4b`. Son unos 3.3 GB y lee texto e imágenes.
3. Para que la app pueda hablarle, en Windows busca "Editar las variables de entorno" → "Variables de usuario" → "Nueva":
   - Nombre `OLLAMA_ORIGINS`, valor `https://TUUSUARIO.github.io`.
   - Solo si la vas a usar desde el celular, agrega también: nombre `OLLAMA_HOST`, valor `0.0.0.0`. Hazlo solo con el wifi de tu casa.
4. Cierra Ollama (ícono junto al reloj → Quit) y ábrelo otra vez.
5. En la app: "Ajustes" → "Asistente con IA" → activa "Usar la IA".
   - Desde la laptop, la dirección es `http://localhost:11434/v1`.
   - Desde el celular, usa la IP de tu laptop, por ejemplo `http://192.168.1.20:11434/v1`. Chrome te pedirá permiso para "dispositivos de tu red local": acéptalo.
6. Toca "Probar conexión".

Si desde el celular no conecta, úsala desde la laptop: es lo más simple.

## 9. Actualizar la app

Sube el `index.html` nuevo al mismo repositorio. La app se actualiza sola la próxima vez que la abras con internet.

## 10. Para seguir mejorándola en otro chat

Sube `index.html` y este LEEME y di qué quieres cambiar. Dónde está cada cosa dentro de `index.html`:

- `EX`: la ficha de cada ejercicio.
- `DAYS`: las sesiones.
- `CAMX`: qué mide la cámara en cada ejercicio.
- `CHK`: los avisos de técnica.
- `EQ_DEF`: tus discos de fábrica.
