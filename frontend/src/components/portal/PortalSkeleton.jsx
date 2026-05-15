import { SkeletonLine } from "../admin/shared/Skeleton";

const PortalSkeleton = () => (
  <div className="tickets-grid" aria-hidden="true">
    {[1, 2].map((i) => (
      <div key={i} className="ticket-wrapper" style={{ opacity: 0.6 }}>
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "var(--radius-lg, 16px)",
            border: "1px solid var(--border-soft, #e2e8f0)",
            background: "var(--color-surface-1, #fff)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <SkeletonLine width="90px" height="20px" />
            <SkeletonLine width="80px" height="20px" />
          </div>
          <SkeletonLine width="65%" height="18px" />
          <SkeletonLine width="45%" height="14px" />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <SkeletonLine width="50%" height="14px" />
            <SkeletonLine width="40%" height="14px" />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <SkeletonLine width="120px" height="36px" />
            <SkeletonLine width="100px" height="36px" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default PortalSkeleton;
