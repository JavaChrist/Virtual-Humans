"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { PageHeader } from "@/components/page-header";
import type { CharacterResponse, SettingsResponse } from "@/lib/types";

export default function Dashboard() {
  const { characterId } = useCharacter();
  const [char, setChar] = useState<CharacterResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [budget, setBudget] = useState<{ total: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    apiGet<CharacterResponse>(withCharacter("/api/character", characterId))
      .then(setChar)
      .catch((e) => setError(e.message));
  }, [characterId]);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then(setSettings).catch(() => {});
    apiGet<{ total: number; count: number }>("/api/budget").then(setBudget).catch(() => {});
  }, []);

  const keys = settings?.keys;
  const studios = [
    { href: "/image", label: "Studio Image", provider: "OpenAI · gpt-image-1", ready: keys?.openai },
    { href: "/voice", label: "Studio Voix", provider: "ElevenLabs", ready: keys?.elevenlabs && keys?.elevenlabsVoice },
    { href: "/video", label: "Studio Vidéo", provider: "fal.ai · Kling/Veo/MiniMax/Runway", ready: keys?.fal },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`Bonjour — ${char?.overview.name ?? "…"}`}
        subtitle={`Personnage officiel · SDK ${char?.overview.sdkVersion ?? "…"}`}
      />

      {error && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">Impossible de lire le SDK : {error}</p>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {studios.map((s) => (
          <Link key={s.href} href={s.href} className="card p-5 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.label}</span>
              <span className={`badge ${s.ready ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                {s.ready ? "prêt" : "clé manquante"}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">{s.provider}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="label">Dépense estimée</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{usd(budget?.total)}</div>
          <div className="text-xs text-[var(--muted)] mt-1">{budget?.count ?? 0} génération(s)</div>
        </div>
        <div className="card p-5">
          <div className="label">Comportements</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{char?.behaviors.length ?? 0}</div>
          <div className="text-xs text-[var(--muted)] mt-1">modules chargés</div>
        </div>
        <div className="card p-5">
          <div className="label">Templates</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {char ? Object.values(char.templates).reduce((n, t) => n + t.length, 0) : 0}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            {char ? Object.keys(char.templates).length : 0} catégories
          </div>
        </div>
      </section>
    </div>
  );
}
