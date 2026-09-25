import "./ThemeLogo.css";
import mainLogoWithTagline from "../../assets/images/brand-logo-main-tagline.png";
import monogramDark168 from "../../assets/images/brand-logo-monogram-dark-168.png";
import monogramDark336 from "../../assets/images/brand-logo-monogram-dark-336.png";
import monogramLight168 from "../../assets/images/brand-logo-monogram-light-168.png";
import monogramLight336 from "../../assets/images/brand-logo-monogram-light-336.png";

/* Los monogramas salen de `scripts/generar-monogramas.mjs`: fondo transparente y
   dos tamaños. 168 cubre hasta 56 px a DPR 3, que es todo el cromo de la app
   (navbar, footer, loader, portal); 336 cubre el login del admin, a 112. Con
   `srcSet` + `sizes` el navegador elige según la densidad de la pantalla, y el
   que dibuja el logo más grande lo avisa con `sizes`. Un uso nítido por encima
   de 112 px necesita un tamaño más en el script, no estirar el de 336.
   La excepción medida es la marca de agua de la home: se dibuja a hasta 560 px
   pero al 7,5% de opacidad, y comparada píxel a píxel contra un archivo de 672
   la diferencia media es de 0,1 niveles, invisible. Un tamaño más costaría
   12-16 KB por visita para nada.

   `light` es el trazo navy, para superficies claras; `dark` es el blanco, para
   superficies oscuras. */
const MONOGRAM_SIDE = 168;
const MONOGRAM = {
  light: { src: monogramLight168, srcSet: `${monogramLight168} 168w, ${monogramLight336} 336w` },
  dark: { src: monogramDark168, srcSet: `${monogramDark168} 168w, ${monogramDark336} 336w` },
};

const MAIN_LOGO = {
  // The supplied pack has no checkerboard-free dark main lockup. Keep this
  // official white-background lockup stable across themes instead of faking one.
  src: mainLogoWithTagline,
  width: 1536,
  height: 1024,
};

/* `surface` es el color de lo que queda DETRÁS del logo, cuando no sigue al tema.
   Mientras los PNG traían el fondo pegado, el contraste venía dentro del archivo
   y alcanzaba con mirar el tema. Con transparencia ya no: el footer y el CTA de
   la home son navy en los dos temas, y el trazo navy del tema claro ahí
   desaparece. Sin `surface`, sigue al tema, que es lo correcto para todo lo que
   se apoya en el fondo de la página.

   CÓMO SIGUE AL TEMA: con CSS, no con JavaScript. Van las dos variantes en el
   HTML y ThemeLogo.css muestra la que corresponde a `data-theme`, que
   `public/tema.js` fija antes de pintar. Antes el componente elegía con un
   estado y un MutationObserver: correcto en el navegador, pero la portada
   prerenderizada (prerender.mjs) salía con el logo claro, y quien usa modo
   oscuro veía el trazo azul sobre la barra azul hasta que corría React. Ahora
   el componente es puro: sin estado ni efectos, igual en Node y en el
   navegador. La variante oculta tiene `display: none`: no se ve ni la lee un
   lector de pantalla. */
const ThemeLogo = ({
  variant = "monogram",
  surface,
  sizes = "56px",
  className = "",
  imgClassName = "",
  alt = "Tu Profesor Particular",
  ...imgProps
}) => {
  const clases = `theme-logo theme-logo--${variant} ${className}`.trim();

  if (variant !== "monogram") {
    return (
      <span className={clases}>
        <img
          src={MAIN_LOGO.src}
          width={MAIN_LOGO.width}
          height={MAIN_LOGO.height}
          alt={alt}
          className={`theme-logo__image ${imgClassName}`.trim()}
          {...imgProps}
        />
      </span>
    );
  }

  /* `sizes` y `srcSet` antes que `src`: los atributos se asignan en este
     orden, y un navegador que ve `src` primero puede empezar a bajarlo antes
     de enterarse de que había candidatos. */
  const imagen = (tono, modificador) => (
    <img
      key={tono}
      sizes={sizes}
      srcSet={MONOGRAM[tono].srcSet}
      src={MONOGRAM[tono].src}
      width={MONOGRAM_SIDE}
      height={MONOGRAM_SIDE}
      alt={alt}
      className={`theme-logo__image ${modificador} ${imgClassName}`.replace(/\s+/g, " ").trim()}
      {...imgProps}
    />
  );

  /* Un valor mal escrito cae al tema en vez de dejar el `img` sin archivo: el
     logo está en el navbar de todas las páginas. */
  const fijo = surface === "light" || surface === "dark" ? surface : null;

  return (
    <span className={clases}>
      {fijo
        ? imagen(fijo, "")
        : [imagen("light", "theme-logo__image--claro"), imagen("dark", "theme-logo__image--oscuro")]}
    </span>
  );
};

export default ThemeLogo;
