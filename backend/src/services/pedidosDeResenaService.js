import Booking from "../models/Booking.js";
import Student from "../models/Student.js";

/* ══════════════════════════════════════════════════════════════════════════
   A QUIÉN PEDIRLE UNA RESEÑA.

   El sitio institucional dice, en la sección "Lo que se puede verificar", que
   todavía no hay testimonios y que cuando alguien autorice uno va a estar ahí.
   Este servicio es la mitad que hace que esa frase no sea una promesa vacía.

   POR QUÉ NO ES UN MAIL AUTOMÁTICO, que era la opción obvia:

   1. EL MAIL ES OPCIONAL AL RESERVAR. El modelo sólo exige "email o teléfono"
      (`Booking.js`), así que una parte de los clientes no tiene mail cargado.
      Una campaña por mail no los alcanzaría nunca, y son justamente los que más
      confianza tienen —los que reservaron por WhatsApp de toda la vida—.

   2. EL CANAL DEL NEGOCIO ES WHATSAPP. Un pedido personal por el canal donde ya
      se hablan convierte muchísimo más que un mail automático, que además llega
      con cara de sistema justo cuando lo que se pide es un favor personal.

   3. EL PROYECTO ENTERO VA EN LA DIRECCIÓN CONTRARIA. Se acaba de trabajar para
      que se note que atrás hay una persona. Automatizar el pedido de reseñas
      sería lo primero que delataría lo contrario.

   Así que esto NO manda nada. Arma la lista, la ordena, y el panel le da a
   Agustín un mensaje listo para que lo mande él desde su WhatsApp. La máquina
   se ocupa de acordarse; la persona se ocupa de pedir.

   QUÉ CUENTA COMO CANDIDATO: alguien con al menos `minimoClases` clases marcadas
   "Presente". Se usa la asistencia y no la cantidad de reservas a propósito —una
   reserva cancelada o a la que no vino no es una experiencia sobre la que
   opinar—, y ese dato ya lo carga Agustín en la agenda, así que no hay que
   pedirle nada nuevo.
══════════════════════════════════════════════════════════════════════════ */

/* Dos y no tres. Alguien que vino dos veces ya tomó la decisión que importa:
   volver. Con tres, un profesor que recién arranca con un alumno nuevo por mes
   ve la lista vacía durante medio año y deja de abrir la pantalla.
   Es igual un piso, no una regla: el panel muestra cuántas clases hizo cada uno
   y la decisión de a quién pedirle sigue siendo de él. */
export const MINIMO_CLASES_POR_DEFECTO = 2;

/* Los dos estados que sacan a alguien de la lista para siempre, por motivos
   distintos:

   - "no quiere": dijo que no. Un "no" que hay que repetir todos los meses no es
     un "no" respetado, y además es la forma más rápida de perder a un alumno que
     estaba contento. Ni siquiera `incluirPedidas` lo trae de vuelta.
   - "publicada": ya la dio y está publicada. No es un candidato, es un caso
     cerrado; pedírsela de nuevo sólo confunde.

   "pedida" es distinto: ese sí vuelve con `incluirPedidas`, porque a los tres
   meses volver a preguntar es razonable. */
const ESTADOS_TERMINALES = ["no quiere", "publicada"];

const limitarEntero = (valor, { minimo, maximo, porDefecto }) => {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) return porDefecto;
  return Math.min(Math.max(numero, minimo), maximo);
};

/* Las clases que efectivamente ocurrieron, por alumno.
   Una sola agregación: agrupa por `studentId` contando las "Presente" y se queda
   con la fecha de la última. Filtra por `attendanceStatus` DENTRO del $match para
   que el índice haga el trabajo y no se traiga toda la colección a memoria. */
const clasesPresentesPorAlumno = async () => {
  const filas = await Booking.aggregate([
    { $match: { deletedAt: null, attendanceStatus: "Presente", studentId: { $ne: null } } },
    {
      $group: {
        _id: "$studentId",
        clasesDadas: { $sum: 1 },
        ultimaClase: { $max: "$timeSlot" },
        materias: { $addToSet: "$subject" },
      },
    },
  ]);
  return filas;
};

/* Devuelve los alumnos a los que tiene sentido pedirles una reseña, ordenados
   por cuántas clases hicieron.
 *
 * El orden es deliberado y no es "el más reciente primero": quien hizo doce
 * clases tiene doce veces más para contar que quien hizo dos, y su reseña vale
 * más aunque la última haya sido en marzo. La fecha viaja igual en cada fila,
 * así que si hace un año que no lo ve, lo ve y decide. */
export const listarCandidatosAResena = async ({
  minimoClases = MINIMO_CLASES_POR_DEFECTO,
  incluirPedidas = false,
  limite = 50,
} = {}) => {
  const minimo = limitarEntero(minimoClases, { minimo: 1, maximo: 100, porDefecto: MINIMO_CLASES_POR_DEFECTO });
  const tope = limitarEntero(limite, { minimo: 1, maximo: 200, porDefecto: 50 });

  const filas = await clasesPresentesPorAlumno();
  const conSuficientes = filas.filter((fila) => fila.clasesDadas >= minimo);
  if (!conSuficientes.length) return { candidatos: [], minimoClases: minimo };

  const porAlumno = new Map(conSuficientes.map((fila) => [String(fila._id), fila]));

  /* Sólo alumnos vivos. Uno borrado o dado de baja no puede recibir un mensaje
     pidiéndole una reseña: o se fue, o pidió que lo saquen. */
  const alumnos = await Student.find({
    _id: { $in: conSuficientes.map((fila) => fila._id) },
    deletedAt: null,
    active: true,
  })
    .select("displayName studentType responsible contact academic reviewRequest")
    .lean();

  const candidatos = alumnos
    .map((alumno) => {
      const metricas = porAlumno.get(String(alumno._id));
      const estado = alumno.reviewRequest?.status || "sin pedir";
      return {
        id: String(alumno._id),
        displayName: alumno.displayName,
        studentType: alumno.studentType,
        /* Quién recibe el mensaje. Si el alumno es menor, el contacto es del
           responsable y el mensaje le habla a él: mandarle un pedido de reseña a
           un chico de segundo año es, además de inútil, incómodo. */
        contactoNombre: alumno.studentType === "minor"
          ? alumno.responsible?.name || ""
          : alumno.displayName,
        esResponsable: alumno.studentType === "minor",
        vinculo: alumno.studentType === "minor" ? alumno.responsible?.relationship || "" : "",
        telefono: alumno.contact?.phone || "",
        telefonoDigits: alumno.contact?.phoneDigits || "",
        email: alumno.contact?.email || "",
        clasesDadas: metricas.clasesDadas,
        ultimaClase: metricas.ultimaClase || null,
        materias: (metricas.materias || []).filter(Boolean).sort(),
        reviewRequest: {
          status: estado,
          updatedAt: alumno.reviewRequest?.updatedAt || null,
          notes: alumno.reviewRequest?.notes || "",
        },
      };
    })
    .filter((candidato) => {
      if (ESTADOS_TERMINALES.includes(candidato.reviewRequest.status)) return false;
      if (!incluirPedidas && candidato.reviewRequest.status === "pedida") return false;
      return true;
    })
    /* Más clases primero; a igual cantidad, el más reciente. El desempate importa
       más de lo que parece: con dos clases cada uno, conviene escribirle al que
       viste la semana pasada y no al de hace un año. */
    .sort((a, b) => (
      b.clasesDadas - a.clasesDadas
      || new Date(b.ultimaClase || 0) - new Date(a.ultimaClase || 0)
    ))
    .slice(0, tope);

  return { candidatos, minimoClases: minimo };
};

export const ESTADOS_DE_RESENA = ["sin pedir", "pedida", "publicada", "no quiere"];

/* Cambia el estado del pedido. Devuelve el alumno actualizado, o null si no
   existe. Lanza si el estado no es uno de los cuatro: un estado inventado
   dejaría a alguien fuera de la lista sin que nadie sepa por qué. */
export const registrarPedidoDeResena = async ({ studentId, status, notes, userId }) => {
  if (!ESTADOS_DE_RESENA.includes(status)) {
    throw new Error(`Estado de reseña inválido: ${status}`);
  }

  const cambios = {
    "reviewRequest.status": status,
    "reviewRequest.updatedAt": new Date(),
    "reviewRequest.updatedBy": userId || null,
  };
  /* `notes` ausente NO borra las notas que había. Es el mismo criterio que el
     resto del proyecto: clave ausente significa "no la toco", y sólo un string
     vacío explícito las limpia. Sin esto, tocar el estado desde un botón que no
     manda notas le borraría el "me dijo que la escribe el finde". */
  if (typeof notes === "string") cambios["reviewRequest.notes"] = notes.trim().slice(0, 500);

  const actualizado = await Student.findOneAndUpdate(
    { _id: studentId, deletedAt: null },
    { $set: cambios },
    { new: true },
  )
    .select("displayName reviewRequest")
    .lean();

  return actualizado || null;
};
