/* ══════════════════════════════════════════════════════════════════════════
   LA VOZ DE AGUSTÍN — material grabado por él, transcripto y editado.

   REGLA DE ESTE ARCHIVO, y no es negociable:

     Todo lo que está entre comillas es TEXTUAL. Nada acá se inventó.

   Salió de tres audios que grabó respondiendo cuatro preguntas: por qué enseña,
   un alumno al que le hizo clic un tema, qué pasa en su primera clase, y qué le
   contesta a una madre angustiada. La transcripción completa está en su carpeta.

   La edición se limitó a: cortar muletillas, ordenar frases sueltas y arreglar
   errores de transcripción evidentes. NO se pulieron sus palabras hasta que
   sonaran a folleto — la aspereza es lo que las hace suyas. «Me llena enseñar»
   no se cambia por «siento una profunda vocación docente»: lo segundo lo escribe
   cualquiera, lo primero lo dijo él.

   POR QUÉ ESTO EXISTE. El resto del sitio está bien escrito, pero está escrito
   SOBRE Agustín: es la voz de una buena página de marca, y esa voz la puede
   redactar cualquiera. Lo que faltaba era la única que no se puede fingir. Una
   madre que compara tres profesores no elige por la lista de beneficios: elige
   por la sensación de haber conocido a alguien.

   LO QUE NO ESTÁ ACÁ, Y ES A PROPÓSITO:

   - Las carreras que empezó y dejó. Pidió explícitamente que no fueran al sitio.
   - Cualquier dato que identifique a una alumna: nombre, salud, situación
     escolar. Él pidió no dar nombres porque no tiene el consentimiento, y se
     quitó todo lo demás que la haría reconocerse si entra a la página.
   - El caso del alumno que estuvo siete horas y media seguidas. Él lo contó como
     ejemplo de su compromiso, y lo es. Pero leído por una madre que no lo
     conoce dice otra cosa: un menor con estrés fuerte, sin comer, pidiendo que
     lo vinieran a buscar. No se publica.
   - Testimonios. No hay ninguno hasta que existan reseñas reales.
════════════════════════════════════════════════════════════════════════════ */

/* Lo que escuchan los alumnos de sí mismos antes de llegar.
   Son sus palabras citando a sus alumnos, y es el material más valioso de todo el
   archivo: la madre que lee esto ya se lo escuchó decir a su hijo. Nombrar el
   dolor exacto con las palabras exactas hace más que cualquier promesa. */
export const LO_QUE_SE_ESCUCHAN = [
  "No me da la cabeza.",
  "Algún problema tendré.",
  "No soy como mi hermano.",
];

export const POR_QUE_ENSENO = {
  kicker: "En primera persona",
  title: "Por qué enseño",
  /* El origen, con los dos números para que la cuenta la pueda hacer cualquiera.
     Un dato verificable pesa más que «amplia trayectoria». */
  origen:
    "Empecé a dar clases particulares entre los diecisiete y los dieciocho, más o menos cuando me estaba recibiendo de técnico químico. Hoy tengo veintisiete.",
  parrafos: [
    {
      cita: "Me fascina enseñar. Me apasiona enseñar. Me llena enseñar.",
      /* La repetición es de él y se conserva. Pulirla a una sola frase la volvería
         correcta y la dejaría sin nada. */
    },
    {
      cita:
        "Lo que más me pone contento es ver a los padres, a los tutores, a los abuelos, a los hermanos, con una sonrisa de par en par.",
    },
    {
      cita:
        "Hay chicos y chicas que además de que les vaya bien lograron construir vínculos. No es solo lo académico.",
    },
  ],
  /* El eslogan ya vive en BRAND.tagline; acá se explica de dónde salió, que es lo
     que lo convierte en una idea y no en una frase bonita. */
  cierre:
    "Por eso uno de mis eslóganes es «juntos, despejando el camino a la meta».",
};

/* EL DIFERENCIAL REAL, y es contracomercial: su objetivo declarado es que dejes de
   necesitarlo. Nadie en este rubro dice esto porque a nadie le conviene decirlo, y
   por eso se cree. Va respaldado por un hecho, no por un adjetivo. */
export const LA_AUTONOMIA = {
  kicker: "Cómo trabajo",
  title: "Mi meta es que dejes de necesitarme",
  citas: [
    "Mi meta no es que la misma persona me busque un montón de veces y no se pueda liberar de mí. La idea es que alcance la autonomía y justamente se libere de mí.",
    "No los ato a mí. No me gusta tener alumnos encadenados.",
    "Yo soy un guía, un facilitador. Que puedas ir avanzando con soltura, con libertad, con tus propias capacidades.",
  ],
  /* La prueba. Es un hecho que él contó, y el encuadre —«se fueron y eligieron
     volver»— es la lectura honesta de ese hecho: si estuvieran atados no se habrían
     ido, y si no hubieran quedado conformes no habrían vuelto. */
  prueba:
    "Hay alumnos que volvieron después de cuatro y cinco años, para otra materia. No porque hayan quedado atados: se fueron, y eligieron volver.",
};

export const COMO_EXPLICO = {
  kicker: "El método",
  title: "Si de una manera no llegó, hay que buscar otra",
  citas: [
    "Un tema lo explico de mil maneras distintas. Nunca lo explico de la misma forma, porque si de alguna manera no llegó, hay que buscar de otra.",
    "El proceso de aprendizaje es individual de cada uno. Es singular.",
    "Me preparo con antelación: veo los temas, me informo, analizo todo. El día de la clase estoy completamente preparado.",
  ],
};

/* LA PRIMERA CLASE. Baja la ansiedad de quien no sabe qué está comprando, y por eso
   va contada como una secuencia y no como una promesa. */
export const PRIMERA_CLASE = {
  kicker: "La primera clase",
  title: "Qué pasa cuando nos sentamos",
  pasos: [
    {
      titulo: "Primero hablamos",
      texto:
        "«Cómo estás, cómo te sentís, es tu primera vez.» Antes de abrir una carpeta.",
    },
    {
      titulo: "Miramos la carpeta",
      texto:
        "«Mostrame lo que estuvieron viendo.» Ahí se ve dónde quedó floja la cadena, y si la carpeta está incompleta, eso también es información.",
    },
    {
      titulo: "Se trabaja desde el primer día",
      texto:
        "No es una clase de diagnóstico y nada más: se avanza con ejercicios y actividades. El diagnóstico sale de ahí, mientras se trabaja.",
    },
    {
      titulo: "Se busca cómo aprendés vos",
      texto:
        "Si te sirve más lo visual o lo escrito, si necesitás más acompañamiento o resolver por tu cuenta. De eso depende todo lo que viene.",
    },
  ],
  /* Detalle que ninguna página de clases particulares menciona, y que resuelve una
     preocupación concreta de madres y padres. Es literal de él. */
  puertaAbierta:
    "«He tenido mamás que necesitaban acompañar a su hijo y me pidieron pasar. Tengo toda la transparencia del mundo: puedo dar clase perfectamente aunque me estén mirando, y de hecho lo disfruto.»",
};

/* EL CASO. Despersonalizado hasta donde hace falta para que no se reconozca.
   Se quitaron: el nombre, la salud, la situación escolar, el orden exacto de las
   materias y los años. Queda el MÉTODO, que es lo que sirve — y que además es
   verificable en la primera clase, así que no es una promesa que haya que creer. */
export const EL_CASO = {
  kicker: "Un caso real",
  title: "Cinco materias, varios años, la misma alumna",
  entrada:
    "Llegó pensando que no le daba la cabeza. Lo que la sacó de ahí no fue motivación: fue método.",
  metodo: [
    "Letra más grande y prolija: venía escribiendo muy chico.",
    "Colores y resaltador, y la hoja dividida.",
    "Los datos importantes marcados, para tener claridad al arrancar.",
    "Los resultados resaltados y en lapicera, para que el profesor vea dónde está el resultado y cómo llegó.",
    "El ejercicio en lápiz, el resultado en lapicera.",
    "Y seguir el método que da el profesor del colegio: hay docentes que no aprueban si no reproducís el suyo, aunque el resultado esté bien.",
  ],
  /* El cierre conecta el caso con la autonomía, que es el eje de todo. */
  cierre:
    "Descubrimos que primero necesitaba un guía que le mostrara el paso a paso, para después resolver sola. Volvió por cinco materias distintas, en años distintos.",
};

/* LO QUE LE DICE A UNA MADRE ANGUSTIADA. La segunda cita es la más importante de
   todo el archivo: alguien que te dice cuándo NO puede ayudarte es alguien a quien
   le podés creer cuando dice que sí. */
export const A_UNA_MADRE = {
  kicker: "Si estás preocupada",
  title: "Qué le contesto a una madre angustiada",
  citas: [
    "Una mamá angustiada necesita escuchar que su hijo realmente puede. Que se quede tranquila, que llegó al lugar correcto.",
    "Yo veo el caso y sé si realmente puedo ayudar. Y si no, lo digo con la mano en el corazón.",
    "No soy un profesor más que brinda contenido, lo explica y ya está.",
  ],
};

/* CÓMO COBRA. Va acá y no en la sección de precios porque no habla de números:
   habla de carácter. Es la contracara de la frase «nunca me aprovecho de que están
   complicados» — cada línea es un recargo que el rubro cobra y él no. */
export const COMO_COBRO = {
  kicker: "Sin letra chica",
  title: "Lo que no te cobro",
  cita:
    "Nunca cobro de más ni me aprovecho de que están complicados. Cobro lo que vale realmente.",
  items: [
    {
      titulo: "Sin recargo por fin de semana",
      texto: "Doy sábados y domingos al mismo precio.",
    },
    {
      titulo: "Sin recargo por urgencia",
      texto: "Faltan tres días para el examen y vale lo mismo.",
    },
    {
      titulo: "Sin recargo por llegar sin la carpeta",
      texto: "Si está incompleta o desordenada, lo ordenamos. No cuesta más.",
    },
    {
      titulo: "Sin adelanto ni seña",
      texto: "No se paga nada antes de la clase.",
    },
  ],
};

/* FORMACIÓN. Sólo lo verificable y lo que él autorizó publicar.
   Nada de «amplia experiencia» ni títulos que no tiene: el que está en curso se
   describe como en curso, con la precisión con la que él lo dijo. */
export const FORMACION = [
  {
    titulo: "Técnico Químico",
    detalle: "Escuela Técnica N.º 3, Temperley.",
  },
  {
    titulo: "Tramo de formación pedagógica y didáctica",
    detalle: "Universidad FASTA.",
  },
  {
    titulo: "Licenciatura en Ciencias de la Educación",
    detalle:
      "Universidad Abierta Interamericana. Cursando, vinculada a la psicopedagogía.",
  },
  {
    titulo: "Profesor Universitario en Ciencias de la Educación",
    /* Sus palabras exactas fueron «está a tres materias y un final». Se publica así
       y no «se recibe en diciembre»: lo segundo es una fecha que puede correrse, y
       una credencial que no se cumple hace más daño que una que no se anunció. */
    detalle: "A tres materias y un final de recibirse.",
  },
  {
    titulo: "Ponencia: «Los afectos en la educación. Gozar de aprender»",
    detalle:
      "Presentada en la Universidad Abierta Interamericana, en coautoría.",
  },
];
