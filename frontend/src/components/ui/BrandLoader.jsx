import logoIcon from "../../assets/images/logo-icon-sin-fondo.png";
import "./BrandLoader.css";

const BrandLoader = ({ text = "Preparando tu experiencia..." }) => {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <img
        src={logoIcon}
        alt=""
        aria-hidden="true"
        className="brand-loader-logo"
      />
      <div className="brand-loader-bar" aria-hidden="true">
        <div className="brand-loader-bar-fill" />
      </div>
      <span className="brand-loader-text">{text}</span>
    </div>
  );
};

export default BrandLoader;
