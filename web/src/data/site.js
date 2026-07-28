/* ══════════════════════════════════════════════════════
   Datos del sitio — ÚNICA fuente de verdad.

   Todo lo que hay acá es información REAL y verificada del emprendimiento:
   materias y niveles que se dictan, ubicación, contacto y las condiciones que
   ya se comunican en la app de turnos (sin adelanto, primera clase de
   diagnóstico, gestión con enlace seguro). Los años de experiencia los
   confirmó Agustín.

   No hay testimonios ni precios porque no se cuenta con datos reales: cuando
   existan, se agregan acá y las secciones los toman solas.
══════════════════════════════════════════════════════ */

export const BOOKING_URL = "https://turnos.tuprofesorparticular.com.ar";
export const BOOKING_MANAGE_URL = `${BOOKING_URL}/portal`;

export const CONTACT = {
  whatsappNumber: "5491164236675",
  whatsappDisplay: "+54 9 11 6423-6675",
  email: "agustinsosa.profe@gmail.com",
  addressLine: "Jujuy 414, Temperley",
  region: "Buenos Aires, Argentina",
  mapsUrl: "https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires",
};

export const waLink = (message) =>
  `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;

export const BRAND = {
  name: "Tu Profesor Particular",
  person: "Agustín Elías Sosa",
  tagline: "Juntos, despejando el camino a la meta.",
  claim: "Entendé de verdad, no de memoria",
  yearsTeaching: 8,
};

export const SUBJECTS = [
  {
    slug: "matematicas",
    label: "Matemáticas",
    tagline: "No sos malo en matemáticas.",
    hook: "Nunca te las explicaron bien.",
    detail:
      "Aritmética, álgebra, funciones, trigonometría y análisis. Trabajamos la base primero: sin base, cada tema nuevo se apoya en el aire.",
    color: "#1a3a6b",
    ink: "#8fb4e8",
  },
  {
    slug: "fisica",
    label: "Física",
    tagline: "La física tiene lógica interna.",
    hook: "Cuando la encontrás, todo encaja solo.",
    detail:
      "Cinemática, dinámica, energía, electricidad y magnetismo. Menos fórmulas de memoria y más entender qué está pasando en el problema.",
    color: "#a34a08",
    ink: "#f09a55",
  },
  {
    slug: "fisicoquimica",
    label: "Fisicoquímica",
    tagline: "El filtro más duro de cualquier carrera.",
    hook: "Con la guía correcta, se vuelve la más lógica.",
    detail:
      "El puente entre física y química: estructura de la materia, gases, soluciones y termodinámica básica.",
    color: "#5b21b6",
    ink: "#c4a5f5",
  },
  {
    slug: "quimica",
    label: "Química",
    tagline: "Basta de memorizar sin entender.",
    hook: "La química tiene reglas — y tienen sentido.",
    detail:
      "Nomenclatura, reacciones, estequiometría y soluciones. Primero el por qué, después la tabla.",
    color: "#065f46",
    ink: "#5fd4a8",
  },
  {
    slug: "ingles",
    label: "Inglés",
    tagline: "No es talento. Es método.",
    hook: "Y el miedo a hablar se trabaja, no se espera.",
    detail:
      "Gramática, comprensión de texto y práctica oral, al ritmo de lo que necesitás rendir o usar.",
    color: "#1e3a5f",
    ink: "#8ab6de",
  },
];

export const LEVELS = [
  {
    label: "Primaria",
    desc: "Bases sólidas desde el principio. Acompañamiento en las materias troncales, con paciencia y sin apurar etapas.",
  },
  {
    label: "Secundaria",
    desc: "El tramo donde más se necesita claridad. Matemática, Física, Química y más, alineado a lo que te toman en clase.",
  },
  {
    label: "Secundaria Técnica",
    desc: "Las materias técnicas con su lógica propia: dibujo, electricidad, electrónica, mecánica y las ciencias que las sostienen.",
  },
  {
    label: "Terciario / Superior",
    desc: "Formación docente y carreras superiores: pedagogía, didáctica, metodología de la investigación y más.",
  },
  {
    label: "Universitario",
    desc: "El filtro de los primeros años: Análisis, Álgebra, Física, Química, Estadística y las materias que frenan a todos.",
  },
];

/* Cómo se trabaja. Cada paso describe algo que efectivamente pasa: la primera
   clase de diagnóstico, el plan, el seguimiento y la gestión del turno. */
export const METHOD = [
  {
    index: "01",
    title: "Primero entendemos dónde estás",
    desc: "La primera clase es de diagnóstico: vemos qué sabés, qué se dio por sabido y dónde se rompió la cadena. Sin juzgar y sin saltear pasos.",
  },
  {
    index: "02",
    title: "Armamos un plan concreto",
    desc: "Con el diagnóstico sobre la mesa definimos qué trabajar y en qué orden, según la fecha que tengas encima: una prueba, un final o ponerte al día.",
  },
  {
    index: "03",
    title: "Clases con orden y cercanía",
    desc: "Cada clase tiene un objetivo claro. Explico hasta que el tema hace clic, y practicamos con ejercicios parecidos a los que te van a tomar.",
  },
  {
    index: "04",
    title: "El avance queda registrado",
    desc: "Cada sesión se anota: en qué punto estás, qué mejoró y qué viene. El progreso deja de ser una sensación y se vuelve algo concreto.",
  },
];

/* Diferenciales reales, todos verificables en cómo funciona el servicio. */
export const REASONS = [
  {
    title: "Sin pagos por adelantado",
    desc: "No hay contratos ni señas. La primera clase es de diagnóstico: si no sentís que avanzaste, no volvés.",
  },
  {
    title: "Online o presencial, vos elegís",
    desc: "Por videollamada desde donde estés, o presencial en Temperley. Se elige en cada reserva, según te quede cómodo.",
  },
  {
    title: "Reservás en menos de un minuto",
    desc: "Sin registro ni contraseña. Elegís materia, modalidad y horario, y listo.",
  },
  {
    title: "Reprogramás cuando la vida cambia",
    desc: "Cada reserva viene con un enlace seguro para reprogramar o cancelar sin llamadas ni trámites.",
  },
];

export const FAQS = [
  {
    q: "¿Cómo reservo una clase?",
    a: "Desde el sistema de turnos: elegís la materia, la modalidad y el horario en menos de un minuto, sin registro ni contraseña. Al confirmar recibís un código y un enlace seguro para gestionar tu turno.",
  },
  {
    q: "¿Las clases son online o presenciales?",
    a: "Las dos. Online por videollamada, o presencial en Temperley, Buenos Aires. Elegís la que te quede cómoda al reservar.",
  },
  {
    q: "¿Qué materias y niveles das?",
    a: "Matemáticas, Física, Fisicoquímica, Química e Inglés como principales, y muchas otras a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  },
  {
    q: "¿Tengo que pagar por adelantado?",
    a: "No. Sin adelanto y sin compromiso. La primera clase es de diagnóstico: si no sentís que avanzaste, no volvés.",
  },
  {
    q: "¿Puedo reprogramar o cancelar?",
    a: "Sí, cuando quieras, desde el enlace seguro de gestión que recibís al reservar. Sin llamadas ni trámites.",
  },
  {
    q: "¿Y si mi materia no está en la lista?",
    a: "Escribime por WhatsApp y lo vemos juntos. Doy varias materias además de las principales; si no puedo ayudarte, te lo digo de entrada.",
  },
];
