/* Preguntas frecuentes de la portada de turnos. Viven acá y no en el
   componente porque las leen dos: FaqSection (lo que se ve) y el JSON-LD de
   Google (components/seo/grafoEstructurado.js), que tiene que decir
   exactamente lo mismo que la página.

   Contenido 100% real, derivado de cómo funciona el servicio (nada inventado): modalidad, sin adelanto, cómo se reserva, gestión
   con enlace seguro, materias/niveles, primera clase de diagnóstico. */
export const FAQS = [
  {
    q: "¿Cómo reservo una clase?",
    a: "Elegís la materia, la modalidad y el turno, sin registro ni contraseña, y ves el precio antes de dejar tus datos. Al confirmar recibís un código y un enlace seguro para gestionar tu turno.",
  },
  {
    q: "¿Las clases son online o presenciales?",
    a: "Las dos. Online por videollamada, o presencial en Temperley, Buenos Aires. Elegís la que te quede cómoda en el momento de reservar.",
  },
  {
    q: "¿Qué materias y niveles das?",
    a: "Matemáticas, Física, Fisicoquímica, Química e Inglés como principales — y muchas otras a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  },
  {
    q: "¿Tengo que pagar por adelantado?",
    a: "No. Sin adelanto y sin compromiso. La primera clase es de diagnóstico: si no sentís que avanzaste, no volvés.",
  },
  {
    q: "¿Puedo reprogramar o cancelar?",
    a: "Sí, cuando quieras, desde tu enlace seguro de gestión. Sin llamadas ni trámites: reprogramás o cancelás en un par de toques.",
  },
  {
    q: "¿Cómo es la primera clase?",
    a: "Es de diagnóstico: entendemos desde dónde partís y qué necesitás, y armamos un plan concreto para las próximas clases.",
  },
];
