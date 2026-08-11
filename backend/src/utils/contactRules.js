import { z } from "zod";

/* Validación del formulario de contacto del sitio institucional.
 *
 * Vive aparte de bookingRules.js porque no comparte nada con una reserva: no
 * toca la agenda, no crea un turno y no se guarda. Es un mensaje que se reenvía
 * por email y se olvida.
 */

/* Las mismas opciones que ofrecen los radios del formulario. Cerradas y no texto
   libre: este valor termina en el asunto del email, y aceptar cualquier cosa ahí
   deja que un visitante escriba el asunto de un correo que sale del servidor. */
export const CONTACT_SUBJECTS = Object.freeze({
  clases: "Consulta por clases",
  horarios: "Consulta por horarios y disponibilidad",
  precios: "Consulta por precios",
  otro: "Otra consulta",
});

/* Un salto de línea en un campo que va al encabezado de un mail permite agregar
   encabezados propios —un Bcc, por ejemplo— y usar el servidor para mandar
   correo a terceros. Se limpian antes de validar la longitud: si no, un nombre
   lleno de saltos podría pasar el mínimo y llegar vacío al mail. */
const sinSaltos = (valor) =>
  typeof valor === "string" ? valor.replace(/[\r\n\t]+/g, " ").trim() : valor;

const nombre = z.preprocess(sinSaltos, z.string().min(2).max(80));

/* z.string().email() y no una expresión propia: no hace falta que sea perfecta
   —el email real se valida cuando el profesor responde y le llega o no— sino que
   descarte lo que evidentemente no es una dirección. */
const email = z.preprocess(sinSaltos, z.string().email().max(160));

/* Opcional de verdad: quien no quiere dejar el teléfono no tiene por qué. Por eso
   el formulario propio existe. */
const telefono = z.preprocess(
  sinSaltos,
  z.string().max(40).optional().default(""),
);

/* Mínimo 10 caracteres: un "hola" suelto deja al profesor sin nada que
   responder, y obliga a un ida y vuelta que el formulario venía a evitar.
   Máximo 5000: alcanza de sobra para contar una situación completa. */
const mensaje = z.string().trim().min(10).max(5000);

/* El campo trampa. Un input escondido que una persona nunca ve y que los bots
   completan porque rellenan todo lo que encuentran. Es la protección más barata
   que existe y no le pide NADA al visitante: ni captcha, ni acertijos, ni
   esperar. Si viene con algo, el pedido se rechaza.
   Se llama `website` porque es un nombre que un bot espera encontrar. */
const trampa = z.string().max(200).optional().default("");

export const contactMessageSchema = z
  .object({
    name: nombre,
    email,
    phone: telefono,
    subject: z.enum(Object.keys(CONTACT_SUBJECTS)),
    message: mensaje,
    website: trampa,
  })
  /* Estricto: si el formulario cambia y empieza a mandar un campo nuevo, es mejor
     que falle acá que que llegue un dato sin validar al cuerpo de un email. */
  .strict();

export const subjectLabel = (subject) =>
  CONTACT_SUBJECTS[subject] ?? CONTACT_SUBJECTS.otro;
