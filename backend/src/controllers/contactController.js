import { sendContactMessage } from "../config/mailer.js";
import { contactMessageSchema, subjectLabel } from "../utils/contactRules.js";

/* Formulario de contacto del sitio institucional.
 *
 * /contacto era 100% enlaces salientes: WhatsApp, email, mapa. Quien no quiere
 * abrir WhatsApp —o está en una computadora ajena, o no quiere dar su teléfono
 * todavía— no tenía forma de dejar sus datos y se iba.
 *
 * Este controlador NO guarda nada. Un mensaje de contacto no es una reserva:
 * guardarlo crearía una segunda pila de datos personales que nadie mira y que
 * habría que borrar después. Se valida, se reenvía por email y se olvida.
 */
export const submitContactMessage = async (req, res, next) => {
  try {
    const parsed = contactMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Revisá los datos del formulario y volvé a intentar.",
        requestId: req.requestId,
      });
    }

    const { name, email, phone, subject, message, website } = parsed.data;

    /* El campo trampa vino con algo: es un bot. Se corta acá, sin mandar mail.
       La respuesta es 400 con el MISMO mensaje que un error de validación
       cualquiera, a propósito: si dijera "detectamos un campo oculto", el
       próximo intento lo dejaría vacío y la trampa dejaría de servir. */
    if (website.trim().length > 0) {
      return res.status(400).json({
        success: false,
        message: "Revisá los datos del formulario y volvé a intentar.",
        requestId: req.requestId,
      });
    }

    await sendContactMessage({
      name,
      email,
      phone,
      subjectLabel: subjectLabel(subject),
      message,
    });

    /* La respuesta no devuelve lo que llegó. Un endpoint que hace de espejo deja
       probar payloads con su propia salida, y acá no aporta nada. */
    return res.status(200).json({
      success: true,
      message: "Mensaje enviado. Agustín te va a responder a la brevedad.",
      requestId: req.requestId,
    });
  } catch (error) {
    /* Un fallo de envío no es culpa de quien escribió, así que el mensaje ofrece
       la salida que sí funciona seguro: WhatsApp. */
    console.error("[contact]", error.message);
    if (typeof next === "function" && !error.message.includes("correo")) {
      return next(error);
    }
    return res.status(502).json({
      success: false,
      message:
        "No pudimos enviar el mensaje ahora mismo. Probá de nuevo en un momento o escribinos por WhatsApp.",
      requestId: req.requestId,
    });
  }
};
