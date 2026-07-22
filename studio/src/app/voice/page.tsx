"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { PageHeader } from "@/components/page-header";
import type { SettingsResponse } from "@/lib/types";

export default function VoiceStudio() {
  const { characterId, characterName } = useCharacter();
  const [ready, setReady] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [estimate, setEstimate] = useState<{ usd: number; credits: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings")
      .then((s) => {
        setReady(s.keys.elevenlabs);
        setHasVoice(s.keys.elevenlabsVoice);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const chars = text.length;
    apiPost<{ usd: number; credits: number }>("/api/estimate", { type: "voice", chars })
      .then(setEstimate)
      .catch(() => setEstimate(null));
  }, [text]);

  async function generate() {
    setLoading(true);
    setError(null);
    setAudio(null);
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/voice", {
        text,
        voiceId: voiceId || undefined,
        character: characterId,
      });
      setAudio(res.dataUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Studio Voix" subtitle="ElevenLabs — synthèse vocale (eleven_multilingual_v2)" />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">
            Clé <code>ELEVENLABS_API_KEY</code> manquante (voir Réglages).
          </p>
        </div>
      )}

      <div className="card p-6">
        <label className="label">Script à vocaliser</label>
        <textarea
          className="textarea"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris ici le texte que le personnage doit dire…"
        />

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="label">
              Voice ID {hasVoice ? "(laisser vide = voix du personnage)" : "(requis)"}
            </label>
            <input
              className="input"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder={hasVoice ? `Voix par défaut de ${characterName || "ton personnage"}` : "ex. 21m00Tcm4TlvDq8ikWAM"}
            />
          </div>
          <div className="flex flex-col justify-end text-sm text-[var(--muted)]">
            <div>{text.length} caractères</div>
            <div>
              ≈ {estimate?.credits ?? 0} crédits · {usd(estimate?.usd)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-6">
          <button
            className="btn btn-primary"
            disabled={!text || loading || !ready || (!hasVoice && !voiceId)}
            onClick={generate}
          >
            {loading ? "Génération…" : "Générer la voix"}
          </button>
        </div>

        {error && <p className="text-sm text-[var(--danger)] mt-4">{error}</p>}
        {audio && (
          <div className="mt-6">
            <audio controls src={audio} className="w-full" />
            <a href={audio} download="mei-voice.mp3" className="btn btn-ghost mt-4">
              Télécharger l&apos;audio
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
