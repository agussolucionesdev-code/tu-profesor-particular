/* ══════════════════════════════════════════════════════════════════════════
   PRUEBA — lo que se puede verificar, y los testimonios cuando existan.

   REGLA DE ESTE ARCHIVO, y no es negociable:

     Acá no entra nada que no haya pasado. Ni un testimonio compuesto, ni un
     número redondeado para arriba, ni una frase que "podría haber dicho".

   POR QUÉ EXISTE

   Una madre que compara tres profesores busca una cosa antes que ninguna otra:
   quién más lo eligió. Es el hueco más grande que le queda al sitio, y es el
   único que no se puede tapar escribiendo mejor.

   Se podía resolver de dos maneras. Una era inventar cuatro tarjetas de cinco
   estrellas firmadas "Mariana G.". Funciona el primer día y no funciona nunca
   más: quien lee ya vio mil paredes de testimonios falsos y las descuenta
   enteras —y si además le pasa a un alumno real, el daño ya no se arregla—.

   La otra es la de acá: publicar la prueba que SÍ existe, decir en voz alta que
   todavía no hay testimonios, y construir el mecanismo para conseguirlos de
   verdad. Ese mecanismo vive en el panel de turnos, en la vista de alumnos.

   LO QUE HAY ACÁ NO ES "PRUEBA SOCIAL" EN SENTIDO ESTRICTO, y conviene decirlo:
   de los cuatro hechos, sólo el primero —los que volvieron— es comportamiento de
   otros. Los otros tres son credibilidad y reversión de riesgo. Se ponen juntos
   porque responden la misma pregunta del lector ("¿por qué te creería?"), y
   porque prometer prueba social que no se tiene es empezar mintiendo.

   NINGÚN HECHO DE ACÁ ES NUEVO. Los cuatro ya estaban publicados en el sitio,
   dispersos: dos salen de sus audios (`voz.js`), uno de `site.js` y uno de las
   condiciones de trabajo. Esto no agrega afirmaciones: las junta donde el lector
   las está buscando.
════════════════════════════════════════════════════════════════════════════ */

/* ── TESTIMONIOS ────────────────────────────────────────────────────────────
   Hoy está vacío, y eso es un estado válido y correcto: las secciones que lo
   usan no renderizan nada cuando no hay nada. No hay hueco visual que tapar.

   PARA AGREGAR UNO hace falta, sin excepción:

   1. Que la persona lo haya escrito ella. No se transcribe una charla ni se
      arma con lo que dijo por teléfono.
   2. Que haya dado permiso EXPLÍCITO para publicarlo, y que ese permiso esté
      registrado en `permiso` —fecha, canal y hasta dónde llega—.
   3. Que el texto vaya TAL CUAL. Se puede recortar (con […]) y corregir un
      error de tipeo. No se reescribe, no se "mejora", no se le saca el "jaja".
   4. Que `nombre` sea `null` salvo que haya autorizado su nombre POR SEPARADO,
      y en ese caso que `permiso.incluyeNombre` sea `true`. Autorizar el texto NO
      es autorizar el nombre: son dos preguntas y hay que hacer las dos.
   5. Que no identifique a un menor: ni nombre, ni colegio, ni curso y materia
      juntos, ni nada sobre su salud o su situación familiar.

   El punto 2 es la razón de que `permiso` sea un campo obligatorio y no una
   nota al pie: así no se puede construir un testimonio válido sin haber
   registrado el permiso. `tests/prueba.test.js` rechaza cualquiera al que le
   falte, y el build del sitio falla. Es la única forma de que la regla siga en
   pie dentro de dos años, cuando esto lo edite alguien que no leyó esto.
   ────────────────────────────────────────────────────────────────────────── */
export const TESTIMONIOS = [];

export const hayTestimonios = () => TESTIMONIOS.length > 0;

/* La regla de arriba, escrita como código.
 *
 * Existe porque una regla que sólo vive en un comentario dura lo que dura la
 * paciencia del que tiene apuro. Esta corre en CI antes del build: un testimonio
 * mal cargado no llega a producción, llega a un test en rojo.
 *
 * Devuelve la lista de problemas —texto, para poder leerlos— o un array vacío.
 *
 * Lo que NO puede verificar, y hay que decirlo: que el permiso sea cierto. Nada
 * acá distingue una fecha real de una inventada. Lo que sí garantiza es que
 * publicar sin permiso exija MENTIR a propósito en un campo obligatorio, en vez
 * de simplemente olvidarse. Esa diferencia es todo lo que un test puede dar. */
export const problemasDelTestimonio = (t) => {
  const problemas = [];
  if (!t || typeof t !== "object") return ["El testimonio tiene que ser un objeto."];

  const texto = typeof t.texto === "string" ? t.texto.trim() : "";
  if (!texto) problemas.push("Falta el texto.");
  /* Un umbral bajo, sólo para atajar el campo pegado a medias. No hay máximo:
     si alguien escribió seis líneas, se publican las seis. */
  else if (texto.length < 20) problemas.push("El texto es demasiado corto para ser real.");

  if (!String(t.quien ?? "").trim()) {
    problemas.push("Falta `quien`: quién lo dice, sin nombre (\"Mamá de un alumno de 3°\").");
  }

  /* `nombre` tiene que estar DECLARADO aunque sea null. Si falta la clave, no se
     sabe si nadie lo autorizó o si alguien se olvidó de preguntarlo, y esas dos
     cosas no se pueden confundir. */
  if (!Object.hasOwn(t, "nombre")) {
    problemas.push("Falta `nombre`. Poné `null` si no autorizó que aparezca su nombre.");
  }

  const permiso = t.permiso;
  if (!permiso || typeof permiso !== "object") {
    problemas.push("Falta `permiso`. Sin permiso registrado no se publica.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(permiso.fecha ?? ""))) {
      problemas.push("`permiso.fecha` tiene que ser una fecha AAAA-MM-DD.");
    }
    if (!String(permiso.canal ?? "").trim()) {
      problemas.push("`permiso.canal` tiene que decir por dónde lo autorizó.");
    }
    if (!String(permiso.alcance ?? "").trim()) {
      problemas.push("`permiso.alcance` tiene que decir qué autorizó a publicar.");
    }

    /* El error más fácil de cometer: pedir permiso para el texto y publicar el
       nombre. Son dos permisos distintos y esto los mantiene separados.

       ES UN BOOLEANO Y NO SE DEDUCE DE `alcance`. La primera versión buscaba la
       palabra "nombre" dentro del texto de `alcance`, y el test la volteó en el
       primer intento: «el texto, sin nombre» contiene "nombre" y pasaba el
       control. Cualquier variante de esa idea tiene el mismo agujero —"sin",
       "excepto", "salvo"— porque interpretar prosa en castellano para decidir
       una cuestión de privacidad es la herramienta equivocada.
       `alcance` queda como el registro legible de lo que la persona autorizó;
       esta bandera es la que decide, y hay que ponerla a mano. */
    if (t.nombre && permiso.incluyeNombre !== true) {
      problemas.push(
        "Hay un nombre publicado y `permiso.incluyeNombre` no es `true`. Autorizar el texto no es autorizar el nombre.",
      );
    }
  }

  return problemas;
};

/* ── LO QUE SE PUEDE VERIFICAR ──────────────────────────────────────────────
   Cuatro hechos, uno por cada eje sobre el que una madre evalúa a un profesor:
   conducta de otros, tiempo, carácter y competencia. Ninguno se repite con otra
   sección de la portada.

   El orden no es casual. Primero el único que es comportamiento de OTRAS
   PERSONAS —lo más cerca de prueba social que hay hoy—, porque es lo que se vino
   a buscar; la formación va última porque respalda, no convence.

   TODO EN PRIMERA PERSONA, como el lead y como el resto del sitio. La primera
   versión mezclaba —«Empezó», «Mira el caso»— y quedaba un bloque que hablaba
   de Agustín en medio de una página en la que Agustín habla. Se vio recién
   renderizado, que es donde se ven estas cosas. */
export const HECHOS = [
  {
    dato: "Alumnos que volvieron a los cuatro y cinco años",
    /* Textual de él, en `voz.js` como `LA_AUTONOMIA.prueba`. Es el hecho más
       fuerte del sitio y casi nadie lo puede decir: retención medida en años,
       de gente que no tenía ninguna obligación de volver. */
    detalle:
      "Para otra materia, y sin que nadie los atara: se fueron, y eligieron volver.",
  },
  {
    dato: "Más de ocho años enseñando",
    detalle:
      "Empecé entre los diecisiete y los dieciocho, un poco antes de recibirme de técnico químico. La cuenta la puede hacer cualquiera.",
  },
  {
    dato: "Digo que no cuando no puedo ayudarte",
    /* La cita completa está en `voz.js` (`A_UNA_MADRE`). Acá va el hecho, no la
       frase: repetir la cita textual a dos secciones de distancia la gasta. */
    detalle:
      "Miro el caso antes de tomarlo. Si no es para mí, te lo digo — y te ahorro la clase y la plata.",
  },
  {
    dato: "Técnico químico, y a tres materias de profesor universitario",
    /* El primer candidato para este lugar era «no cobra por adelantado», y se
       descartó: eso YA está publicado dos secciones más arriba, en las condiciones
       de trabajo. Repetirlo a esa distancia no refuerza, rellena.
       La formación, en cambio, sólo estaba en /sobre-mi, y responde el eje que
       faltaba: los otros tres hechos hablan de conducta, tiempo y carácter; ninguno
       decía si además sabe.
       «A tres materias y un final» son sus palabras exactas. No se redondea a «está
       por recibirse»: una credencial anunciada y no cumplida hace más daño que una
       que no se anunció. */
    detalle:
      "Me recibí en la Escuela Técnica N.º 3 de Temperley. De la carrera docente, en Ciencias de la Educación, estoy a tres materias y un final.",
  },
];

/* ── LA NOTA SOBRE LOS TESTIMONIOS ──────────────────────────────────────────
   Va al FINAL de la sección y en tamaño chico, deliberadamente.

   Arrancar diciendo "no tengo testimonios" le planta la ausencia al lector
   antes de que la note. Pero omitirla del todo tampoco sirve: en un sitio de
   clases particulares, los testimonios son lo primero que se busca, así que la
   ausencia se nota igual. La única jugada que queda es no abrir con eso y
   explicarla cuando ya leyó la prueba.

   Y explicada así, la ausencia deja de ser un agujero y pasa a ser coherente
   con el resto: es el mismo tipo que avisa cuando no puede ayudarte.

   El texto no promete una fecha ni dice "muy pronto". Promete un método. */
export const NOTA_TESTIMONIOS = {
  titulo: "¿Y los testimonios?",
  texto:
    "Todavía no hay ninguno publicado acá, y no voy a inventar uno. Cuando un alumno o una madre me autoricen a publicar lo que me escribieron, va a estar en esta página tal cual me lo escribieron.",
};

export const PRUEBA = {
  kicker: "Antes de decidir",
  title: "Lo que se puede verificar",
  /* En positivo y sin mencionar la ausencia: la nota de abajo ya se ocupa. */
  lead: "No hace falta que me creas de entrada. Esto se puede comprobar.",
  hechos: HECHOS,
  nota: NOTA_TESTIMONIOS,
};
