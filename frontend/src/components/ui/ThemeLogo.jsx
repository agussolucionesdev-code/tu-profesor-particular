import { useEffect, useState } from "react";
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

const getDocumentTheme = () => {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
};

/* `surface` es el color de lo que queda DETRÁS del logo, cuando no sigue al tema.
   Mientras los PNG traían el fondo pegado, el contraste venía dentro del archivo
   y alcanzaba con mirar el tema. Con transparencia ya no: el footer y el CTA de
   la home son navy en los dos temas, y el trazo navy del tema claro ahí
   desaparece. Sin `surface`, sigue al tema, que es lo correcto para todo lo que
   se apoya en el fondo de la página. */
const ThemeLogo = ({
  variant = "monogram",
  surface,
  sizes = "56px",
  className = "",
  imgClassName = "",
  alt = "Tu Profesor Particular",
  ...imgProps
}) => {
  const [theme, setTheme] = useState(getDocumentTheme);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(getDocumentTheme());
    const observer = new MutationObserver(syncTheme);

    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Un valor mal escrito cae al tema en vez de dejar el `img` sin archivo: el
  // logo está en el navbar de todas las páginas.
  const tone = surface === "light" || surface === "dark" ? surface : theme;
  const isMonogram = variant === "monogram";
  const selectedVariant = variant === "monogram" ? MONOGRAM[tone] : MAIN_LOGO;

  return (
    <span className={`theme-logo theme-logo--${variant} ${className}`.trim()}>
      {/* `sizes` y `srcSet` antes que `src`: los atributos se asignan en este
          orden, y un navegador que ve `src` primero puede empezar a bajarlo
          antes de enterarse de que había candidatos. */}
      <img
        sizes={isMonogram ? sizes : undefined}
        srcSet={isMonogram ? selectedVariant.srcSet : undefined}
        src={selectedVariant.src}
        width={isMonogram ? MONOGRAM_SIDE : selectedVariant.width}
        height={isMonogram ? MONOGRAM_SIDE : selectedVariant.height}
        alt={alt}
        className={`theme-logo__image ${imgClassName}`.trim()}
        {...imgProps}
      />
    </span>
  );
};

export default ThemeLogo;
