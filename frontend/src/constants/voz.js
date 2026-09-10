/* La voz de Agustín, en la app de turnos.
 *
 * ESPEJO DE `web/src/data/voz.js`. Las citas de acá son BYTE A BYTE las de allá, y
 * `web/tests/vozCompartida.test.js` lo verifica leyendo los dos archivos. Si alguien
 * edita una copia y no la otra, ese test falla y el deploy se frena.
 *
 * POR QUÉ HAY DOS COPIAS Y NO UNA
 *
 * `web/` y `frontend/` son dos proyectos separados, sin paquete compartido. Las
 * alternativas eran servir el texto desde la API —una dependencia de red, y en Render
 * plan gratuito con arranque en frío, para un contenido que cambia dos veces por año, y
 * que además lo dejaría fuera del HTML prerenderizado— o montar un paquete compartido
 * para ~40 líneas de texto. Duplicar y verificar con un test es más barato y más
 * seguro que las dos.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE, que es lo importante
 *
 * La voz se publicó primero SÓLO en el sitio institucional. Fue un error de análisis
 * mío: el institucional es la vitrina, pero TURNOS ES EL MOSTRADOR. Quien llega directo
 * a /reservar desde un WhatsApp —que es el canal principal del negocio— atravesaba los
 * cinco pasos, dejaba su teléfono, su email y el nombre de su hijo, y no leía una sola
 * palabra de Agustín hasta después de confirmar.
 *
 * Le habíamos puesto la voz a la página que se visita y se la habíamos dejado afuera a
 * la que se usa.
 *
 * REGLA, la misma que en el otro archivo: todo lo que está entre comillas es TEXTUAL.
 * Salió de audios que grabó él. No se pule a lenguaje de folleto.
 */

/* Los años, en un solo lugar.
   Estaban escritos a mano como «+8» en dos puntos de AboutAgustin.jsx, mientras el
   sitio institucional ya decía otra cosa. Los dos dominios se contradecían en producción sobre
   hace cuánto enseña — que es exactamente el problema de tener dos fuentes de verdad,
   en el dato más fácil de verificar que tiene la marca.
   Nueve sale de dos datos que dio él: empezó a dar clases FORMALMENTE entre los 17 y
   los 18, y hoy tiene 27. Diez sería redondear para arriba, y en el dato más fácil de
   contrastar que tiene la marca no se redondea para arriba. */
export const ANOS_ENSENANDO = 9;

/* Lo que dicen sus alumnos de sí mismos. El material más potente del sitio: quien lo
   lee ya se lo escuchó decir a su hijo. */
export const LO_QUE_SE_ESCUCHAN = [
  "No me da la cabeza.",
  "Algún problema tendré.",
  "No soy como mi hermano.",
];

export const AUTONOMIA_CITA =
  "Mi meta no es que la misma persona me busque un montón de veces y no se pueda liberar de mí. La idea es que alcance la autonomía y justamente se libere de mí.";

export const AUTONOMIA_PRUEBA =
  "Hay alumnos que volvieron después de cuatro y cinco años, para otra materia. No porque hayan quedado atados: se fueron, y eligieron volver.";

export const METODO_CITA =
  "Un tema lo explico de mil maneras distintas. Nunca lo explico de la misma forma, porque si de alguna manera no llegó, hay que buscar de otra.";

export const NO_PUEDO_AYUDARTE =
  "Yo veo el caso y sé si realmente puedo ayudar. Y si no, lo digo con la mano en el corazón.";

export const LUGAR_CORRECTO =
  "Una mamá angustiada necesita escuchar que su hijo realmente puede. Que se quede tranquila, que llegó al lugar correcto.";
