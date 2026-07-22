"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/client";

interface Health {
  errors: number;
  warnings: number;
  infos: number;
}
interface ConflictPkg {
  directoryName: string;
  version: string | null;
  characterId: string;
  characterCode: string | null;
}
interface Conflict {
  type: "characterId" | "characterCode";
  code: "DUPLICATE_CHARACTER_ID" | "DUPLICATE_CHARACTER_CODE";
  value: string;
  packages: ConflictPkg[];
}
interface Summary {
  characterId: string;
  characterCode: string | null;
  directoryName: string;
  displayName: string;
  sdkVersion: string | null;
  status: string | null;
  health: Health;
  conflicts: Conflict[];
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Summary[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ characters: Summary[]; conflicts: Conflict[]; activeId: string | null }>(
      "/api/v1/characters"
    )
      .then((d) => {
        setCharacters(d.characters);
        setConflicts(d.conflicts ?? []);
        setActiveId(d.activeId);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="Personnages"
        subtitle="Diagnostic du chargement des packages personnage (identité, personnalité, assets, mémoires)."
      />

      {error && (
        <div className="card p-4 border-[var(--danger)] text-sm text-[var(--danger)]">{error}</div>
      )}

      {conflicts.length > 0 && (
        <div
          className="card p-4 mb-4"
          style={{ borderColor: "var(--danger)" }}
        >
          <div className="font-bold text-[var(--danger)] mb-2">
            ⚠ {conflicts.length} collision(s) d&apos;unicité détectée(s)
          </div>
          <div className="space-y-3">
            {conflicts.map((c, i) => (
              <div key={i} className="text-sm">
                <div>
                  <span className="badge" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                    {c.code}
                  </span>{" "}
                  <span className="font-mono">{c.type}</span> ={" "}
                  <span className="font-mono font-bold">{c.value}</span>
                </div>
                <ul className="mt-1 ml-4 list-disc text-[var(--muted)]">
                  {c.packages.map((p) => (
                    <li key={p.directoryName}>
                      <span className="font-mono">{p.directoryName}</span> — v{p.version ?? "?"} ·
                      id <span className="font-mono">{p.characterId}</span> · code{" "}
                      <span className="font-mono">{p.characterCode ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {characters.map((c) => (
          <Link
            key={c.characterId}
            href={`/characters/${encodeURIComponent(c.characterId)}`}
            className="card p-5 hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{c.displayName}</div>
              <div className="flex gap-1.5">
                {c.conflicts.length > 0 && (
                  <span className="badge" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                    collision
                  </span>
                )}
                {activeId === c.characterId && c.conflicts.length === 0 && (
                  <span className="badge">actif</span>
                )}
              </div>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              <span className="font-mono">{c.characterId}</span>
              {c.characterCode && <span> · {c.characterCode}</span>}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">{c.directoryName}</div>
            <div className="text-xs text-[var(--muted)] mt-1">
              SDK {c.sdkVersion ?? "?"} · {c.status ?? "—"}
            </div>
            <div className="flex gap-2 mt-4">
              <HealthBadge count={c.health.errors} kind="error" />
              <HealthBadge count={c.health.warnings} kind="warning" />
              <HealthBadge count={c.health.infos} kind="info" />
            </div>
          </Link>
        ))}
      </div>

      {characters.length === 0 && !error && (
        <div className="text-sm text-[var(--muted)]">Chargement…</div>
      )}
    </div>
  );
}

function HealthBadge({ count, kind }: { count: number; kind: "error" | "warning" | "info" }) {
  const label = kind === "error" ? "erreur" : kind === "warning" ? "alerte" : "info";
  const color =
    kind === "error"
      ? "var(--danger)"
      : kind === "warning"
        ? "#f59e0b"
        : "var(--accent-2)";
  return (
    <span className="badge" style={count > 0 ? { borderColor: color, color } : undefined}>
      {count} {label}
      {count > 1 ? "s" : ""}
    </span>
  );
}
