import ThemeLogo from "./ThemeLogo";
import "./BrandLoader.css";

const BrandLoader = ({ text = "Preparando tu experiencia…" }) => {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <div className="brand-loader-mark" aria-hidden="true">
        <ThemeLogo variant="monogram" imgClassName="brand-loader-logo" alt="" />
      </div>
      <div className="brand-loader-track" aria-hidden="true">
        <div className="brand-loader-indicator" />
      </div>
      <span className="brand-loader-text">{text}</span>
    </div>
  );
};

export default BrandLoader;
