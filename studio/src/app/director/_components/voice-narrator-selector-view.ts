/**
 * View-model for the /director narrator selector. Never includes a voiceId.
 */
import type { VoiceIdentityRecord, VoiceIdentityStableKey } from "@/application/production/phase-11c-voice-identity-catalog";

export type VoiceNarratorOption = {
  stableKey: "narrator_female" | "narrator_male";
  label: "Narratrice" | "Narrateur";
  role: "narrator";
  locale: "fr";
  availability: "prepared" | "unavailable" | "blocked";
  consent: "valide" | "bloqué";
};

export type VoiceCharacterResolutionView = {
  characterId: "mei" | "tom";
  label: "Mei" | "Tom";
  stableKey: "character_mei" | "character_tom";
  substitutable: false;
};

export type VoiceNarratorSelectorView = {
  title: "Voix narrateur";
  inoperative: true;
  productionPersisted: false;
  generatesOnSelect: false;
  reason: string;
  options: VoiceNarratorOption[];
  selected: "" | "narrator_female" | "narrator_male";
  characters: VoiceCharacterResolutionView[];
};

export function buildVoiceNarratorSelectorView(input?: {
  identities?: Partial<Record<VoiceIdentityStableKey, Pick<VoiceIdentityRecord, "status">>>;
  selected?: "" | "narrator_female" | "narrator_male";
  consents?: Partial<Record<"narrator_female" | "narrator_male", "authorized" | "missing" | "revoked">>;
}): VoiceNarratorSelectorView {
  const statusOf = (key: "narrator_female" | "narrator_male") =>
    input?.identities?.[key]?.status === "prepared" ? "prepared" : "unavailable";
  const consentOf = (key: "narrator_female" | "narrator_male") =>
    input?.consents?.[key] === "authorized" ? "valide" : "bloqué";
  return {
    title: "Voix narrateur",
    inoperative: true,
    productionPersisted: false,
    generatesOnSelect: false,
    reason: "Choix inopérant — migration Voice non appliquée, flags OFF.",
    options: [
      {
        stableKey: "narrator_female",
        label: "Narratrice",
        role: "narrator",
        locale: "fr",
        availability: statusOf("narrator_female"),
        consent: consentOf("narrator_female"),
      },
      {
        stableKey: "narrator_male",
        label: "Narrateur",
        role: "narrator",
        locale: "fr",
        availability: statusOf("narrator_male"),
        consent: consentOf("narrator_male"),
      },
    ],
    selected: input?.selected ?? "",
    characters: [
      { characterId: "mei", label: "Mei", stableKey: "character_mei", substitutable: false },
      { characterId: "tom", label: "Tom", stableKey: "character_tom", substitutable: false },
    ],
  };
}

export function applyNarratorSelection(
  current: VoiceNarratorSelectorView,
  next: "" | "narrator_female" | "narrator_male",
): { view: VoiceNarratorSelectorView; generated: false; persisted: false } {
  return {
    view: { ...current, selected: next, generatesOnSelect: false, productionPersisted: false },
    generated: false,
    persisted: false,
  };
}
