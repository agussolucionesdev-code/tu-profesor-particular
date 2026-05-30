/**
 * ThemeLogo — renders the correct logo variant for light/dark mode.
 *
 * variant="monogram"  → round TU + "PROFESOR PARTICULAR" curved text
 * variant="full"      → horizontal "Tu Profesor Particular" wordmark
 * variant="tagline"   → full logo + "Juntos, despejando el camino a la meta."
 *
 * CSS hides/shows each <img> based on [data-theme="dark"] on <html>.
 */

import logoMonogramLight  from "../../assets/images/logo-monogram-light.png";
import logoMonogramDark   from "../../assets/images/logo-monogram-dark.png";
import logoFullLight      from "../../assets/images/logo-full-light.png";
import logoFullDark       from "../../assets/images/logo-full-dark.png";
import logoFullTagline    from "../../assets/images/logo-full-tagline.png";

const VARIANTS = {
  monogram: {
    light: logoMonogramLight,
    dark:  logoMonogramDark,
    alt:   "Tu Profesor Particular",
  },
  full: {
    light: logoFullLight,
    dark:  logoFullDark,
    alt:   "Tu Profesor Particular",
  },
  tagline: {
    // tagline version only exists in light; dark fallback = full dark
    light: logoFullTagline,
    dark:  logoFullDark,
    alt:   "Tu Profesor Particular — Juntos, despejando el camino a la meta",
  },
};

const ThemeLogo = ({
  variant = "monogram",
  className = "",
  imgClassName = "",
  alt,
  ...imgProps
}) => {
  const v = VARIANTS[variant] ?? VARIANTS.monogram;
  const resolvedAlt = alt ?? v.alt;

  return (
    <span className={`theme-logo theme-logo--${variant} ${className}`} aria-label={resolvedAlt}>
      <img
        src={v.light}
        alt={resolvedAlt}
        className={`theme-logo__light ${imgClassName}`}
        aria-hidden="false"
        {...imgProps}
      />
      <img
        src={v.dark}
        alt=""
        aria-hidden="true"
        className={`theme-logo__dark ${imgClassName}`}
        {...imgProps}
      />
    </span>
  );
};

export default ThemeLogo;
