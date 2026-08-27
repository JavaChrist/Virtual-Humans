"use client";

import { useEffect, useState } from "react";
import {
  getActiveUpdateBlockers,
  subscribeToUpdateBlockers,
} from "@/lib/update-blockers";

export function DirectorUpdateBlockerStatus() {
  const [reasons, setReasons] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setReasons(getActiveUpdateBlockers().map((blocker) => blocker.reason));
    };
    sync();
    return subscribeToUpdateBlockers(sync);
  }, []);

  if (reasons.length === 0) return null;

  return (
    <p
      className="card p-3 mb-4 text-sm"
      role="status"
      aria-live="polite"
      data-testid="director-update-blockers"
    >
      Mise à jour de l&apos;application en pause : {reasons.join(" · ")}
    </p>
  );
}
