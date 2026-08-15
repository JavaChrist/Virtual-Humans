"use client";

import { useState } from "react";
import {
  applyNarratorSelection,
  buildVoiceNarratorSelectorView,
  type VoiceNarratorSelectorView,
} from "./voice-narrator-selector-view";

export function VoiceNarratorSelector({
  initialView,
}: {
  initialView?: VoiceNarratorSelectorView;
}) {
  const [view, setView] = useState<VoiceNarratorSelectorView>(
    initialView ?? buildVoiceNarratorSelectorView(),
  );

  return (
    <section className="card p-6 mt-8" aria-labelledby="voice-narrator-title">
      <h3 id="voice-narrator-title" className="font-semibold mb-1">
        {view.title}
      </h3>
      <p className="text-xs text-[var(--muted)] mb-4" role="status">
        {view.reason}
      </p>

      <label className="block text-sm mb-4">
        <span className="text-[var(--muted)]">Narrateur du projet</span>
        <select
          className="select mt-1 w-full"
          value={view.selected}
          onChange={(event) => {
            const next = event.target.value as "" | "narrator_female" | "narrator_male";
            const applied = applyNarratorSelection(view, next);
            setView(applied.view);
          }}
        >
          <option value="">Aucun choix — requis pour un voice-over</option>
          {view.options.map((option) => (
            <option key={option.stableKey} value={option.stableKey}>
              {option.label} · {option.locale} · {option.availability} · consentement {option.consent}
            </option>
          ))}
        </select>
      </label>

      <div className="text-sm">
        <p className="text-[var(--muted)] mb-2">Dialogues personnage — identité résolue, non substituable</p>
        <ul className="space-y-1">
          {view.characters.map((character) => (
            <li key={character.characterId}>
              {character.label} → {character.stableKey}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
