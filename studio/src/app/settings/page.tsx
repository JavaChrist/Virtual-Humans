"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { PageHeader } from "@/components/page-header";
import type { SettingsResponse } from "@/lib/types";

const KEYS = [
  { id: "openai", env: "OPENAI_API_KEY", use: "Images (gpt-image-1)", url: "https://platform.openai.com/api-keys" },
  { id: "elevenlabs", env: "ELEVENLABS_API_KEY", use: "Voix (TTS)", url: "https://elevenlabs.io/app/settings/api-keys" },
  { id: "elevenlabsVoice", env: "ELEVENLABS_VOICE_ID", use: "Voix par défaut du personnage", url: "https://elevenlabs.io/app/voice-library" },
  { id: "fal", env: "FAL_KEY", use: "Vidéo (Kling/Veo/MiniMax/Runway)", url: "https://fal.ai/dashboard/keys" },
  { id: "supabase", env: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY", use: "Budget + captures produits (Storage)", url: "https://supabase.com/dashboard/project/ejdbksxaswhdtsudnmvi/settings/api" },
] as const;

export default function SettingsPage() {
  const [s, setS] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then(setS).catch(() => {});
  }, []);

  const keys = s?.keys as Record<string, boolean> | undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Réglages" subtitle="Clés API, source du SDK et tarification" />

      <div className="card p-6 mb-6">
        <h3 className="font-semibold mb-4">Clés API</h3>
        <div className="flex flex-col gap-3">
          {KEYS.map((k) => {
            const ok = keys?.[k.id];
            return (
              <div key={k.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
                <div>
                  <code className="text-sm">{k.env}</code>
                  <div className="text-xs text-[var(--muted)]">{k.use}</div>
                </div>
                <div className="flex items-center gap-3">
                  <a href={k.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent-2)] hover:underline">
                    obtenir
                  </a>
                  <span className={`badge ${ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {ok ? "configurée" : "manquante"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold mb-4">Sécurité & accès</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
            <div>
              <code className="text-sm">APP_PASSWORD</code>
              <div className="text-xs text-[var(--muted)]">Verrouille l&apos;app + les générations payantes</div>
            </div>
            <span className={`badge ${s?.access.protected ? "text-[var(--success)]" : "text-[#f59e0b]"}`}>
              {s?.access.protected ? "protégé" : "accès ouvert"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
            <div>
              <code className="text-sm">BUDGET_CAP_USD</code>
              <div className="text-xs text-[var(--muted)]">Bloque les générations au-delà du plafond</div>
            </div>
            <span className="badge">
              {s?.access.budgetCapUSD != null ? `$${s.access.budgetCapUSD}` : "aucun plafond"}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold mb-3">Configuration</h3>
        <p className="text-sm text-[var(--muted)] mb-2">
          Crée un fichier <code>.env.local</code> à la racine de <code>studio/</code> :
        </p>
        <pre className="textarea whitespace-pre overflow-x-auto text-xs">{`OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
FAL_KEY=...

# Supabase (budget + captures produits)
SUPABASE_URL=https://ejdbksxaswhdtsudnmvi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Sécurité (recommandé en production)
APP_PASSWORD=un-mot-de-passe-solide
BUDGET_CAP_USD=50

# Tarifs (optionnel, pour ajuster les estimations)
ELEVENLABS_USD_PER_1K_CHARS=0.15
FAL_KLING_USD_PER_SEC=0.28
FAL_MINIMAX_USD_PER_SEC=0.05
FAL_VEO_USD_PER_SEC=0.4
FAL_RUNWAY_USD_PER_SEC=0.05`}</pre>
        <p className="text-xs text-[var(--muted)] mt-3">Redémarre le serveur après modification.</p>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-3">Source du SDK</h3>
        <div className="text-sm text-[var(--muted)] space-y-1">
          <div>
            Personnage : <span className="text-[var(--foreground)]">{s?.sdk.character ?? "…"}</span>
          </div>
          <div className="break-all">
            Racine : <code className="text-[var(--foreground)]">{s?.sdk.repoRoot ?? "…"}</code>
          </div>
          <div>
            Prix voix : <span className="text-[var(--foreground)]">${s?.pricing.elevenlabsUsdPer1kChars ?? "…"}/1k car.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
