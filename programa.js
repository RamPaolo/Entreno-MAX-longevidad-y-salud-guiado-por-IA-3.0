/* PROGRAMA DE ENTRENAMIENTO: todo lo personal de la app.
   El motor (motor.js) y las figuras (figuras.js) sirven para cualquier persona; lo que cambia
   de una persona a otra está en este archivo: quién es, su equipo, sus ejercicios y su semana.
   Para la app de otra persona (por ejemplo Milu) se copia la app y se reescribe SOLO este archivo
   (y, si trae ejercicios nuevos, sus figuras en figuras.js). Ver COMO-REPLICAR.md. */

/* ===================== 1. Quién usa esta app ===================== */
const PERFIL = {
  nombre: "Ram",                      // cómo lo llaman la voz y la IA
  app: "Sistema 3.0",                 // nombre de la app (arriba y en la pestaña)
  lema: "Entrenador en casa",
  prog: "3.0",                        // cómo se nombra el programa en los textos («las reglas del 3.0»)
  resumen: "entrena en casa con un plan de fuerza, hipertrofia, rodilla y aeróbico",   // para la IA
  guardado: "s3v2",                   // prefijo de sus datos en el navegador. NUNCA cambiarlo en una app que ya tiene datos.
  cache: "s3",                        // prefijo de las copias sin internet: igual que en sw.js
  repoDatos: "entreno-datos",         // repositorio PRIVADO de GitHub donde se guardan sus datos
  rodilla: true,                      // filtro y chequeos de rodilla, «Rodilla ahora» al terminar (false si no hay lesión que cuidar)
  fases: true,                        // fases 1-3 con sus puertas (false si no aplica)
  claves: ["remo1m", "arquero", "pressinc", "splitsq", "rdl1p", "arnold", "deficit", "rdl2p", "goblet", "pressmil"],   // ejercicios clave en «Tu progreso»
  brazos: { curlbay: 1, triover: 1, martillo: 1, frances: 1 },   // para la regla de brazos estancados
  cuerpo: { cinturaMax: 88, kgMes: [0.3, 0.6] }                  // techo de cintura (cm) y meta de peso al mes (kg)
};

/* ===================== 2. Su equipo ===================== */
/* Discos de fábrica de sus mancuernas armables (él puede cambiarlos en Ajustes → Mis mancuernas).
   bar = lo que pesa cada barra con sus collares; antigua y vinilo = sus otras mancuernas; guard = kilos de discos con que se guardan. */
const EQUIPO = { discs: [{ kg: 2.5, n: 4 }, { kg: 1.25, n: 4 }, { kg: 0.5, n: 4 }], bar: 1.5, antigua: 5, vinilo: 1, guard: 7.5 };
/* Qué pide cada ejercicio además de las mancuernas (it = objetos; liga = dónde va anclada; moch = mochila) */
const EQUIPO_EXTRA = {
  facepull: { liga: "cara" }, remoexp: { liga: "pecho" }, jalon: { liga: "arriba" }, curlbay: { liga: "suelta" }, extrod: { liga: "silla", it: ["silla"] },
  remo1m: { it: ["silla"] }, triover: { it: ["silla con respaldo"] }, arnold: { it: ["silla con respaldo"] }, copen: { it: ["silla", "toalla"] }, flexexp: { it: ["silla contra la pared"] },
  pressinc: { it: ["mochila firme"] }, pullover: { it: ["mochila firme"] }, latinc: { it: ["marco de la puerta"] }, splitsq: { it: ["cojín a tu altura"] },
  curlfem: { it: ["toalla en el piso liso"] }, stepdown: { it: ["escalón junto a la pared"] }, talonpie: { it: ["escalón junto a la pared"] }, hipthrust: { it: ["sofá o cama firme", "toalla"] },
  deficit: { it: ["2 pilas de libros"] }, goblet: { it: ["tu caja"], moch: 1 }, farmer: { moch: 1 }, rdl1p: { it: ["pared cerca"] }
};
const LIGA_DONDE = { cara: "anclada en la puerta, a la altura de tu cara", pecho: "anclada a la altura del pecho", arriba: "anclada arriba de la puerta", suelta: "suelta, para pisarla", silla: "atada a la pata trasera de la silla" };
const LIGA_HACER = { cara: "Ancla la liga en la puerta, a la altura de tu cara", pecho: "Ancla la liga a la altura del pecho", arriba: "Ancla la liga arriba de la puerta", suelta: "Ten una liga suelta para pisarla", silla: "Ata la liga a la pata trasera de la silla" };
const LIGAS = { donde: LIGA_DONDE, hacer: LIGA_HACER };

/* ===================== 3. Ejercicios, días y reglas ===================== */
/* Biblioteca de ejercicios: una sola definición por ejercicio.
   knee: 0 = rodilla libre, 1 = carga baja, 2 = carga controlada (la afecta el filtro).
   start: "top" = la repetición empieza con la bajada; "bottom" = empieza subiendo o tirando.
   ph: nombres de las 4 fases del tempo (bajada, pausa abajo, subida, pausa arriba).
   ladder: peldaños de progresión; "o" cambia la prescripción en ese peldaño. */
const PH = {
  squat: ["Baja", "Quieto", "Sube", "Arriba"],
  push: ["Baja", "Quieto", "Empuja", "Arriba"],
  pull: ["Regresa", "Estirado", "Tira", "Aprieta"],
  raise: ["Baja", "Abajo", "Sube", "Arriba"],
  hinge: ["Baja", "Abajo", "Sube", "Arriba"]
};

const EX = {
  /* ---------------- Lunes ---------------- */
  remo1m: {
    name: "Remo a una mano en trípode", muscles: ["Dorsal", "Espalda media", "Bíceps"], knee: 0, start: "bottom", ph: "pull",
    why: "Fuerza de espalda alta y dorsal con la carga más alta que tienes. Lleva las escápulas atrás, justo lo contrario de tus hombros adelantados.",
    setup: "Pies en el piso en posición escalonada, con el pie del lado que trabaja atrás. Mano libre en el asiento de la silla, torso a ~45° con la espalda neutra y la mancuerna colgando bajo el hombro.",
    steps: ["Baja el hombro hacia la cadera antes de doblar el codo.", "Tira el codo hacia el bolsillo trasero, no hacia el techo.", "Arriba, 1 s apretando la escápula hacia la columna.", "Baja en 2 s hasta estirar el brazo y sentir el dorsal estirado."],
    breath: "Exhala al tirar; inhala al bajar.",
    cues: ["Cuello largo, mirada al piso", "El torso no gira para ayudar"],
    errors: ["Codo abierto hacia afuera: trabaja el bíceps, no la espalda", "Encoger el hombro hacia la oreja"],
    safety: "Si la zona lumbar molesta, carga más peso en la mano de apoyo y reduce la inclinación del torso.",
    alt: "Con barra de dominadas: dominadas 4 × 3-6, o negativas de 5 s (subes con un saltito y bajas en 5 s).",
    ladder: ["1 principal · 15 kg", "1 principal · 17 kg (sumando los de 0.5, si entran en la barra)", { t: "1 principal · 17 kg, 3 s de regreso", o: { tempo: "3-0-1-1" } }, { t: "Barra: negativas de 5 s", o: { side: false, reps: "3-5", tempo: "5-0-1-0" } }, { t: "Barra: dominadas asistidas con liga", o: { side: false, reps: "4-6", tempo: "2-0-1-1" } }, { t: "Barra: dominadas", o: { side: false, reps: "3-6" } }, { t: "Barra: dominadas con mochila", o: { side: false, reps: "3-6" } }]
  },
  arquero: {
    name: "Flexiones arquero", muscles: ["Pecho", "Tríceps", "Hombro anterior", "Core"], knee: 0, start: "top", ph: "push",
    why: "Empuje unilateral pesado sin banco: pecho, tríceps y hombro, con el core trabajando para que no gires.",
    setup: "Manos bastante más abiertas que los hombros, dedos un poco hacia afuera, cuerpo en plancha con glúteos y abdomen firmes.",
    steps: ["Baja en 2 s hacia una mano doblando ese codo; el otro brazo se estira hacia el lado.", "Llega con el pecho a unos 5 cm del piso.", "Empuja fuerte con la mano cargada y vuelve al centro."],
    breath: "Inhala al bajar; exhala al empujar.",
    cues: ["El brazo estirado solo apoya", "Codo que trabaja a ~45° del torso"],
    errors: ["Cadera que se hunde o se levanta", "Bajar a medias"],
    safety: "Si el hombro molesta, cierra un poco las manos o cambia a flexiones normales con 1 s de pausa abajo.",
    ladder: ["Arquero en el piso", "Arquero con los pies en la silla", { t: "Negativas a una mano de 5 s", o: { reps: "3-5", tempo: "5-0-1-0" } }, { t: "Flexión a una mano asistida", o: { reps: "4-6", tempo: "2-0-1-0" } }, { t: "Flexión a una mano", o: { reps: "3-5" } }]
  },
  pike: {
    name: "Flexiones pike", muscles: ["Hombro anterior", "Hombro lateral", "Tríceps"], knee: 0, start: "top", ph: "push",
    why: "Hombro y tríceps en el patrón de empujar por encima de la cabeza: el camino al pino contra la pared.",
    setup: "Cadera arriba en forma de V invertida, manos al ancho de los hombros, pies cerca de las manos para que el torso quede casi vertical.",
    steps: ["Baja la cabeza hacia el piso, por delante de las manos, formando un triángulo con ellas.", "Lleva los codos hacia atrás, no hacia los lados.", "Empuja hasta estirar los brazos sin perder la V."],
    breath: "Inhala al bajar; exhala al empujar.",
    cues: ["El peso va a los hombros, no a las piernas", "Control abajo: la cabeza nunca golpea"],
    errors: ["Cadera que baja y lo convierte en flexión normal", "Codos abiertos a 90°"],
    safety: "Si molesta el cuello, acorta el rango y no apoyes la cabeza.",
    ladder: ["Pike en el piso", "Pike con los pies en la silla", { t: "Pino contra la pared 20-30 s", o: { hold: 25, holdLabel: "20-30 s" } }, { t: "Negativas en pino", o: { hold: null, holdLabel: null, reps: "3-5", tempo: "5-0-1-0" } }, { t: "Flexión en pino con rango corto", o: { reps: "3-6", tempo: "2-0-1-0" } }]
  },
  facepull: {
    name: "Face pull con liga", muscles: ["Hombro posterior", "Manguito rotador", "Trapecio medio"], knee: 0, start: "bottom", ph: "pull",
    why: "Deltoide posterior, trapecio medio y rotadores externos: el antídoto directo contra los hombros hacia adelante.",
    setup: "De pie frente al ancla, a la altura de tu cara. Un paso atrás hasta que la liga tenga tensión, brazos estirados al frente.",
    steps: ["Tira hacia tu frente separando las manos.", "Codos altos, a la altura de los hombros.", "Al final gira los antebrazos hacia arriba y atrás, con los pulgares hacia atrás, y sostén 1 s.", "Regresa en 1 s sin perder la tensión."],
    breath: "Exhala al tirar.",
    cues: ["Costillas abajo, sin arquear la lumbar", "El movimiento sale de las escápulas"],
    errors: ["Tirar echando el cuerpo hacia atrás", "Dejar caer los codos"],
    ladder: ["Liga actual", "Un paso más atrás", "Liga más dura", { t: "Liga más dura, 2 s atrás", o: { tempo: "1-0-1-2" } }]
  },
  pressinc: {
    name: "Press inclinado sobre mochila", muscles: ["Pecho alto", "Hombro anterior", "Tríceps"], knee: 0, start: "top", ph: "push",
    why: "Pecho superior, la zona que más cambia la silueta del torso en tu estructura.",
    setup: "Sentado en el piso con la mochila firme detrás. Recuéstate con la parte alta de la espalda sobre ella (~30°), pies en el piso y una mancuerna en cada mano sobre el pecho alto.",
    steps: ["Baja en 2 s abriendo los codos a ~45° del torso hasta sentir el pecho estirado.", "Quédate 1 s quieto abajo.", "Empuja hacia arriba y un poco hacia adentro en 1 s."],
    breath: "Inhala al bajar; exhala al empujar.",
    cues: ["Escápulas juntas y hacia abajo toda la serie", "Muñecas rectas sobre los codos"],
    errors: ["Codos a 90° del torso: estresa el hombro", "Rebotar abajo"],
    safety: "Si el hombro pincha abajo, acorta el rango hasta donde no moleste.",
    ladder: ["2 principales · 7.5 kg c/u", "2 principales · 8.5 kg c/u", { t: "2 principales · 8.5 kg c/u, bajando en 3 s", o: { tempo: "3-1-1-0" } }, { t: "2 principales · 10 kg c/u", o: { tempo: "2-1-1-0" } }, "2 principales · 12.5 kg c/u"]
  },
  pullover: {
    name: "Pullover con una mancuerna", muscles: ["Dorsal", "Pecho", "Serrato"], knee: 0, start: "top", ph: "raise",
    why: "Dorsal y pecho en estiramiento, más extensión de la espalda alta, que abre la postura.",
    setup: "Misma posición sobre la mochila. Sujeta una mancuerna con ambas manos por el disco interno, sobre el pecho, con los codos apenas flexionados.",
    steps: ["Con los codos fijos, lleva la mancuerna hacia atrás por encima de la cabeza en 2 s.", "Sostén 1 s en el estiramiento, sin dolor en el hombro.", "Regresa en 2 s hasta sobre el pecho, tirando con el dorsal."],
    breath: "Inhala al bajar, con el tórax abriéndose; exhala al subir.",
    cues: ["Costillas abajo", "Los codos no se doblan ni se estiran durante la serie"],
    errors: ["Convertirlo en extensión de tríceps", "Bajar más de lo que el hombro tolera"],
    safety: "La mancuerna pasa sobre tu cara: collares bien apretados.",
    ladder: ["Con el peso del press (C1)", { t: "2 s quieto en el estiramiento", o: { tempo: "2-2-2-0" } }, { t: "Bajando en 3 s, 2 s quieto", o: { tempo: "3-2-2-0" } }]
  },
  latinc: {
    name: "Elevación lateral inclinada", muscles: ["Hombro lateral"], knee: 0, start: "bottom", ph: "raise",
    why: "Deltoide lateral: hombros anchos, el cambio estético más visible en tu estructura. Inclinado, el músculo trabaja también en la parte baja del recorrido.",
    setup: "De costado a un marco de puerta. Sujétalo con la mano cercana y deja que el cuerpo se incline ~15° hacia afuera; la mancuerna en la otra mano, delante del muslo.",
    steps: ["Sube el brazo hacia el costado con el codo apenas flexionado, guiando con el codo.", "Llega a la altura del hombro.", "Baja en 2 s sin dejar que la mancuerna descanse abajo."],
    breath: "Exhala al subir.",
    cues: ["Mano a la altura del codo o apenas debajo", "Hombro lejos de la oreja"],
    errors: ["Impulso con el cuerpo", "Encoger el trapecio"],
    ladder: ["La antigua (5 kg)", "La antigua (5 kg), con más inclinación", { t: "La antigua (5 kg), bajando en 3 s", o: { tempo: "3-0-1-0" } }, { t: "La antigua (5 kg), 1 s quieto arriba", o: { tempo: "3-0-1-1" } }]
  },
  curlbay: {
    name: "Curl bayesiano con liga", muscles: ["Bíceps"], knee: 0, start: "bottom", ph: "raise",
    why: "Bíceps cargado en estiramiento, con el codo detrás del cuerpo: la posición que más estimula su crecimiento.",
    setup: "Paso largo hacia adelante. Pisa la liga con el pie de atrás para que ya tenga tensión con el brazo estirado detrás del torso.",
    steps: ["Con el codo fijo detrás de la línea del cuerpo, flexiona llevando la mano hacia el hombro en 1 s.", "Baja en 2 s hasta estirar el brazo por completo.", "Sostén 1 s abajo, estirado."],
    breath: "Exhala al subir.",
    cues: ["El codo no avanza al subir", "Tronco quieto"],
    errors: ["Balancear el torso", "Cortar el rango abajo"],
    ladder: ["Liga actual", "Pisar más atrás", "Liga más dura", { t: "Liga más dura, 2 s quieto abajo", o: { tempo: "2-2-1-0" } }]
  },
  triover: {
    name: "Extensión de tríceps sobre la cabeza", muscles: ["Tríceps"], knee: 0, start: "top", ph: "raise",
    why: "Cabeza larga del tríceps en estiramiento: creció bastante más que con el brazo al costado en un estudio japonés. Además cuida la parte anterior del hombro.",
    setup: "Sentado en una silla con respaldo. Sujeta la mancuerna vertical por el disco superior con ambas manos, brazos estirados sobre la cabeza.",
    steps: ["Con los codos apuntando al techo, baja la mancuerna detrás de la cabeza en 3 s.", "Sostén 1 s abajo, con el tríceps estirado.", "Extiende los codos en 1 s."],
    breath: "Inhala al bajar; exhala al subir.",
    cues: ["Codos cerca de la cabeza", "Costillas abajo, sin arquear la lumbar"],
    errors: ["Abrir los codos", "Bajar rápido cerca de la cabeza"],
    safety: "Si el codo molesta, reduce el rango o la carga.",
    ladder: ["Con el peso del press (C1)", { t: "2 s quieto abajo", o: { tempo: "3-2-1-0" } }, { t: "Bajando en 4 s, 2 s quieto", o: { tempo: "4-2-1-0" } }]
  },
  planchaesc: {
    name: "Plancha con retracción escapular", muscles: ["Core", "Serrato", "Trapecio medio"], knee: 0, pacer: false,
    why: "Core que resiste la extensión y control de las escápulas: postura sostenida.",
    setup: "Plancha alta con brazos rectos, cuerpo en línea de hombros a talones. Rodillas en el aire, nunca apoyadas.",
    steps: ["Sin doblar los codos, junta las escápulas en 1 s; el pecho baja un poco.", "Sepáralas empujando el piso en 1 s.", "Repite lento durante todo el tiempo."],
    breath: "Respira continuo, sin aguantar.",
    cues: ["Glúteos apretados", "Costillas abajo"],
    errors: ["Cadera caída", "Doblar los codos"],
    ladder: ["40 s", { t: "60 s", o: { hold: 60 } }, { t: "60 s con los pies más juntos", o: { hold: 60 } }]
  },
  bichomuerto: {
    name: "Bicho muerto", muscles: ["Core profundo"], knee: 0, pacer: false,
    why: "Core profundo sin cargar la columna. Entrena exhalar con el abdomen activo, la misma habilidad que evita la apnea al hacer fuerza.",
    setup: "Boca arriba, brazos hacia el techo, caderas y rodillas a 90°.",
    steps: ["Exhala y pega la zona lumbar al piso.", "Extiende lento el brazo derecho hacia atrás y la pierna izquierda hacia adelante.", "Vuelve al centro y cambia de lado."],
    breath: "Exhala largo mientras extiendes.",
    cues: ["La lumbar no se despega", "2-3 s por extensión"],
    errors: ["Ir rápido", "Arquear la espalda"],
    ladder: ["8 por lado", "Pausa de 2 s extendido", "Liga en los pies"]
  },

  /* ---------------- Martes ---------------- */
  trote: {
    name: "Trote lento niko-niko", muscles: ["Corazón", "Mitocondrias", "Pantorrilla"], knee: 1, pacer: false,
    why: "Base aeróbica y mitocondrias con la menor carga posible para la rótula. “Niko niko” significa sonriente en japonés: es el ritmo en que podrías sonreír.",
    setup: "Tronco erguido, levemente inclinado hacia adelante desde los tobillos. Brazos relajados a 90°, mirada al frente.",
    steps: ["Pasos muy cortos: el pie aterriza casi debajo de la cadera.", "Una pisada por cada clic del metrónomo (170-180 por minuto).", "Pisada suave con la parte media o delantera del pie.", "Si te agitas, baja la velocidad; nunca alargues el paso."],
    breath: "Por la nariz si puedes; si no, nariz y boca suave. Debes poder conversar.",
    cues: ["Esfuerzo 4-5 de 10", "Si suenan tus pisadas, acorta el paso"],
    errors: ["Zancada larga con el talón muy adelante: frena y carga la rodilla", "Acelerar sin darte cuenta"],
    safety: "Dolor de rodilla de 2/10 como máximo. Las bajadas, caminando."
  },

  /* ---------------- Miércoles ---------------- */
  splitsq: {
    name: "Split squat (sentadilla dividida)", muscles: ["Cuádriceps", "Glúteo mayor", "Aductores", "Core"], knee: 2, start: "top", ph: "squat",
    why: "Tu ejercicio principal de pierna: cuádriceps y glúteo a una pierna, con carga real y la profundidad bajo control. Es el patrón que más se parece a subir, bajar y frenar en la vida diaria.",
    setup: "Paso largo: pie de adelante entero en el piso, pie de atrás apoyado en la punta. Detrás, un cojín sobre una pila de libros a la altura que fijaste el primer día. La principal de 15 kg, vertical y pegada al pecho.",
    steps: ["Baja en 3 s llevando la rodilla de atrás hacia el cojín, con el tronco apenas inclinado hacia adelante.", "Roza el cojín 1 s sin apoyar peso.", "Sube en 1 s empujando con todo el pie de adelante.", "El pie de adelante no se mueve durante la serie."],
    breath: "Inhala antes de bajar; exhala al subir.",
    cues: ["Rodilla de adelante sobre el segundo dedo del pie", "Peso en el medio del pie de adelante", "Pelvis nivelada"],
    errors: ["Rodilla que se va hacia adentro", "Empujar con la pierna de atrás", "Paso tan corto que el talón de adelante se levanta"],
    safety: "La altura del cojín es tu profundidad segura: la más baja sin “hueso desubicado” ni dolor mayor a 2/10. Se fija una vez y no se negocia cada día.",
    modNote: "Filtro modificado: cojín un puño más alto.",
    ladder: ["1 principal · 15 kg, al pecho", "1 principal · 15 kg, al pecho + mochila 5 kg", "1 principal · 15 kg, al pecho + mochila 10 kg", "Fase 2: cojín un dedo más bajo cada 3-4 semanas", "Pie de atrás sobre una silla (búlgara)"]
  },
  rdl1p: {
    name: "Peso muerto rumano a una pierna", muscles: ["Isquiotibiales", "Glúteo mayor", "Glúteo medio", "Equilibrio"], knee: 1, start: "top", ph: "hinge",
    why: "Isquiotibiales y glúteos con la carga duplicada por pierna, más equilibrio y control de cadera.",
    setup: "De pie sobre una pierna, rodilla levemente flexionada. La mancuerna en la mano contraria a la pierna de apoyo; un dedo en la pared si hace falta.",
    steps: ["Lleva la cadera atrás mientras el torso baja y la pierna libre se estira hacia atrás, en línea con la espalda.", "Baja en 3 s hasta sentir los isquiotibiales estirados, con la espalda neutra.", "Sube en 1 s empujando el piso y apretando el glúteo."],
    breath: "Inhala al bajar; exhala al subir.",
    cues: ["Caderas cuadradas al piso", "La mancuerna baja cerca de la pierna"],
    errors: ["Redondear la espalda", "Doblar mucho la rodilla de apoyo"],
    ladder: ["1 principal · 15 kg, en la mano contraria", { t: "Con 1 s de pausa abajo", o: { tempo: "3-1-1-0" } }, "Con la mochila puesta", "Saco de arena"]
  },
  curlfem: {
    name: "Curl femoral deslizante", muscles: ["Isquiotibiales", "Glúteo mayor"], knee: 1, start: "top", ph: ["Aleja", "Abajo", "Recoge", "Arriba"],
    why: "Isquiotibiales en su función de rodilla, la que el peso muerto no toca. Frenan la tibia y protegen los ligamentos; el trabajo que enfatiza la bajada lenta es la base de los programas que más redujeron sus lesiones.",
    setup: "Boca arriba en el piso de cerámica, talones sobre una toalla doblada, rodillas a ~90° y brazos a los lados. Sube la cadera como en un puente.",
    steps: ["Con la cadera arriba, aleja los talones deslizando la toalla en 4 s.", "Cuando las piernas quedan casi rectas, baja la cadera al piso.", "Recoge los talones y vuelve a subir la cadera: esa es una repetición."],
    breath: "Exhala largo mientras alejas los talones.",
    cues: ["Cadera alta durante toda la bajada", "Glúteos apretados"],
    errors: ["Dejar caer la cadera al empezar", "Ir rápido al final del recorrido"],
    safety: "Los primeros días deja agujetas en los isquios: es normal. Si sientes un tirón agudo detrás de la rodilla, para.",
    ladder: ["Bajada con las dos piernas", { t: "Bajada a una pierna", o: { side: true } }, { t: "Ida y vuelta sin bajar la cadera", o: { side: false } }, { t: "Ida y vuelta a una pierna", o: { side: true } }]
  },
  extrod: {
    name: "Extensión de rodilla de 90° a 45°", muscles: ["Cuádriceps"], knee: 2, start: "bottom", ph: ["Regresa", "Estirado", "Extiende", "Arriba"],
    why: "Cuádriceps aislado en la mitad de abajo del recorrido: el tramo con menos presión sobre la rótula en este ejercicio y el que más hizo crecer el cuádriceps en un ensayo brasileño.",
    setup: "Sentado al borde de la silla, liga doble anclada a la pata trasera y rodeando el tobillo. Empiezas con la rodilla a 90°: la liga ya debe tensar ahí.",
    steps: ["Extiende la rodilla en 1 s solo hasta ~45°: la pierna a medio camino, nunca recta.", "Regresa en 2 s a 90°.", "Quédate 1 s a 90° sintiendo el muslo estirado."],
    breath: "Exhala al extender.",
    cues: ["Muslo quieto sobre la silla", "El pie nunca sube más alto que la rodilla"],
    errors: ["Estirar del todo la rodilla", "Liga floja a 90°: no trabaja la parte importante"],
    safety: "Si molesta, reduce el recorrido hacia los 90°; esta parte no debe doler.",
    ladder: ["Tu liga (doble si a 90° no tensa)", "Liga más dura", "Liga más dura, doble", { t: "Con 2 s quieto a 90°", o: { tempo: "2-2-1-0" } }]
  },
  stepdown: {
    name: "Step-down lateral", muscles: ["Cuádriceps", "Glúteo medio", "Control de rodilla"], knee: 2, start: "top", ph: "squat", skipMod: true,
    why: "Bajar escalones, entrenado: lento, con carga creciente y la rodilla alineada. Es una pieza del miércoles, no el miércoles entero.",
    setup: "De costado sobre el escalón: la pierna que trabaja arriba y la otra en el aire, al costado. Una mano cerca de la pared.",
    steps: ["Lleva la cadera un poco atrás e inclina levemente el tronco hacia adelante.", "Baja en 3 s doblando la rodilla de apoyo hasta que el talón libre roce el piso, sin apoyar peso.", "Sube en 1 s empujando con todo el pie de apoyo."],
    breath: "Inhala al bajar; exhala al subir.",
    cues: ["Rodilla de apoyo hacia el segundo dedo del pie", "Pelvis nivelada, sin caerse de un lado"],
    errors: ["Rodilla que se va hacia adentro", "Dejarte caer los últimos centímetros"],
    safety: "Dolor de 2/10 como máximo. Si molesta, baja la altura del escalón.",
    ladder: ["Escalón de 10 cm", "Escalón de 15 cm", "Escalón de 20 cm (el de tu casa)", "20 cm + mochila de 5 kg", "20 cm + mochila de 10 kg"]
  },
  hipthrust: {
    name: "Hip thrust sobre el sofá", muscles: ["Glúteo mayor", "Isquiotibiales"], knee: 1, start: "bottom", ph: ["Baja", "Abajo", "Sube", "Aprieta"],
    why: "Glúteo mayor, el músculo que más descarga la rodilla al caminar y frenar, con muy poca carga sobre ella.",
    setup: "Omóplatos en el borde del sofá o de la cama firme, pies en el piso al ancho de caderas. La mancuerna sobre los huesos de la cadera, con una toalla.",
    steps: ["Sube la cadera empujando con los talones hasta que el tronco quede paralelo al piso.", "Sostén 1 s arriba apretando los glúteos, con el mentón hacia el pecho.", "Baja en 2 s."],
    breath: "Exhala al subir.",
    cues: ["Rodillas a ~90° arriba", "Costillas abajo, sin arquear la lumbar"],
    errors: ["Empujar con la espalda en vez de la cadera", "Pies demasiado cerca"],
    safety: "Si la rodilla molesta, aleja un poco los pies. Si con 15 kg te sobran más de 3 repeticiones al llegar a 15, salta al peldaño siguiente.",
    ladder: ["1 principal · 15 kg, sobre la cadera", "1 principal · 15 kg, sobre la cadera + mochila encima", { t: "A una pierna, sin peso", o: { side: true, reps: "8-12" } }, { t: "A una pierna, 1 principal · 15 kg", o: { side: true, reps: "8-12" } }]
  },
  talonpie: {
    name: "Elevación de talones de pie a una pierna", muscles: ["Pantorrilla", "Sóleo"], knee: 0, start: "top", ph: ["Baja", "Estirado", "Sube", "Arriba"],
    why: "Gemelo y sóleo absorben impacto y estabilizan la rodilla. Va de pie y con pausa abajo porque la pantorrilla creció bastante más de pie que sentado en un estudio japonés.",
    setup: "Punta de un pie en el borde del escalón, talón en el aire, rodilla recta sin bloquear. La principal de 15 kg en la mano del mismo lado y la otra mano en la pared.",
    steps: ["Baja el talón por debajo del escalón en 1 s.", "Quédate 2 s abajo, estirado.", "Sube en 1 s hasta la máxima altura, sobre el dedo gordo."],
    breath: "Exhala al subir.",
    cues: ["Rango completo", "Sin rebotar abajo"],
    errors: ["Rebotar", "Rango corto arriba"],
    ladder: ["A una pierna, 1 principal · 15 kg", "A una pierna, 1 principal · 15 kg + mochila 5 kg", "A una pierna, 1 principal · 15 kg + mochila 10 kg"]
  },
  copen: {
    name: "Copenhagen corto", muscles: ["Aductores", "Oblicuos", "Core"], knee: 1, pacer: false,
    why: "Aductores, el grupo que faltaba, más core lateral. En futbolistas noruegos, este único ejercicio redujo 41% los problemas de ingle.",
    setup: "De costado, apoyado en el antebrazo con el codo bajo el hombro. El lado interno de la rodilla de arriba sobre el asiento de una silla con una toalla doblada; la pierna de abajo libre.",
    steps: ["Sube la cadera hasta que el cuerpo quede en línea.", "Lleva la pierna de abajo hacia arriba hasta tocar la silla, o lo más cerca que puedas.", "Mantén el tiempo indicado y cambia de lado."],
    breath: "Continua.",
    cues: ["Cadera alta", "Apoyas el costado de la rodilla, nunca la rótula"],
    errors: ["Cadera que se hunde", "Apoyar la rótula en la silla"],
    safety: "Si la rodilla de apoyo molesta, pon más toalla o acerca la silla a la cadera, para apoyar el muslo.",
    ladder: ["15-20 s", { t: "25-30 s", o: { hold: 30 } }, "Fase 2: versión larga, con el tobillo en la silla"]
  },

  /* ---------------- Viernes ---------------- */
  flexexp: {
    name: "Flexiones explosivas", muscles: ["Pecho", "Tríceps", "Potencia"], knee: 0, start: "top", ph: "push",
    why: "Potencia, lo que más rápido se pierde con la edad. Hoy en tren superior; la de piernas llega tras evaluar la rodilla.",
    setup: "Empieza con las manos en el asiento de una silla apoyada contra la pared, cuerpo en plancha.",
    steps: ["Baja controlado en 2 s.", "Empuja lo más rápido posible para que las manos despeguen.", "Aterriza con los codos suaves y vuelve a empezar."],
    breath: "Exhala fuerte al empujar.",
    cues: ["Cada repetición igual de rápida que la primera", "Muñecas firmes"],
    errors: ["Seguir cuando ya sale lenta", "Aterrizar con los codos rígidos"],
    safety: "Si la muñeca molesta, vuelve a la silla.",
    ladder: ["Manos en la silla contra la pared", "En el piso", "Con palmada, si las muñecas no protestan"]
  },
  remoexp: {
    name: "Remo explosivo con liga", muscles: ["Espalda media", "Dorsal", "Potencia"], knee: 0, start: "bottom", ph: "pull",
    why: "Potencia de tirón, para equilibrar la de empuje.",
    setup: "De pie frente a la liga anclada a la altura del pecho, rodillas suaves, brazos estirados con tensión.",
    steps: ["Tira lo más rápido posible llevando los codos atrás y juntando las escápulas.", "Regresa en 2 s controlando."],
    breath: "Exhala al tirar.",
    cues: ["La meta es velocidad, no cansancio"],
    errors: ["Tirar con la espalda baja", "Perder la postura"],
    ladder: ["Liga actual", "Un paso más atrás", "Liga más dura"]
  },
  arnold: {
    name: "Press Arnold sentado", muscles: ["Hombro anterior", "Hombro lateral", "Tríceps"], knee: 0, start: "bottom", ph: "push",
    why: "Hombro completo, anterior y medio, con un recorrido largo gracias al giro.",
    setup: "Sentado en una silla con respaldo, mancuernas frente a los hombros con las palmas hacia ti.",
    steps: ["Empuja hacia arriba girando las palmas hacia adelante mientras subes.", "Arriba, brazos estirados sobre la cabeza.", "Baja en 2 s deshaciendo el giro."],
    breath: "Exhala al empujar.",
    cues: ["Espalda apoyada, costillas abajo", "Antebrazos verticales"],
    errors: ["Arquear la lumbar", "Bajar sin control"],
    ladder: ["2 principales · 7.5 kg c/u", "2 principales · 8.5 kg c/u", { t: "2 principales · 8.5 kg c/u, 1 s quieto arriba", o: { tempo: "2-0-1-1" } }, { t: "2 principales · 10 kg c/u", o: { tempo: "2-0-1-0" } }, "2 principales · 12.5 kg c/u"]
  },
  remosup: {
    name: "Remo supino con dos mancuernas", muscles: ["Dorsal", "Espalda media", "Bíceps"], knee: 0, start: "bottom", ph: "pull",
    why: "Dorsal y espalda media con agarre supino, que además suma bíceps.",
    setup: "De pie, torso inclinado a ~45° con bisagra de cadera, espalda neutra, rodillas suaves, palmas hacia adelante.",
    steps: ["Tira los codos pegados al cuerpo hacia la cadera.", "Sostén 1 s arriba juntando las escápulas.", "Baja en 2 s."],
    breath: "Exhala al tirar.",
    cues: ["Espalda neutra toda la serie", "Codos pegados"],
    errors: ["Levantar el torso para ayudar", "Redondear la espalda"],
    safety: "Si la lumbar se cansa antes que la espalda alta, apoya una mano en la silla y hazlo a una mano.",
    ladder: ["Con el peso del press Arnold (B1)", { t: "2 s de pausa arriba", o: { tempo: "2-0-1-2" } }, { t: "Bajando en 3 s, 2 s arriba", o: { tempo: "3-0-1-2" } }]
  },
  deficit: {
    name: "Flexiones con déficit", muscles: ["Pecho", "Tríceps", "Hombro anterior"], knee: 0, start: "top", ph: "push",
    why: "Pecho en su posición más estirada: el mejor estímulo que puedes darle sin banco.",
    setup: "Manos sobre dos pilas firmes de libros al ancho de los hombros, cuerpo en plancha.",
    steps: ["Baja en 2 s hasta que el pecho pase entre las manos.", "Sostén 2 s abajo, estirado.", "Empuja en 1 s."],
    breath: "Inhala al bajar; exhala al empujar.",
    cues: ["Codos a ~45° del torso", "Cuerpo en línea"],
    errors: ["Libros que se mueven", "Bajar más de lo que el hombro tolera"],
    safety: "Pilas estables. Si el hombro molesta, reduce la altura de las pilas.",
    ladder: ["Pilas actuales", "Pilas más altas, hasta donde el hombro tolere", "Con la mochila puesta", "Con la mochila de 10 kg"]
  },
  jalon: {
    name: "Jalón con liga sentado", muscles: ["Dorsal"], knee: 0, start: "bottom", ph: "pull",
    why: "Dorsal en estiramiento desde arriba: ancho de espalda.",
    setup: "Sentado en el piso frente a la puerta, liga anclada arriba, brazos estirados hacia el ancla.",
    steps: ["Tira los codos hacia abajo y atrás hasta los costados.", "Sube en 2 s.", "Sostén 1 s arriba con los brazos estirados, sintiendo el dorsal."],
    breath: "Exhala al tirar.",
    cues: ["Pecho alto", "Hombros lejos de las orejas"],
    errors: ["Echar el torso atrás", "Tirar solo con los brazos"],
    alt: "Con barra: dominadas supinas, 3 × tu máximo menos 2.",
    ladder: ["Liga actual", "Liga más dura", { t: "Barra: negativas", o: { reps: "3-5", tempo: "5-0-1-0" } }, { t: "Barra: dominadas supinas", o: { reps: "3-6", tempo: "2-1-1-0" } }, { t: "Barra: dominadas supinas con mochila", o: { reps: "3-6" } }]
  },
  latpie: {
    name: "Elevación lateral de pie", muscles: ["Hombro lateral"], knee: 0, start: "bottom", ph: "raise",
    why: "Deltoide lateral, tercera dosis de la semana.",
    setup: "De pie, mancuernas a los costados, codos apenas flexionados.",
    steps: ["Sube ambos brazos hacia los lados hasta la altura de los hombros.", "Baja en 2 s sin descansar abajo."],
    breath: "Exhala al subir.",
    cues: ["Guía con los codos", "Sin impulso"],
    errors: ["Encoger los hombros", "Balancear el cuerpo"],
    ladder: ["2 principales · 2.5 kg c/u", "2 principales · 3.5 kg c/u", "2 principales · 5 kg c/u", "2 principales · 6 kg c/u", "2 principales · 7.5 kg c/u"]
  },
  martillo: {
    name: "Curl martillo", muscles: ["Braquial", "Antebrazo", "Bíceps"], knee: 0, start: "bottom", ph: "raise",
    why: "Braquial y antebrazo: grosor de brazo y agarre.",
    setup: "De pie, mancuernas a los costados con las palmas mirándose.",
    steps: ["Flexiona ambos codos en 1 s sin girar las palmas.", "Baja en 3 s hasta estirar por completo."],
    breath: "Exhala al subir.",
    cues: ["Codos pegados al cuerpo"],
    errors: ["Balancear el torso", "Bajar rápido"],
    ladder: ["Con el peso de las laterales (D1)", { t: "1 s quieto arriba", o: { tempo: "3-0-1-1" } }, { t: "Bajando en 4 s", o: { tempo: "4-0-1-1" } }]
  },
  frances: {
    name: "Press francés acostado", muscles: ["Tríceps"], knee: 0, start: "top", ph: "raise",
    why: "Tríceps, incluida la cabeza larga, en un ángulo distinto al del lunes.",
    setup: "Boca arriba en el piso, brazos estirados sobre los hombros con una mancuerna en cada mano.",
    steps: ["Dobla solo los codos y baja las mancuernas junto a las sienes en 3 s.", "Extiende en 1 s."],
    breath: "Inhala al bajar; exhala al subir.",
    cues: ["Codos quietos, apuntando al techo"],
    errors: ["Abrir los codos", "Mover los hombros"],
    ladder: ["Con el peso de las laterales (D1)", { t: "1 s quieto abajo", o: { tempo: "3-1-1-0" } }, { t: "Bajando en 4 s", o: { tempo: "4-1-1-0" } }]
  },
  yraise: {
    name: "Elevación en Y en bisagra", muscles: ["Trapecio bajo", "Hombro posterior"], knee: 0, start: "bottom", ph: "raise",
    why: "Trapecio inferior: baja y estabiliza las escápulas.",
    setup: "De pie, bisagra de cadera con el torso casi paralelo al piso, brazos colgando y pulgares hacia arriba.",
    steps: ["Sube los brazos en forma de Y hasta la altura de las orejas.", "Sostén 1 s arriba.", "Baja en 2 s."],
    breath: "Exhala al subir.",
    cues: ["Hombros lejos de las orejas", "Siempre de pie, nunca boca abajo en el piso"],
    errors: ["Encoger el cuello"],
    ladder: ["2 vinilos (1 kg c/u)", { t: "2 vinilos (1 kg c/u), 2 s quieto arriba", o: { tempo: "2-0-1-2" } }, { t: "2 principales sin discos (solo las barras)", o: { tempo: "2-0-1-1" } }, "2 principales · 1 kg c/u", "2 principales · 2.5 kg c/u"]
  },
  planchalat: {
    name: "Plancha lateral con la pierna de arriba levantada", muscles: ["Oblicuos", "Glúteo medio", "Core"], knee: 0, pacer: false,
    why: "Core lateral más glúteo medio, el estabilizador que impide que la rodilla se vaya hacia adentro. Protege la columna cuando cargas de un solo lado, como en la caminata de maleta del sábado.",
    setup: "De lado, apoyado en el antebrazo, con el codo bajo el hombro, y en los pies.",
    steps: ["Sube la cadera hasta que el cuerpo quede en línea.", "Levanta la pierna de arriba un palmo y mantenla.", "Cambia de lado."],
    breath: "Continua.",
    cues: ["Cadera alta", "Pierna de arriba recta, punta al frente"],
    errors: ["Cadera caída", "Girar el tronco hacia el piso"],
    ladder: ["30 s por lado", { t: "40 s por lado", o: { hold: 40 } }, { t: "40 s con pequeñas elevaciones de la pierna", o: { hold: 40 } }]
  },

  /* ---------------- Sábado ---------------- */
  rdl2p: {
    name: "Peso muerto rumano", muscles: ["Isquiotibiales", "Glúteo mayor", "Erectores", "Hueso: cadera y columna"], knee: 1, start: "top", ph: "hinge",
    why: "Carga para columna y cadera, más cadena posterior. La subida explosiva aumenta el estímulo para el hueso.",
    setup: "Pies al ancho de caderas, mancuernas delante de los muslos, rodillas levemente flexionadas.",
    steps: ["Lleva la cadera atrás en 2 s con las mancuernas pegadas a las piernas y la espalda neutra.", "Baja hasta media tibia o hasta que los isquiotibiales tiren.", "Sube explosivo apretando los glúteos.", "Arriba, erguido, sin echarte hacia atrás."],
    breath: "Bloqueo breve con medio aire al bajar; exhala al subir. Nunca aguantes el aire al máximo.",
    cues: ["Rodillas casi quietas: el movimiento es de cadera"],
    errors: ["Redondear la espalda", "Convertirlo en sentadilla"],
    ladder: ["A dos piernas", "Postura B: el pie de atrás solo de apoyo", { t: "A una pierna, con las 2 principales", o: { side: true } }, { t: "Saco de arena de 20-30 kg, a dos piernas", o: { side: false } }]
  },
  goblet: {
    name: "Sentadilla goblet a tu caja", muscles: ["Cuádriceps", "Glúteo mayor", "Hueso: fémur y cadera"], knee: 2, start: "top", ph: "squat",
    why: "Carga compresiva en fémur y cadera dentro de tu rango seguro.",
    setup: "Mochila puesta. Pies algo más abiertos que la cadera, puntas un poco afuera, la caja detrás. Una mancuerna vertical pegada al pecho, sujeta por el disco superior.",
    steps: ["Baja en 2 s llevando la cadera atrás y abajo.", "Toca la caja 1 s sin sentarte ni soltar la tensión.", "Sube explosivo empujando el piso."],
    breath: "Bloqueo breve con medio aire al bajar; exhala al subir.",
    cues: ["Rodillas en la dirección de los pies", "Talones en el piso, tronco erguido"],
    errors: ["Sentarte y relajarte en la caja", "Rodillas hacia adentro"],
    safety: "Techo de 20 kg totales hasta la evaluación. Si aparece la sensación de hueso desubicado, sube la caja.",
    modNote: "Filtro modificado: tu caja un puño más alta.",
    ladder: ["Con la mochila de 5 kg", "Con la mochila de 10 kg"]
  },
  pressmil: {
    name: "Press militar de pie", muscles: ["Hombro anterior", "Tríceps", "Core", "Hueso: columna"], knee: 0, start: "bottom", ph: "push",
    why: "Carga vertical sobre la columna y los hombros, con el core trabajando para que no te arquees.",
    setup: "De pie, pies al ancho de caderas, glúteos y abdomen firmes, mancuernas a la altura de los hombros.",
    steps: ["Empuja explosivo hasta estirar los brazos, con los bíceps cerca de las orejas.", "Baja en 2 s a los hombros."],
    breath: "Exhala al empujar.",
    cues: ["Costillas abajo"],
    errors: ["Arquear la lumbar", "Impulsarte con las piernas"],
    ladder: ["2 principales · 7.5 kg c/u", "2 principales · 8.5 kg c/u", "2 principales · 10 kg c/u", "2 principales · 12.5 kg c/u"]
  },
  maleta: {
    name: "Caminata de maleta", muscles: ["Oblicuos", "Agarre", "Hueso: cadera"], knee: 1, pacer: false,
    why: "Carga lateral para cadera y columna, una dirección nueva para el hueso; también oblicuos y agarre.",
    setup: "Una mancuerna en una mano, al costado.",
    steps: ["Camina 20 pasos erguido sin inclinarte hacia el peso.", "Cambia de mano y vuelve."],
    breath: "Continua.",
    cues: ["Hombros nivelados"],
    errors: ["Inclinarte hacia el peso o compensar hacia el otro lado"],
    ladder: ["Sin mochila", "Con la mochila de 5 kg puesta", "Con la mochila de 10 kg"]
  },
  farmer: {
    name: "Farmer carry con mochila", muscles: ["Agarre", "Trapecio", "Core", "Hueso: todo el esqueleto"], knee: 1, pacer: false,
    why: "Carga vertical para todo el esqueleto, más agarre, uno de los marcadores de longevidad.",
    setup: "Mochila puesta y una mancuerna en cada mano.",
    steps: ["Camina erguido, hombros atrás y abajo, pasos cortos.", "La serie termina si se rompe la postura."],
    breath: "Continua.",
    cues: ["Mirada al frente"],
    errors: ["Encorvarte", "Arrastrar los pies"],
    ladder: ["Con la mochila de 5 kg", "Con la mochila de 10 kg", "Saco de arena abrazado"]
  }
};

/* Datos de la semana. Los minutos de cada bloque (start/end) son los del documento Sistema 3.0
   en modo normal; en descarga o con filtro, la página los recalcula. */
const CONFIGS = [
  ["Las 2 principales", "Tu par armable. Hoy, 7.5 kg de discos en cada una (2.5 + 1.25 por lado). Cuando la escalera pide otro peso, la app te dice qué discos poner. Los kilos son de discos; cada barra con sus collares suma 1.5 kg."],
  ["1 principal · 15 kg", "Los discos de 2.5 y 1.25 en una sola (2.5 + 2.5 + 1.25 + 1.25 por lado); la otra queda vacía."],
  ["Discos de 0.5 kg", "Tienes 4. No van en las cargas de partida: son tu primer paso para subir de peso (por ejemplo, 2.5 + 1.25 + 0.5 por lado = 8.5 kg cada una)."],
  ["Las 2 principales sin discos", "Solo las barras con sus collares, 1.5 kg cada una."],
  ["La antigua (5 kg)", "Tu mancuerna vieja de una pieza."],
  ["2 vinilos (1 kg c/u)", "Las de vinilo. Antes: «dos de 1 kg»."],
  ["Mochila", "Libros o botellas de agua; empieza con 5 kg."],
  ["Saco de arena", "Arena en bolsas dobles dentro de una mochila o bolso viejo, 20-30 kg. Lo más barato por kilo cuando los discos se queden cortos."]
];

const TONES = {
  prep: "Preparación y enfriamiento",
  fuerza: "Fuerza, potencia y hueso",
  hiper: "Hipertrofia",
  control: "Rodilla, control y core",
  aero: "Aeróbico"
};

const KNEE = [
  ["Rodilla libre", "ok", "No carga la rodilla."],
  ["Rodilla: carga baja", "prep", "La rodilla trabaja poco o sin flexión profunda."],
  ["Rodilla: carga controlada", "warn", "Carga la rodilla dentro de tu rango seguro: aquí mandan el filtro y la regla de 24 horas."]
];

const RULES = [
  ["Filtro de rodilla", "Antes del miércoles y del sábado: dolor al despertar de 1/10 o menos, rigidez que se va en 5 minutos de moverte y sin hinchazón visible. La página ajusta la sesión según tus respuestas."],
  ["Regla de 24 horas", "Durante el ejercicio: dolor de rodilla de 2/10 como máximo, sin sensación de hueso desubicado y sin chasquido con dolor; si algo falla, cortas ese ejercicio. A la mañana siguiente, la rodilla igual o mejor que tu normal; si amaneces peor, ese ejercicio baja un paso. Dos semanas seguidas peor: una semana sin pierna y a evaluación."],
  ["Respiración", "Inhalas antes de bajar y exhalas al subir la carga. En el sábado pesado vale un bloqueo breve con medio aire, nunca una apnea máxima: protege el varicocele y la presión arterial."],
  ["Progresión doble", "Cuando completas el tope del rango en todas las series dos sesiones seguidas, subes un peldaño y vuelves al piso del rango. La página te lo sugiere sola si registras tus series."],
  ["Descargas", "Una semana cada 6-8 semanas y siempre en semana de parciales o finales: mismas sesiones, la mitad de las series, RIR 3-4, caminatas iguales."],
  ["Si se cae una sesión", "No se recupera al día siguiente: sigues con la semana. Recuperarla rompe el espaciado de la rodilla."],
  ["Sin hielo ni ibuprofeno de rutina", "1,200 mg diarios de ibuprofeno redujeron a la mitad el crecimiento muscular en jóvenes (Lilja 2018, Suecia), y el agua fría tras la fuerza frenó músculo y fuerza (Roberts 2015). Quedan para un brote de dolor o hinchazón."],
  ["Parar y consultar", "Dolor articular nuevo que empeora, hinchazón de rodilla, o pulso en reposo 10-15 lpm más alto durante varios días."]
];

const HABITS = [
  "Equilibrio a una pierna 30 s por lado mientras te lavas los dientes, mañana y noche; con los ojos cerrados cuando con ojos abiertos sea fácil",
  "Cada 45 min de laptop, 1 min de pie: 10 retracciones de mentón, 10 separaciones de liga y 20 s mirando lejos por la ventana",
  "Pantalla a la altura de los ojos y laptop sobre la mesa, nunca sobre las piernas",
  "10 min caminando después del almuerzo",
  "Escaleras: subir rápido de a un escalón; bajar de a uno"
];

const WALK = {
  title: "Caminata con intervalos japoneses",
  window: "7:12 a 7:40",
  lead: "Muy rápido = 7 de 10: solo puedes decir frases cortas. Si caminando a tope todavía conversas cómodo, trota suave con pasos cortos, solo si la rodilla está en su línea base.",
  segments: [
    ["Paso normal", 120, "Conversas sin esfuerzo."],
    ["Muy rápido", 180, "Solo frases cortas."],
    ["Paso normal", 180, "Recupera el aliento."],
    ["Muy rápido", 180, "Solo frases cortas."],
    ["Paso normal", 180, "Recupera."],
    ["Muy rápido", 180, "Solo frases cortas."],
    ["Paso normal", 180, "Recupera."],
    ["Muy rápido", 180, "El último."],
    ["Paso normal, bajando el ritmo", 300, "Llega a casa conversando."]
  ]
};

const HILL = {
  title: "4×4 caminando en cuesta",
  window: "17:00 a 17:40",
  lead: "Rápida = 8 de 10: solo frases de 3-4 palabras. Todo es subida; la recuperación también es subiendo, más lento. Necesitas una cuesta con unos 25 min de subida continua, por ejemplo del centro hacia San Cristóbal y más arriba.",
  segments: [
    ["Caminata que acelera hasta la cuesta", 480, "Los 2 últimos minutos ya subiendo a 5 de 10."],
    ["Subida rápida", 240, "8 de 10. Pasos cortos y rápidos, braceo activo."],
    ["Subida lenta", 180, "5 de 10: recuperas sin detenerte."],
    ["Subida rápida", 240, "8 de 10."],
    ["Subida lenta", 180, "Recupera."],
    ["Subida rápida", 240, "8 de 10."],
    ["Subida lenta", 180, "Recupera."],
    ["Subida rápida", 240, "La última, al mismo ritmo que la primera, no más rápido."],
    ["Bajada caminando", 420, "Pasos cortos, sin trotar. Si la rodilla avisa, bajas en carro."]
  ]
};

const FOURBYFOUR = {
  title: "4×4 trotando (fase 2)",
  window: "40 min",
  lead: "Solo con el visto bueno de la rodilla: en cuesta o en bicicleta; en plano, solo si te lo autorizan. Fuerte = 8 de 10: apenas puedes decir unas palabras.",
  segments: [
    ["Trote lento de calentamiento", 600, "Ritmo niko-niko."],
    ["Fuerte", 240, "8 de 10."], ["Suave", 180, "Trote muy suave o caminata."],
    ["Fuerte", 240, "8 de 10."], ["Suave", 180, "Recupera."],
    ["Fuerte", 240, "8 de 10."], ["Suave", 180, "Recupera."],
    ["Fuerte", 240, "El último."], ["Suave", 180, "Recupera."],
    ["Enfriamiento", 120, "Caminata tranquila."]
  ]
};

/* Calentamientos y enfriamientos que se repiten */
const UPPER_WARM = [
  { name: "Separación de liga", dose: "15", est: 40, how: "Brazos estirados al frente a la altura del pecho; separa la liga hasta tocarte el pecho juntando las escápulas." },
  { name: "Rotación externa con liga", dose: "12 por lado", est: 60, how: "Codo pegado al costado a 90°; gira el antebrazo hacia afuera sin despegar el codo." },
  { name: "Gato-camello de pie", dose: "8 lentas", est: 40, how: "Manos sobre los muslos, rodillas suaves. Redondea la espalda llevando el mentón al pecho y luego ábrela sacando el pecho." }
];
const HIP_FLEXOR = { name: "Flexor de cadera en zancada de pie", dose: "30 s por lado", secs: 30, sides: 2, how: "Paso largo, rodilla de atrás estirada y en el aire. Aprieta el glúteo de atrás y lleva la pelvis hacia atrás: sientes el frente de la cadera. No dobles más la rodilla de adelante." };
const BREATH = { name: "Respiración lenta", dose: "5 ciclos", secs: 50, how: "Inhala 4 s por la nariz y exhala 6 s por la boca." };

const DAYS = {
  lun: {
    key: "lun", dow: 1, day: "Lunes", short: "Lun", type: "train", title: "Superior A: fuerza y postura",
    window: "11:00 a 11:55", walk: true, filter: false, next: "mar",
    lead: "Tirón y empuje con la carga más alta que permite tu equipo, y postura. Lo pesado va primero; los correctivos, al final.",
    impact: "Fuerza de tirón y empuje con la carga más alta de tu semana, y hombros hacia atrás.",
    prep: ["Collares apretados en ambas barras", "Ropa interior de soporte", "Agua a mano", "Volumen del celular arriba para los avisos"],
    setup: ["1 principal con 15 kg armada: 2.5 + 2.5 + 1.25 + 1.25 por lado (A1)", "Silla estable contra la pared, para la mano de apoyo en A1", "Liga anclada en la puerta a la altura de tu cara (B2)", "Mochila firme de 20-25 cm de alto en el piso (C1 y C2)", "La antigua (5 kg) junto al marco de una puerta (D1)", "Una liga suelta para el curl bayesiano (D2) y otra para calentar", "Espacio en el piso para la plancha y el bicho muerto"],
    after: {
      si: ["Comida de las 12:00-12:30 con 30-40 g de proteína", "Ducha, y en esa misma ducha el lavado de pecho y espalda", "Caminar 10 min después del almuerzo", "Pausas de laptop con retracción de mentón"],
      no: ["Volver a entrenar tren superior hoy: el músculo crece mientras descansa", "Ibuprofeno de rutina para las agujetas", "Laptop sobre las piernas"]
    },
    blocks: [
      { id: "cal", label: "Cal", name: "Calentamiento", start: 0, end: 300, kind: "list", tone: "prep", items: [
        UPPER_WARM[2], UPPER_WARM[0], UPPER_WARM[1],
        { name: "Flexiones escapulares", dose: "10", est: 30, how: "En plancha con brazos rectos, deja que el pecho baje juntando las escápulas y luego empuja el piso separándolas. Los codos no se doblan." },
        { name: "Series de aproximación", dose: "1 de cada", est: 90, how: "5 remos por lado a medio esfuerzo con la principal de 15 kg y 3 flexiones arquero asistidas por lado." }
      ]},
      { id: "A", label: "A", name: "Fuerza", start: 300, end: 1200, kind: "superset", tone: "fuerza", rounds: 4,
        note: "Último descanso del bloque: reparte los discos en las 2 principales para el bloque C.", noteAt: "last", ex: [
        { id: "remo1m", code: "A1", sets: 4, reps: "6-8", side: true, tempo: "2-0-1-1", rest: 45, rir: "1-2", load: "1 principal · 15 kg" },
        { id: "arquero", code: "A2", sets: 4, reps: "4-6", side: true, tempo: "2-0-1-0", rest: 60, rir: "1-2", load: "Peso corporal" }
      ]},
      { id: "B", label: "B", name: "Hombro y postura", start: 1200, end: 1650, kind: "superset", tone: "hiper", rounds: 3, ex: [
        { id: "pike", code: "B1", sets: 3, reps: "6-10", tempo: "2-0-1-0", rest: 30, rir: "1-2", load: "Peso corporal" },
        { id: "facepull", code: "B2", sets: 3, reps: "15", tempo: "1-0-1-1", rest: 35, rir: "2", load: "Liga" }
      ]},
      { id: "C", label: "C", name: "Pecho y dorsal en estiramiento", start: 1650, end: 2190, kind: "superset", tone: "hiper", rounds: 3, ex: [
        { id: "pressinc", code: "C1", sets: 3, reps: "8-12", tempo: "2-1-1-0", rest: 30, rir: "0-1 en la última", load: "2 principales · 7.5 kg c/u" },
        { id: "pullover", code: "C2", sets: 3, reps: "10-12", tempo: "2-1-2-0", rest: 30, rir: "1-2", load: "1 principal · 7.5 kg", follow: "pressinc", as: "una" }
      ]},
      { id: "D", label: "D", name: "Brazos y hombro lateral", start: 2190, end: 2850, kind: "circuit", tone: "hiper", rounds: 2, ex: [
        { id: "latinc", code: "D1", sets: 2, reps: "12-20", side: true, tempo: "2-0-1-0", rest: 0, rir: "0-1", load: "La antigua (5 kg)" },
        { id: "curlbay", code: "D2", sets: 2, reps: "10-15", side: true, tempo: "2-1-1-0", rest: 0, rir: "0-1", load: "Liga pisada" },
        { id: "triover", code: "D3", sets: 2, reps: "10-15", tempo: "3-1-1-0", rest: 30, rir: "0-1", load: "1 principal · 7.5 kg", follow: "pressinc", as: "una" }
      ]},
      { id: "E", label: "E", name: "Core postural", start: 2850, end: 3120, kind: "superset", tone: "control", rounds: 2, ex: [
        { id: "planchaesc", code: "E1", sets: 2, hold: 40, rest: 0, load: "Peso corporal" },
        { id: "bichomuerto", code: "E2", sets: 2, reps: "8", side: true, tempo: "Lento", rest: 30, load: "Peso corporal" }
      ]},
      { id: "enf", label: "Enf", name: "Enfriamiento", start: 3120, end: 3300, kind: "list", tone: "prep", items: [
        { name: "Pectoral en el marco de la puerta", dose: "45 s por lado", secs: 45, sides: 2, how: "Antebrazo apoyado en el marco a la altura del hombro; gira el cuerpo suave hacia el lado contrario." },
        { name: "Dorsal de pie", dose: "45 s", secs: 45, how: "Manos en el respaldo de la silla, cadera atrás, pecho hacia el piso y brazos estirados." },
        BREATH
      ]}
    ]
  },

  mar: {
    key: "mar", dow: 2, day: "Martes", short: "Mar", type: "aero", title: "Aeróbico: trote lento o 4×4 en cuesta",
    window: "17:00 a 17:40", walk: false, filter: false, next: "mie",
    lead: "El martes alterna semanas. La A construye base aeróbica con trote lento; la B sube el VO2max con un 4×4 caminando en cuesta, sin impacto.",
    weeks: {
      A: { title: "Semana A: trote lento japonés", impact: "Base aeróbica: así se construyen mitocondrias con el menor impacto para la rótula.",
        lead: "30 minutos de trote tan lento que podrías sonreír y conversar, a la cadencia que menos carga la rótula." },
      B: { title: "Semana B: 4×4 caminando en cuesta", impact: "Cuatro bloques cerca de tu máximo aeróbico: el estímulo que más sube el VO2max, sin impacto.",
        lead: "Cuatro subidas rápidas de 4 minutos con 3 de recuperación subiendo lento. Todo es subida: la rodilla casi no frena." }
    },
    prep: ["Zapatillas firmes", "Agua", "Gorra y protector si sales antes de las 16:00", "Celular con volumen para los avisos"],
    setup: ["Semana A: pista de la Vía Expresa o cualquier tramo plano; las bajadas, caminando", "Semana B: una cuesta larga del centro, unos 25 min de subida continua"],
    after: {
      si: ["Agua y cena normal a las 19:15-19:30", "Estirar pantorrillas suave", "Dormir a tu hora: mañana hay pierna"],
      no: ["Cena pesada y tarde", "Bajar escaleras o cuestas trotando de regreso"]
    },
    blocks: [
      { id: "cal", label: "Cal", name: "Calentamiento", start: 0, end: 300, kind: "list", tone: "prep", items: [
        { name: "Caminata que acelera", dose: "3 min", secs: 180, how: "Empieza tranquilo y termina caminando rápido." },
        { name: "Elevaciones de talón", dose: "10", est: 25, how: "De pie, sube y baja los talones con control." },
        { name: "Balanceos de pierna", dose: "10 por lado", est: 45, how: "Apoyado en algo, balancea la pierna adelante y atrás, relajado." }
      ]},
      { id: "T", label: "Trote", name: "Trote lento niko-niko", start: 300, end: 2100, kind: "phase", tone: "aero", metronome: true, checks: [600, 1200],
        ex: { id: "trote", code: "T", hold: 1800 } },
      { id: "enf", label: "Enf", name: "Enfriamiento", start: 2100, end: 2400, kind: "list", tone: "prep", items: [
        { name: "Caminata suave", dose: "3 min", secs: 180, how: "Baja las pulsaciones caminando." },
        { name: "Pantorrilla en la pared", dose: "30 s por lado", secs: 30, sides: 2, how: "Manos en la pared, pierna de atrás estirada con el talón en el piso." },
        HIP_FLEXOR
      ]}
    ]
  },

  mie: {
    key: "mie", dow: 3, day: "Miércoles", short: "Mié", type: "train", title: "Inferior A: pierna completa y hombro",
    window: "11:00 a 11:55", walk: false, filter: true, next: "jue",
    lead: "Tu día de pierna completo: fuerza a una pierna, cadena posterior, isquios de rodilla, cuádriceps en rango largo, glúteo, pantorrilla y aductores, con hombro trabajando en los descansos. Nada salta ni gira, y la profundidad la marca tu caja.",
    impact: "Pierna completa sin impacto: cadera más rodilla, la combinación que más alivia y protege la rodilla.",
    filterMod: "Sin step-downs ni aterrizajes; cojín y caja un puño más altos. Todo lo demás igual.",
    prep: ["Filtro de rodilla respondido", "Ropa interior de soporte", "Agua", "Pantalón largo si hace frío"],
    setup: ["1 principal con 15 kg armada (2.5 + 2.5 + 1.25 + 1.25 por lado): se usa toda la sesión", "La antigua (5 kg) junto al marco de una puerta (B2)", "Cojín sobre una pila de libros a tu altura segura (A1)", "Liga anclada en la puerta a la altura de tu cara (A2)", "Toalla doblada sobre el piso de cerámica (C1)", "Liga anclada a la pata trasera de una silla, doble si a 90° no tensa (C2)", "Escalón estable de 10-15 cm junto a una pared (D1 y E1)", "Sofá o cama firme y otra toalla (D2)", "Silla con una toalla doblada para el Copenhagen (E2)", "Liga larga para la caminata lateral y pared libre"],
    after: {
      si: ["Comida de las 12:00-12:30 con 30-40 g de proteína", "Caminar normal: mueve sin cargar", "Subir escaleras rápido, de a un escalón", "Chequeo de rodilla esta noche y mañana al despertar"],
      no: ["Bajar escaleras de 2 en 2 o corriendo", "Saltos, giros o “probar acrobacias” porque te sientes bien", "Hielo o ibuprofeno de rutina: solo ante un brote", "Duchas muy calientes"]
    },
    blocks: [
      { id: "cal", label: "Cal", name: "Calentamiento", start: 0, end: 360, kind: "list", tone: "prep", items: [
        { name: "Caminar hacia atrás", dose: "2 min", secs: 120, how: "Pasos cortos apoyando primero la punta, rodillas suaves. Carga el cuádriceps casi sin impacto." },
        { name: "Elevaciones de puntas en la pared", dose: "15", est: 35, how: "Espalda y glúteos contra la pared, talones a un pie de ella. Sube las puntas de los pies sin despegar los talones: trabaja el tibial." },
        { name: "Caminata lateral con liga", dose: "12 pasos por lado", est: 40, how: "Pisa la liga al ancho de caderas, asas a la cadera, semisentadilla ligera. Pasos cortos con las rodillas empujando hacia afuera." },
        { name: "Sentadilla isométrica en pared", dose: "2 × 30 s", secs: 30, sets: 2, gap: 15, how: "Espalda en la pared a la altura de tu caja, peso en los talones, rodillas sobre el segundo dedo. Esfuerzo 6 de 10." },
        { name: "Aterrizajes sin salto", dose: "2 × 4", est: 45, skipMod: true, how: "De puntillas y brazos arriba, déjate caer a media sentadilla y frena quieto 2 s, sin despegar los pies del piso. Rodillas sobre el segundo dedo." },
        { name: "Split squat sin peso", dose: "5 por pierna", est: 40, how: "Hasta el cojín, lento. Ensaya la posición de A1." }
      ]},
      { id: "A", label: "A", name: "Fuerza de pierna", start: 360, end: 960, kind: "superset", tone: "fuerza", rounds: 3, ex: [
        { id: "splitsq", code: "A1", sets: 3, reps: "8-10", side: true, tempo: "3-1-1-0", rest: 15, rir: "2-3", load: "1 principal · 15 kg, al pecho" },
        { id: "facepull", code: "A2", sets: 3, reps: "15", tempo: "1-0-1-1", rest: 30, rir: "2", load: "Liga" }
      ]},
      { id: "B", label: "B", name: "Cadena posterior y hombro lateral", start: 960, end: 1560, kind: "superset", tone: "hiper", rounds: 3, ex: [
        { id: "rdl1p", code: "B1", sets: 3, reps: "8-10", side: true, tempo: "3-0-1-0", rest: 15, rir: "2", load: "1 principal · 15 kg" },
        { id: "latinc", code: "B2", sets: 3, reps: "10-15", side: true, tempo: "2-0-1-0", rest: 10, rir: "0-1", load: "La antigua (5 kg)" }
      ]},
      { id: "C", label: "C", name: "Isquios de rodilla y cuádriceps", start: 1560, end: 2100, kind: "superset", tone: "control", rounds: 3, ex: [
        { id: "curlfem", code: "C1", sets: 3, reps: "6-8", tempo: "4-0-1-0", rest: 15, rir: "2", load: "Toalla" },
        { id: "extrod", code: "C2", sets: 3, reps: "10-12", side: true, tempo: "2-1-1-0", rest: 20, rir: "1-2", load: "Liga (doble si a 90° no tensa)" }
      ]},
      { id: "D", label: "D", name: "Bajar escalones y glúteo", start: 2100, end: 2580, kind: "superset", tone: "control", rounds: 3, ex: [
        { id: "stepdown", code: "D1", sets: 3, reps: "8", side: true, tempo: "3-0-1-0", rest: 10, rir: "2-3", load: "Escalón" },
        { id: "hipthrust", code: "D2", sets: 3, reps: "10-15", tempo: "2-0-1-1", rest: 15, rir: "1-2", load: "1 principal · 15 kg" }
      ]},
      { id: "E", label: "E", name: "Pantorrilla y aductores", start: 2580, end: 3120, kind: "superset", tone: "control", rounds: 3, ex: [
        { id: "talonpie", code: "E1", sets: 3, reps: "10-12", side: true, tempo: "1-2-1-0", rest: 15, rir: "1", load: "1 principal · 15 kg" },
        { id: "copen", code: "E2", sets: 3, hold: 20, holdLabel: "15-20 s", side: true, rest: 10, rir: "Esfuerzo 7/10", load: "Silla y toalla" }
      ]},
      { id: "enf", label: "Enf", name: "Enfriamiento", start: 3120, end: 3300, kind: "list", tone: "prep", items: [
        HIP_FLEXOR,
        { name: "Isquiotibiales con liga", dose: "30 s por lado", secs: 30, sides: 2, how: "Boca arriba, pierna estirada hacia el techo con la liga en el pie." },
        BREATH
      ]}
    ],
    stopPlan: {
      title: "Plan sin pierna", lead: "Hoy la rodilla manda: solo hombro y core, sin cargarla. Anótalo; si se repite dos semanas, a evaluación.",
      setup: ["Liga anclada en la puerta a la altura de tu cara (A1)", "La antigua (5 kg) junto al marco de una puerta (A2)", "Espacio en el piso para la plancha y el bicho muerto"],
      blocks: [
        { id: "cal", label: "Cal", name: "Calentamiento", kind: "list", tone: "prep", len: 180, items: UPPER_WARM },
        { id: "A", label: "A", name: "Hombro y postura", kind: "superset", tone: "hiper", rounds: 3, ex: [
          { id: "facepull", code: "A1", sets: 3, reps: "15", tempo: "1-0-1-1", rest: 30, rir: "2", load: "Liga" },
          { id: "latinc", code: "A2", sets: 3, reps: "10-15", side: true, tempo: "2-0-1-0", rest: 30, rir: "0-1", load: "La antigua (5 kg)" }
        ]},
        { id: "B", label: "B", name: "Core", kind: "superset", tone: "control", rounds: 2, ex: [
          { id: "planchaesc", code: "B1", sets: 2, hold: 40, rest: 0, load: "Peso corporal" },
          { id: "bichomuerto", code: "B2", sets: 2, reps: "8", side: true, tempo: "Lento", rest: 30, load: "Peso corporal" }
        ]},
        { id: "enf", label: "Enf", name: "Enfriamiento", kind: "list", tone: "prep", len: 140, items: [
          { name: "Pectoral en el marco de la puerta", dose: "45 s por lado", secs: 45, sides: 2, how: "Antebrazo en el marco a la altura del hombro; gira el cuerpo suave hacia el lado contrario." },
          BREATH
        ]}
      ]
    }
  },

  jue: {
    key: "jue", dow: 4, day: "Jueves", short: "Jue", type: "rest", title: "Recuperación activa", next: "vie",
    lead: "Hoy no hay sesión: el músculo y el tendón se adaptan mientras descansas. Caminata de siempre, sin intervalos, y lo demás es opcional.",
    after: {
      si: ["Caminata normal de 28 min, sin intervalos", "Movilidad suave por la noche (opcional, abajo)", "5 min de malabares (opcional, abajo)", "Dormir 8 h con tu horario de siempre"],
      no: ["Trotar o hacer intervalos", "“Solo unas flexiones”: hoy el músculo se repara", "Subir escaleras de 2 en 2 o bajarlas rápido", "Probar acrobacias"]
    },
    routines: [
      { id: "movilidad", title: "Movilidad suave", minutes: 8, lead: "Por la noche, sin forzar. Nada debe doler.", tone: "prep", items: [
        { name: "90/90 de cadera", dose: "60 s por lado", secs: 60, sides: 2, how: "Sentado, una pierna adelante y otra al costado, ambas dobladas a 90°. Inclina el tronco sobre la pierna de adelante. Sin dolor en la rodilla de atrás; si molesta, estira esa pierna." },
        { name: "Libro abierto", dose: "8 por lado", est: 70, how: "De costado en el piso, rodillas juntas y dobladas, brazos al frente. Abre el brazo de arriba hacia el otro lado siguiéndolo con la mirada, y vuelve. Movilidad de la espalda alta." },
        { name: "Tobillo contra la pared", dose: "10 por lado", est: 70, how: "Pie a un palmo de la pared; lleva la rodilla a tocarla sin levantar el talón. Si la toca fácil, aleja el pie un dedo." },
        { name: "Flexor de cadera en zancada de pie", dose: "45 s por lado", secs: 45, sides: 2, how: "Paso largo, rodilla de atrás en el aire. Aprieta el glúteo de atrás y lleva la pelvis hacia atrás." },
        BREATH
      ]},
      { id: "malabares", title: "Malabares", minutes: 5, lead: "Aprender un movimiento nuevo es entrenamiento para el cerebro: aprender malabares aumentó la materia gris en adultos (Draganski 2004, Alemania). Usa medias enrolladas o mandarinas.", tone: "aero", items: [
        { name: "Una pelota", dose: "1 min", secs: 60, how: "Lánzala de una mano a la otra en arco, hasta la altura de los ojos. Busca que el arco sea siempre igual." },
        { name: "Dos pelotas: intercambio", dose: "2 min", secs: 120, how: "Lanza la primera; cuando llegue a lo más alto, lanza la segunda por debajo. Atrapa ambas y para. Repite empezando con la otra mano." },
        { name: "Tres pelotas: cascada", dose: "2 min", secs: 120, how: "Dos en una mano y una en la otra. Haz el intercambio y sigue lanzando cada vez que una pelota llegue arriba. Se van a caer: es parte de aprender." }
      ]}
    ]
  },

  vie: {
    key: "vie", dow: 5, day: "Viernes", short: "Vie", type: "train", title: "Superior B: estética y potencia",
    window: "11:00 a 11:49", walk: true, filter: false, next: "sab",
    lead: "Más repeticiones, más estiramiento y potencia de tren superior. Sin pierna: mañana a las 6:15 la rodilla vuelve a cargar.",
    impact: "Potencia de tren superior, la que más rápido se pierde con la edad, y estética de hombro y brazo.",
    prep: ["Collares apretados", "Ropa interior de soporte", "Agua"],
    setup: ["Las 2 principales con 7.5 kg cada una (bloques B y C)", "Silla estable contra la pared (flexiones explosivas)", "Liga anclada a la altura del pecho (A2)", "Liga anclada arriba de la puerta (C2)", "Dos pilas firmes de libros para el déficit (C1)", "Los 2 vinilos de 1 kg (E1) y la liga del face pull (E2)"],
    after: {
      si: ["Comida de las 12:00-12:30 con proteína", "Dormir a las 9:45: mañana a las 6:15 hay hueso", "Dejar listo lo del sábado: mochila, mancuernas y un plátano"],
      no: ["Trasnochar", "Sumar pierna: mañana temprano la rodilla vuelve a cargar"]
    },
    blocks: [
      { id: "cal", label: "Cal", name: "Calentamiento", start: 0, end: 300, kind: "list", tone: "prep", items: [
        UPPER_WARM[0], UPPER_WARM[1], UPPER_WARM[2],
        { name: "Flexiones rápidas en la silla", dose: "8", est: 30, how: "Manos en el asiento de la silla apoyada contra la pared; baja controlado y sube rápido." },
        { name: "Serie ligera de press Arnold", dose: "6", est: 40, how: "Con poco esfuerzo, para preparar el hombro." }
      ]},
      { id: "A", label: "A", name: "Potencia", start: 300, end: 690, kind: "superset", tone: "fuerza", rounds: 3, ex: [
        { id: "flexexp", code: "A1", sets: 3, reps: "3-5", tempo: "2-0-X-0", rest: 40, rir: "Paras si baja la velocidad", load: "Peso corporal" },
        { id: "remoexp", code: "A2", sets: 3, reps: "6-8", tempo: "2-0-X-0", rest: 40, rir: "Paras si baja la velocidad", load: "Liga" }
      ]},
      { id: "B", label: "B", name: "Hipertrofia compuesta", start: 690, end: 1200, kind: "superset", tone: "hiper", rounds: 3,
        note: "Si en la primera serie del press Arnold no llegas a 8, baja las 2 principales a 5 kg cada una (solo los discos de 2.5) y haz el remo con 2 s de pausa arriba.", noteAt: "first", ex: [
        { id: "arnold", code: "B1", sets: 3, reps: "8-12", tempo: "2-0-1-0", rest: 30, rir: "0-1 en la última", load: "2 principales · 7.5 kg c/u" },
        { id: "remosup", code: "B2", sets: 3, reps: "10-12", tempo: "2-0-1-1", rest: 45, rir: "1", load: "2 principales · 7.5 kg c/u", follow: "arnold", as: "par" }
      ]},
      { id: "C", label: "C", name: "Estiramiento bajo carga", start: 1200, end: 1740, kind: "superset", tone: "hiper", rounds: 3,
        note: "Último descanso del bloque: cambia los discos de las 2 principales para el bloque D.", noteAt: "last", ex: [
        { id: "deficit", code: "C1", sets: 3, reps: "8-15", tempo: "2-2-1-0", rest: 25, rir: "0-1", load: "Peso corporal" },
        { id: "jalon", code: "C2", sets: 3, reps: "12-15", tempo: "2-1-1-0", rest: 30, rir: "1", load: "Liga" }
      ]},
      { id: "D", label: "D", name: "Brazos y hombro lateral", start: 1740, end: 2340, kind: "circuit", tone: "hiper", rounds: 3, ex: [
        { id: "latpie", code: "D1", sets: 3, reps: "12-15", tempo: "2-0-1-0", rest: 0, rir: "0-1", load: "2 principales · 2.5 kg c/u" },
        { id: "martillo", code: "D2", sets: 3, reps: "12-15", tempo: "3-0-1-0", rest: 0, rir: "0-1", load: "2 principales · 2.5 kg c/u", follow: "latpie", as: "par" },
        { id: "frances", code: "D3", sets: 3, reps: "10-15", tempo: "3-0-1-0", rest: 30, rir: "0-1", load: "2 principales · 2.5 kg c/u", follow: "latpie", as: "par" }
      ]},
      { id: "E", label: "E", name: "Correctivos y core", start: 2340, end: 2760, kind: "circuit", tone: "control", rounds: 2, ex: [
        { id: "yraise", code: "E1", sets: 2, reps: "12", tempo: "2-0-1-1", rest: 0, rir: "2", load: "2 vinilos (1 kg c/u)" },
        { id: "facepull", code: "E2", sets: 2, reps: "15", tempo: "1-0-1-1", rest: 0, rir: "2", load: "Liga" },
        { id: "planchalat", code: "E3", sets: 2, hold: 30, side: true, rest: 30, load: "Peso corporal" }
      ]},
      { id: "enf", label: "Enf", name: "Enfriamiento", start: 2760, end: 2940, kind: "list", tone: "prep", items: [
        { name: "Pectoral en el marco de la puerta", dose: "45 s por lado", secs: 45, sides: 2, how: "Antebrazo en el marco a la altura del hombro; gira el cuerpo suave hacia el lado contrario." },
        { name: "Muñecas y antebrazos", dose: "30 s", secs: 30, how: "Palmas juntas frente al pecho y bájalas despacio; luego el dorso de las manos." },
        BREATH
      ]}
    ]
  },

  sab: {
    key: "sab", dow: 6, day: "Sábado", short: "Sáb", type: "train", title: "Inferior B: hueso",
    window: "6:15 a 6:35", walk: false, filter: true, next: "dom",
    lead: "Corto y pesado: el hueso responde a carga alta, subida rápida y pocas repeticiones, no a sesiones largas.",
    impact: "Carga para el hueso en 20 minutos: pocas repeticiones, subida rápida y direcciones nuevas.",
    filterMod: "Tu caja un puño más alta en la goblet; el resto igual.",
    prep: ["Al despertar: un plátano y agua", "Filtro de rodilla respondido", "Pantalón largo si hace frío", "Ropa interior de soporte"],
    setup: ["Las 2 principales con 7.5 kg cada una", "Mochila con 5 kg de libros o botellas, al alcance", "Tu caja o silla a tu altura segura", "Un palo de escoba", "Unos 10 m libres para caminar (pasillo o patio)"],
    after: {
      si: ["Desayuno con proteína y calcio antes de la universidad: huevos con caballa o sardina en lata con sus espinas, o tarwi", "En la universidad, subir escaleras rápido de a uno", "Bajar escaleras de a un escalón"],
      no: ["Bajar varios pisos de 2 en 2: fue lo que te molestó", "Acrobacias o saltos espontáneos", "Pensar que hoy entrenaste poco: 20 minutos pesados bastan para el hueso"]
    },
    blocks: [
      { id: "cal", label: "Cal", name: "Calentamiento", start: 0, end: 240, kind: "list", tone: "prep", items: [
        { name: "Puente de glúteo", dose: "10", est: 30, how: "Boca arriba; sube la cadera apretando los glúteos." },
        { name: "Bisagra con palo de escoba", dose: "10", est: 40, how: "Palo apoyado en la cabeza, la espalda alta y el sacro; lleva la cadera atrás sin que el palo se despegue." },
        { name: "Sentadillas a tu caja", dose: "6 lentas", est: 40, how: "Tocas y subes." },
        { name: "Elevaciones de talón", dose: "10", est: 25, how: "Lentas y completas." },
        { name: "Peso muerto rumano ligero", dose: "5", est: 40, how: "Con las dos mancuernas, lento, a medio esfuerzo." }
      ]},
      { id: "H", label: "Circuito", name: "Circuito pesado", start: 240, end: 960, kind: "emom", tone: "fuerza", rounds: 3, interval: 240,
        afterRest: 30, afterNote: "Ponte la mochila y toma las dos mancuernas: sigue la cargada final.", ex: [
        { id: "rdl2p", code: "1", sets: 3, reps: "6", tempo: "2-0-X-0", rest: 0, rir: "2", load: "2 principales · 7.5 kg c/u", follow: "pressmil", as: "par" },
        { id: "goblet", code: "2", sets: 3, reps: "6", tempo: "2-1-X-0", rest: 0, rir: "2-3", load: "1 principal · 7.5 kg + mochila 5 kg", follow: "pressmil", as: "una", where: ", al pecho" },
        { id: "pressmil", code: "3", sets: 3, reps: "6", tempo: "2-0-X-0", rest: 0, rir: "2", load: "2 principales · 7.5 kg c/u" },
        { id: "maleta", code: "4", sets: 3, reps: "20", unit: "pasos", side: true, rest: 0, load: "1 principal · 7.5 kg", follow: "pressmil", as: "una" }
      ]},
      { id: "F", label: "Carga", name: "Cargada final", start: 960, end: 1080, kind: "superset", tone: "fuerza", rounds: 2, ex: [
        { id: "farmer", code: "5", sets: 2, hold: 40, rest: 20, load: "2 principales · 7.5 kg c/u + mochila 5 kg", follow: "pressmil", as: "par" }
      ]},
      { id: "enf", label: "Enf", name: "Enfriamiento", start: 1080, end: 1200, kind: "list", tone: "prep", items: [
        { name: "Dorsal de pie", dose: "45 s", secs: 45, how: "Manos en el respaldo de la silla, cadera atrás, pecho hacia el piso." },
        { name: "Isquiotibiales de pie", dose: "30 s por lado", secs: 30, sides: 2, how: "Talón sobre un escalón bajo, pierna estirada, cadera atrás." }
      ]}
    ],
    phase2: "Fase 2 (tras la evaluación): de 4:00 a 5:00, 10 saltos pequeños aterrizando suave, y el circuito corre de 5:00 a 17:00. En un estudio japonés, 10 saltos al día, tres veces por semana durante seis meses, subieron la densidad del cuello del fémur.",
    stopPlan: {
      title: "Plan sin pierna", lead: "Hoy la rodilla manda: solo press y core. Anótalo; si se repite dos semanas, a evaluación.",
      setup: ["Las 2 principales con 7.5 kg cada una", "Espacio en el piso para el bicho muerto"],
      blocks: [
        { id: "cal", label: "Cal", name: "Calentamiento", kind: "list", tone: "prep", len: 120, items: [UPPER_WARM[0], UPPER_WARM[1]] },
        { id: "A", label: "A", name: "Press y core", kind: "superset", tone: "fuerza", rounds: 3, ex: [
          { id: "pressmil", code: "A1", sets: 3, reps: "6", tempo: "2-0-X-0", rest: 30, rir: "2", load: "2 principales · 7.5 kg c/u" },
          { id: "bichomuerto", code: "A2", sets: 3, reps: "8", side: true, tempo: "Lento", rest: 30, load: "Peso corporal" }
        ]},
        { id: "enf", label: "Enf", name: "Enfriamiento", kind: "list", tone: "prep", len: 60, items: [BREATH] }
      ]
    }
  },

  dom: {
    key: "dom", dow: 0, day: "Domingo", short: "Dom", type: "rest", title: "Descanso total", next: "lun",
    lead: "Cero entrenamiento estructurado: la supercompensación termina hoy. Cinco minutos para el seguimiento de la semana y lo demás es libre.",
    after: {
      si: ["Caminar tranquilo si te provoca", "Seguimiento semanal: 5 min (abajo)", "Preparar la semana: comida y ropa de entrenamiento", "Dormir a tu hora: el lunes empieza fuerte"],
      no: ["Entrenamiento estructurado", "Recuperar una sesión perdida: rompe el espaciado de la rodilla", "Desvelarte"]
    },
    review: true
  }
};

const ORDER = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];

/* Qué figura mostrar en los pasos del calentamiento que repiten un ejercicio (nombre del paso → id de la figura) */
const FIGURA_DE_ITEM = { "Split squat sin peso": "splitsq", "Sentadillas a tu caja": "goblet", "Peso muerto rumano ligero": "rdl2p", "Serie ligera de press Arnold": "arnold", "Flexiones rápidas en la silla": "flexexp", "Elevaciones de talón": "talonpie", "Series de aproximación": "remo1m" };
