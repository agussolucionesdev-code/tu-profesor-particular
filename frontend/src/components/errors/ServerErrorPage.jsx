import ErrorPageLayout from "./ErrorPageLayout";

const BrokenBoardIllustration = () => (
  <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Blackboard frame */}
    <rect x="30" y="40" width="160" height="110" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none" />

    {/* Crack lines across the board */}
    <path
      d="M90 40 L95 70 L85 85 L100 110 L95 150"
      stroke="#589860"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.7"
      fill="none"
    />
    <path
      d="M95 70 L120 75 L135 65"
      stroke="#589860"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
      fill="none"
    />
    <path
      d="M85 85 L65 95"
      stroke="#589860"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
      fill="none"
    />

    {/* Chalk text fragments (broken) */}
    <line x1="50" y1="60" x2="75" y2="60" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
    <line x1="110" y1="60" x2="170" y2="60" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
    <line x1="50" y1="75" x2="80" y2="75" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" />
    <line x1="120" y1="100" x2="170" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" />

    {/* Board legs */}
    <line x1="60" y1="150" x2="50" y2="185" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="160" y1="150" x2="170" y2="185" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />

    {/* Chalk tray */}
    <rect x="55" y="147" width="110" height="6" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />

    {/* Fallen chalk pieces */}
    <rect x="75" y="162" width="14" height="5" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" transform="rotate(-15 82 164)" />
    <rect x="140" y="168" width="10" height="4" rx="1.5" stroke="#589860" strokeWidth="1.2" fill="none" opacity="0.5" transform="rotate(20 145 170)" />

    {/* Warning sparkle */}
    <g transform="translate(180, 35)" opacity="0.6">
      <line x1="0" y1="-8" x2="0" y2="8" stroke="#589860" strokeWidth="2" strokeLinecap="round" />
      <line x1="-8" y1="0" x2="8" y2="0" stroke="#589860" strokeWidth="2" strokeLinecap="round" />
      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#589860" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#589860" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>
);

/**
 * 500 / crash error page. Also used inside ErrorBoundary.
 * @param {Object} props
 * @param {boolean} [props.isBoundary=false] - When true, uses <a> instead of <Link>
 */
const ServerErrorPage = ({ isBoundary = false }) => {
  return (
    <ErrorPageLayout
      illustration={<BrokenBoardIllustration />}
      title="Algo salio mal"
      description="Estamos trabajando para solucionarlo. Intenta de nuevo en unos minutos."
      actions={[
        { label: "Recargar pagina", onClick: () => window.location.reload() },
        { label: "Volver al inicio", to: "/", variant: "secondary" },
      ]}
      isBoundary={isBoundary}
      statusCode="500"
    />
  );
};

export default ServerErrorPage;
