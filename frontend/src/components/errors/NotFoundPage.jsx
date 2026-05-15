import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import ErrorPageLayout from "./ErrorPageLayout";

const LostBookIllustration = () => (
  <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Book open, pages scattered */}
    <rect x="45" y="80" width="70" height="90" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(-8 80 125)" />
    <line x1="60" y1="100" x2="100" y2="95" stroke="currentColor" strokeWidth="1.5" opacity="0.4" transform="rotate(-8 80 97)" />
    <line x1="60" y1="112" x2="100" y2="107" stroke="currentColor" strokeWidth="1.5" opacity="0.4" transform="rotate(-8 80 109)" />
    <line x1="60" y1="124" x2="90" y2="120" stroke="currentColor" strokeWidth="1.5" opacity="0.4" transform="rotate(-8 80 122)" />

    {/* Second book/page floating away */}
    <rect x="120" y="60" width="55" height="70" rx="3" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" transform="rotate(12 147 95)" />
    <line x1="132" y1="78" x2="162" y2="82" stroke="currentColor" strokeWidth="1.2" opacity="0.25" transform="rotate(12 147 80)" />
    <line x1="132" y1="88" x2="162" y2="92" stroke="currentColor" strokeWidth="1.2" opacity="0.25" transform="rotate(12 147 90)" />

    {/* Pencil */}
    <g transform="translate(140, 140) rotate(35)">
      <rect x="0" y="0" width="8" height="50" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <polygon points="0,50 8,50 4,62" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="0" y1="8" x2="8" y2="8" stroke="#589860" strokeWidth="2" />
    </g>

    {/* Question mark */}
    <text x="110" y="55" fontSize="32" fontWeight="800" fill="#589860" opacity="0.6" fontFamily="Inter, system-ui">?</text>

    {/* Magnifying glass searching */}
    <circle cx="55" cy="55" r="18" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.6" />
    <line x1="68" y1="68" x2="82" y2="82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

    {/* Small decorative dots */}
    <circle cx="175" cy="45" r="3" fill="#589860" opacity="0.3" />
    <circle cx="30" cy="140" r="2.5" fill="#589860" opacity="0.25" />
    <circle cx="190" cy="160" r="2" fill="currentColor" opacity="0.2" />
  </svg>
);

const NotFoundPage = () => {
  useDocumentTitle("Pagina no encontrada");
  return (
    <ErrorPageLayout
      illustration={<LostBookIllustration />}
      title="Esta pagina no existe"
      description="El enlace puede estar roto o la pagina fue movida. Pero no te preocupes, tu clase te sigue esperando."
      actions={[
        { label: "Volver a reservar", to: "/reservar" },
        { label: "Mis turnos", to: "/portal", variant: "secondary" },
      ]}
      statusCode="404"
    />
  );
};

export default NotFoundPage;
