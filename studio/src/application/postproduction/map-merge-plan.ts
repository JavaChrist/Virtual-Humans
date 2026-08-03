/**
 * Pure MergePlan → FalComposeInput (VHS-111B).
 * Never mutates the plan; public errors never include source URLs.
 */

import type { MergePlan } from "@/domain/postproduction";
import { PostProductionDomainError } from "@/domain/postproduction";
import type { FalComposeInput } from "@/infrastructure/postproduction/fal-compose";

function sourceUrlAndExpiry(
  source: MergePlan["timeline"][number]["source"],
  at: string
): { url: string; expired: boolean } {
  if (source.kind === "temporary_external") {
    return {
      url: source.url,
      expired: Date.parse(source.expiresAt) <= Date.parse(at),
    };
  }
  if (source.kind === "inline_data_url") {
    return { url: source.dataUrl, expired: false };
  }
  throw new PostProductionDomainError(
    "missing_asset",
    "Source asset interne non supportée pour fal compose."
  );
}

export function mapMergePlanToFalComposeInput(
  plan: MergePlan,
  at: string
): FalComposeInput {
  if (plan.overlays.length > 0) {
    throw new PostProductionDomainError(
      "unsupported_overlay",
      "Overlays / texte postproduction non supportés par fal compose."
    );
  }

  for (const t of plan.transitions) {
    if (t.kind !== "cut" && t.kind !== "none") {
      throw new PostProductionDomainError(
        "unsupported_transition",
        `Transition non supportée: ${t.kind}.`
      );
    }
  }

  const nonEmbedded = plan.audio.tracks.filter((t) => t.role !== "embedded_video");
  if (nonEmbedded.length > 0) {
    throw new PostProductionDomainError(
      "unsupported_audio_mix",
      "Mix audio multi-sources non supporté par fal compose."
    );
  }

  if (plan.audio.targetLoudnessLufs != null) {
    throw new PostProductionDomainError(
      "unsupported_audio_mix",
      "Cible LUFS non supportée."
    );
  }
  if (plan.audio.fadeInSeconds != null || plan.audio.fadeOutSeconds != null) {
    throw new PostProductionDomainError(
      "unsupported_audio_mix",
      "Fades audio non supportés."
    );
  }

  const clips: FalComposeInput["clips"] = [];
  const ordered = [...plan.timeline].sort((a, b) => a.order - b.order);
  for (const item of ordered) {
    let url: string;
    try {
      const resolved = sourceUrlAndExpiry(item.source, at);
      if (resolved.expired) {
        throw new PostProductionDomainError("expired_asset", "Source expirée.");
      }
      url = resolved.url;
    } catch (e) {
      if (e instanceof PostProductionDomainError) throw e;
      throw new PostProductionDomainError("missing_asset", "Source asset absente.");
    }
    if (!url || url === "[redacted]") {
      throw new PostProductionDomainError("missing_asset", "Source asset absente.");
    }
    // Historical route accepts any string URL; V2 mapping requires http(s) or data:
    if (!/^https?:\/\//i.test(url) && !/^data:/i.test(url)) {
      throw new PostProductionDomainError("invalid_plan", "URL source invalide.");
    }
    if (item.durationSeconds <= 0) {
      throw new PostProductionDomainError("duration_mismatch", "Durée invalide.");
    }
    clips.push({ sourceUrl: url, durationSeconds: item.durationSeconds });
  }

  if (clips.length < 2) {
    throw new PostProductionDomainError(
      "invalid_plan",
      "Au moins 2 clips sont requis pour l'assemblage."
    );
  }

  return {
    clips,
    preserveEmbeddedAudio: plan.audio.preserveEmbeddedAudio,
  };
}
