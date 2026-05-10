import "./Skeleton.css";

export const SkeletonLine = ({ width = "100%", height = "1rem" }) => (
  <div
    className="skeleton-line"
    style={{ width, height }}
    aria-hidden="true"
  />
);

export const SkeletonKPI = () => (
  <article className="admin-kpi-card skeleton-kpi" aria-hidden="true">
    <div className="skeleton-kpi-icon skeleton-block" />
    <div className="skeleton-kpi-text">
      <SkeletonLine width="60%" height="0.75rem" />
      <SkeletonLine width="40%" height="1.5rem" />
      <SkeletonLine width="70%" height="0.65rem" />
    </div>
  </article>
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="admin-card skeleton-card" aria-hidden="true">
    <SkeletonLine width="30%" height="0.7rem" />
    <SkeletonLine width="55%" height="1.1rem" />
    <div className="skeleton-spacer" />
    {Array.from({ length: lines }, (_, i) => (
      <SkeletonLine key={i} width={i % 2 === 0 ? "90%" : "75%"} />
    ))}
  </div>
);

export const SkeletonTableRow = () => (
  <tr aria-hidden="true">
    {[80, 100, 160, 120, 90, 70].map((w, i) => (
      <td key={i}>
        <div className="skeleton-line" style={{ width: w, height: "0.85rem" }} />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 8 }) => (
  <div className="admin-table-shell" aria-hidden="true">
    <table className="admin-table">
      <thead>
        <tr>
          {["Estado", "Código", "Alumno", "Horario", "Contacto", "Acciones"].map(
            (h) => <th key={h}><div className="skeleton-line" style={{ width: 60, height: "0.7rem" }} /></th>
          )}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </tbody>
    </table>
  </div>
);
