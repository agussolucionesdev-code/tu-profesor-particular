import ErrorPageLayout from "./ErrorPageLayout";

const GearIllustration = () => (
  <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main gear */}
    <g transform="translate(110, 100)">
      <path
        d="M0 -40 L8 -28 L22 -32 L28 -18 L40 -12 L36 2 L44 14 L32 22 L32 36 L18 36 L10 48 L-4 42 L-16 48 L-22 36 L-36 34 L-34 20 L-46 12 L-38 0 L-42 -14 L-28 -18 L-24 -32 L-10 -28 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="0" cy="0" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
    </g>

    {/* Small gear */}
    <g transform="translate(165, 60)">
      <path
        d="M0 -18 L4 -12 L10 -14 L13 -8 L18 -5 L16 1 L20 6 L14 10 L14 16 L8 16 L4 22 L-2 19 L-7 22 L-10 16 L-16 15 L-15 9 L-21 5 L-17 0 L-19 -6 L-12 -8 L-11 -14 L-4 -12 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.6"
      />
      <circle cx="0" cy="0" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
    </g>

    {/* Wrench */}
    <g transform="translate(55, 145) rotate(-30)">
      <rect x="-3" y="0" width="6" height="40" rx="2" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
      <path d="M-8 -2 C-8 -10 8 -10 8 -2 L5 2 L-5 2 Z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
    </g>

    {/* Progress dots */}
    <circle cx="85" cy="175" r="4" fill="#589860" opacity="0.5" />
    <circle cx="100" cy="175" r="4" fill="#589860" opacity="0.35" />
    <circle cx="115" cy="175" r="4" fill="#589860" opacity="0.2" />

    {/* Sparkle */}
    <g transform="translate(50, 55)" opacity="0.4">
      <line x1="0" y1="-6" x2="0" y2="6" stroke="#589860" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-6" y1="0" x2="6" y2="0" stroke="#589860" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>
);

const MaintenancePage = () => {
  return (
    <ErrorPageLayout
      illustration={<GearIllustration />}
      title="En mantenimiento"
      description="Estamos mejorando la experiencia. Volve en unos minutos."
      actions={[
        { label: "Reintentar", onClick: () => window.location.reload() },
      ]}
    />
  );
};

export default MaintenancePage;
