import ThemeLogo from "./ThemeLogo";
import "./BrandLoader.css";

const BrandLoader = ({ text = "Preparando tu experiencia..." }) => {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <ThemeLogo variant="monogram" imgClassName="brand-loader-logo" alt="" />
      <div className="brand-loader-bar" aria-hidden="true">
        <div className="brand-loader-bar-fill" />
      </div>
      <span className="brand-loader-text">{text}</span>
    </div>
  );
};

export default BrandLoader;
