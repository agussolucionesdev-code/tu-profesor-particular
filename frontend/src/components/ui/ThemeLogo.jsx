import { useEffect, useState } from "react";
import mainLogoWithTagline from "../../assets/images/brand-logo-main-tagline.png";
import monogramDark from "../../assets/images/brand-logo-monogram-dark.png";
import monogramLight from "../../assets/images/brand-logo-monogram-light.png";

const MONOGRAM = {
  light: { src: monogramLight, width: 1254, height: 1254 },
  dark: { src: monogramDark, width: 1254, height: 1254 },
};

const MAIN_LOGO = {
  src: mainLogoWithTagline,
  width: 1536,
  height: 1024,
};

const getDocumentTheme = () => {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
};

const ThemeLogo = ({
  variant = "monogram",
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

  const selectedVariant = variant === "monogram" ? MONOGRAM[theme] : MAIN_LOGO;

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
