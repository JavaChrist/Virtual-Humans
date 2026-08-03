"use client";

type Props = {
  stale: boolean;
  reason?: string | null;
  restartHint?: string | null;
};

/** Visible stale marker for /director sections (VHS-126). */
export function StaleBadge({ stale, reason, restartHint }: Props) {
  if (!stale) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
      style={{
        background: "color-mix(in srgb, var(--danger) 18%, transparent)",
        color: "var(--danger)",
      }}
      role="status"
      title={reason ?? "Artifact obsolète suite à une révision amont"}
    >
      obsolète
      {restartHint ? ` · reprendre : ${restartHint}` : null}
    </span>
  );
}
