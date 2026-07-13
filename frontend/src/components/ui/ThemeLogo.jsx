/**
 * Brand lockup backed by the source assets that contain real alpha.
 * Dark mode is handled in CSS so hidden variants are never downloaded.
 */
import logoIconTransparent from "../../assets/images/logo-icon-sin-fondo.png";
import logoFullTransparent from "../../assets/images/logo-full-sin-fondo.png";

const VARIANTS = {
  monogram: { src: logoIconTransparent, width: 2400, height: 2400 },
  full: { src: logoFullTransparent, width: 1736, height: 600 },
  tagline: { src: logoFullTransparent, width: 1736, height: 600 },
};

const ThemeLogo = ({
  variant = "monogram",
  className = "",
  imgClassName = "",
  alt = "Tu Profesor Particular",
  ...imgProps
}) => {
  const selectedVariant = VARIANTS[variant] ?? VARIANTS.monogram;

  return (
    <span className={`theme-logo theme-logo--${variant} ${className}`.trim()}>
      <img
        src={selectedVariant.src}
        width={selectedVariant.width}
        height={selectedVariant.height}
        alt={alt}
        className={`theme-logo__image ${imgClassName}`.trim()}
        {...imgProps}
      />
    </span>
  );
};

export default ThemeLogo;
