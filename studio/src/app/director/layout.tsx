import { notFound } from "next/navigation";
import { isDirectorV2Enabled } from "@/infrastructure/config/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Gate for the entire /director tree.
 * When DIRECTOR_V2_ENABLED is off, routes 404 — no experience is rendered.
 */
export default function DirectorLayout({ children }: { children: React.ReactNode }) {
  if (!isDirectorV2Enabled()) {
    notFound();
  }
  return children;
}
