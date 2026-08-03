/**
 * Clip result validation (VHS-111C).
 */

import type { AiccosClipResult } from "./contracts";
import { AiccosPipelineError } from "./errors";

export function validateAiccosClipResult(raw: unknown): AiccosClipResult {
  if (!raw || typeof raw !== "object") {
    throw new AiccosPipelineError("invalid_clip_result", "Résultat clip AICCOS invalide.", {
      httpStatusHint: 502,
    });
  }
  const clip = raw as { id?: unknown; publicUrl?: unknown; title?: unknown };
  const id = typeof clip.id === "string" ? clip.id.trim() : "";
  const publicUrl = typeof clip.publicUrl === "string" ? clip.publicUrl.trim() : "";
  const title = typeof clip.title === "string" ? clip.title.trim() : "";

  if (!id) {
    throw new AiccosPipelineError("invalid_clip_result", "Identifiant clip AICCOS absent.", {
      httpStatusHint: 502,
    });
  }
  if (!publicUrl || !/^https?:\/\//i.test(publicUrl)) {
    throw new AiccosPipelineError("invalid_clip_result", "URL publique clip invalide.", {
      httpStatusHint: 502,
    });
  }
  if (!title) {
    throw new AiccosPipelineError("invalid_clip_result", "Titre clip AICCOS absent.", {
      httpStatusHint: 502,
    });
  }

  return { id, publicUrl, title };
}

export function validateImportSession(raw: {
  path?: unknown;
  signedUrl?: unknown;
  expiresAt?: unknown;
}): { importId: string; uploadUrl: string; expiresAt?: string } {
  const importId = typeof raw.path === "string" ? raw.path.trim() : "";
  const uploadUrl = typeof raw.signedUrl === "string" ? raw.signedUrl.trim() : "";
  if (!importId || !uploadUrl) {
    throw new AiccosPipelineError("invalid_import_session", "Session d'import AICCOS invalide.", {
      httpStatusHint: 502,
    });
  }
  if (!/^https?:\/\//i.test(uploadUrl)) {
    throw new AiccosPipelineError("invalid_import_session", "URL d'upload invalide.", {
      httpStatusHint: 502,
    });
  }
  const expiresAt =
    typeof raw.expiresAt === "string" && raw.expiresAt.trim() ? raw.expiresAt.trim() : undefined;
  return { importId, uploadUrl, expiresAt };
}
