/**
 * Director brief draft — application layer (VHS-112).
 * Pure storage helpers; injectable storage for tests. No React.
 */

import {
  BRIEF_DRAFT_VERSION,
  VideoProjectBriefDraftSchema,
  createEmptyBriefDraft,
  type VideoProjectBriefDraft,
  type VideoProjectBriefFields,
} from "@/domain/brief";

export const DIRECTOR_BRIEF_DRAFT_KEY = "virtual-humans:director:v2:brief-draft";
export const DIRECTOR_DRAFT_QUARANTINE_KEY = "virtual-humans:director:v2:brief-draft:quarantine";

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type LoadDraftResult =
  | { ok: true; draft: VideoProjectBriefDraft }
  | { ok: false; reason: "missing" | "corrupt" | "unsupported_version" | "unavailable" };

export type SaveDraftResult = { ok: true } | { ok: false; reason: "unavailable" | "serialize" };

const KNOWN_DRAFT_VERSIONS: ReadonlySet<string> = new Set([BRIEF_DRAFT_VERSION]);

/** Same-tab signal for useSyncExternalStore subscribers. */
export const DIRECTOR_DRAFT_CHANGED_EVENT = "vh:director-draft";

export function notifyDraftStorageChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DIRECTOR_DRAFT_CHANGED_EVENT));
}

function browserStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = window.localStorage;
    // Probe availability (private mode / blocked storage)
    const probe = "__vh_director_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function getDefaultDraftStorage(): DraftStorage | null {
  return browserStorage();
}

export function parseDraftJson(raw: string): LoadDraftResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "corrupt" };
  }

  const version = (parsed as { draftVersion?: unknown }).draftVersion;
  if (typeof version !== "string" || !KNOWN_DRAFT_VERSIONS.has(version)) {
    return { ok: false, reason: "unsupported_version" };
  }

  const result = VideoProjectBriefDraftSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "corrupt" };
  }
  return { ok: true, draft: result.data };
}

export function loadBriefDraft(storage: DraftStorage | null = getDefaultDraftStorage()): LoadDraftResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(DIRECTOR_BRIEF_DRAFT_KEY);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (raw == null || raw === "") return { ok: false, reason: "missing" };

  const parsed = parseDraftJson(raw);
  if (!parsed.ok) {
    try {
      storage.setItem(DIRECTOR_DRAFT_QUARANTINE_KEY, raw);
      storage.removeItem(DIRECTOR_BRIEF_DRAFT_KEY);
    } catch {
      /* ignore quarantine failures */
    }
  }
  return parsed;
}

export function saveBriefDraft(
  draft: VideoProjectBriefDraft,
  storage: DraftStorage | null = getDefaultDraftStorage(),
): SaveDraftResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  const toSave: VideoProjectBriefDraft = {
    ...draft,
    draftVersion: BRIEF_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
  };
  const checked = VideoProjectBriefDraftSchema.safeParse(toSave);
  if (!checked.success) return { ok: false, reason: "serialize" };
  try {
    storage.setItem(DIRECTOR_BRIEF_DRAFT_KEY, JSON.stringify(checked.data));
    notifyDraftStorageChanged();
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function clearBriefDraft(storage: DraftStorage | null = getDefaultDraftStorage()): SaveDraftResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  try {
    storage.removeItem(DIRECTOR_BRIEF_DRAFT_KEY);
    notifyDraftStorageChanged();
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function hasBriefDraft(storage: DraftStorage | null = getDefaultDraftStorage()): boolean {
  const loaded = loadBriefDraft(storage);
  return loaded.ok;
}

export function updateDraftFields(
  draft: VideoProjectBriefDraft,
  patch: Partial<VideoProjectBriefFields>,
  currentStep?: number,
): VideoProjectBriefDraft {
  return {
    draftVersion: BRIEF_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    currentStep: currentStep ?? draft.currentStep,
    fields: {
      ...draft.fields,
      ...patch,
      mediaReferences: patch.mediaReferences ?? draft.fields.mediaReferences,
    },
  };
}

export function newBriefDraft(step = 0): VideoProjectBriefDraft {
  return createEmptyBriefDraft(step);
}
