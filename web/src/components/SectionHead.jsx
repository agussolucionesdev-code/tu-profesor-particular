/**
 * Encabezado editorial numerado, compartido por todas las secciones del sitio.
 * Mismo sistema que la app de turnos: hairline, índice, antetítulo en
 * versalitas, titular en serif y bajada en columna aparte.
 */
/* `as` permite que el primer encabezado de una página sea el h1.
   Cuatro de las seis rutas no tenían NINGÚN h1: /sobre-mi, /materias,
   /como-trabajo y /contacto empezaban directamente en h2, porque este
   componente emitía siempre h2. Eso deja a un lector de pantalla sin el título
   de la página y a Google sin su señal más básica. El valor por omisión sigue
   siendo h2, así que las secciones internas no cambian. */
const SectionHead = ({ index, kicker, title, titleId, lead, as = "h2" }) => {
  /* Variable aparte en vez de renombrar en la destructuración: este ESLint no
     tiene eslint-plugin-react, así que no ve que un componente se usa dentro
     del JSX, y `varsIgnorePattern: ^[A-Z_]` sólo cubre variables —no
     parámetros—. Así queda cubierto sin tocar la configuración. */
  const Titulo = as;

  return (
  <header className="head">
    <div className="head-rule" data-reveal="up" aria-hidden="true" />
    <p className="head-meta" data-reveal="up">
      <span className="head-index">{index}</span>
      <span className="head-dash" aria-hidden="true" />
      <span className="head-kicker">{kicker}</span>
    </p>
    <div className="head-body">
      <Titulo id={titleId} className="display display--lg" data-reveal="clip">
        {title}
      </Titulo>
      {lead && (
        <p className="lead" data-reveal="up">
          {lead}
        </p>
      )}
    </div>
  </header>
  );
};

export default SectionHead;
