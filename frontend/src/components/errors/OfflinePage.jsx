import ErrorPageLayout from "./ErrorPageLayout";

const DisconnectedCloudIllustration = () => (
  <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Cloud */}
    <path
      d="M60 120 C60 120 40 120 40 100 C40 82 55 75 68 78 C72 62 88 52 107 52 C128 52 145 65 148 82 C165 82 178 94 178 108 C178 122 166 132 152 132 L68 132 C54 132 42 124 42 112"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />

    {/* Lightning bolt (disconnection) */}
    <path
      d="M102 132 L98 155 L108 155 L95 180"
      stroke="#589860"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* X mark over cloud (disconnected) */}
    <g transform="translate(110, 95)" opacity="0.6">
      <line x1="-12" y1="-12" x2="12" y2="12" stroke="#589860" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="-12" x2="-12" y2="12" stroke="#589860" strokeWidth="3" strokeLinecap="round" />
    </g>

    {/* Signal waves (fading) */}
    <path d="M40 165 C45 160 50 160 55 165" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none" strokeLinecap="round" />
    <path d="M33 172 C42 164 56 164 65 172" stroke="currentColor" strokeWidth="1.5" opacity="0.2" fill="none" strokeLinecap="round" />

    {/* Small dots */}
    <circle cx="170" cy="145" r="2.5" fill="#589860" opacity="0.3" />
    <circle cx="50" cy="45" r="2" fill="currentColor" opacity="0.2" />
    <circle cx="185" cy="70" r="3" fill="#589860" opacity="0.2" />
  </svg>
);

const OfflinePage = () => {
  return (
    <ErrorPageLayout
      illustration={<DisconnectedCloudIllustration />}
      title="Sin conexion"
      description="Parece que no tenes internet. Cuando se restablezca la conexion, recarga la pagina."
      actions={[
        { label: "Reintentar", onClick: () => window.location.reload() },
      ]}
    />
  );
};

export default OfflinePage;
