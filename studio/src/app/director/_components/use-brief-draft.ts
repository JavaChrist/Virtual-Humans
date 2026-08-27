"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DIRECTOR_BRIEF_DRAFT_KEY,
  DIRECTOR_DRAFT_CHANGED_EVENT,
  clearBriefDraft,
  hasBriefDraft,
  loadBriefDraft,
  newBriefDraft,
  parseDraftJson,
  saveBriefDraft,
  updateDraftFields,
  type LoadDraftResult,
} from "@/application/director/draft";
import {
  AUTOSAVE_DEBOUNCE_MS,
  autosaveStatusLabel,
  clampStep,
  createDebouncer,
  type AutosaveStatus,
} from "@/application/director/progress";
import type { VideoProjectBriefDraft, VideoProjectBriefFields } from "@/domain/brief";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockAutosave } from "@/lib/update-blocker-policy";

function subscribeDraftStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === DIRECTOR_BRIEF_DRAFT_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DIRECTOR_DRAFT_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DIRECTOR_DRAFT_CHANGED_EVENT, onChange);
  };
}

function getDraftRawSnapshot(): string {
  try {
    return window.localStorage.getItem(DIRECTOR_BRIEF_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerDraftRawSnapshot(): string {
  return "";
}

export function useBriefDraft() {
  const storedRaw = useSyncExternalStore(
    subscribeDraftStorage,
    getDraftRawSnapshot,
    getServerDraftRawSnapshot,
  );

  const stored = useMemo((): LoadDraftResult => {
    if (!storedRaw) return { ok: false, reason: "missing" };
    return parseDraftJson(storedRaw);
  }, [storedRaw]);

  const [sessionDraft, setSessionDraft] = useState<VideoProjectBriefDraft | null>(null);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [sessionActive, setSessionActive] = useState(false);
  const draftRef = useRef<VideoProjectBriefDraft>(newBriefDraft(0));
  const debouncerRef = useRef(createDebouncer(AUTOSAVE_DEBOUNCE_MS));

  const draft = sessionDraft ?? (stored.ok ? stored.draft : newBriefDraft(0));
  const hadExisting = stored.ok;
  const displayStatus: AutosaveStatus = sessionActive
    ? status
    : stored.ok
      ? "saved"
      : "idle";

  useUpdateBlocker(
    shouldBlockAutosave(displayStatus),
    UPDATE_BLOCKER_IDS.directorBriefDraft,
    UPDATE_BLOCKER_REASONS.unsaved,
  );

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const debouncer = debouncerRef.current;
    return () => debouncer.cancel();
  }, []);

  const persist = useCallback((next: VideoProjectBriefDraft) => {
    setStatus("saving");
    const result = saveBriefDraft(next);
    setStatus(result.ok ? "saved" : "error");
  }, []);

  const patchFields = useCallback(
    (patch: Partial<VideoProjectBriefFields>, step?: number) => {
      setSessionActive(true);
      setStatus("dirty");
      setSessionDraft((prev) => {
        const base = prev ?? (stored.ok ? stored.draft : newBriefDraft(0));
        const next = updateDraftFields(base, patch, step ?? base.currentStep);
        draftRef.current = next;
        debouncerRef.current.schedule(() => persist(next));
        return next;
      });
    },
    [persist, stored],
  );

  const setStep = useCallback(
    (step: number) => {
      setSessionActive(true);
      setStatus("dirty");
      setSessionDraft((prev) => {
        const base = prev ?? (stored.ok ? stored.draft : newBriefDraft(0));
        const next = {
          ...base,
          currentStep: clampStep(step),
          updatedAt: new Date().toISOString(),
        };
        draftRef.current = next;
        debouncerRef.current.schedule(() => persist(next));
        return next;
      });
    },
    [persist, stored],
  );

  const resetDraft = useCallback(() => {
    debouncerRef.current.cancel();
    clearBriefDraft();
    const empty = newBriefDraft(0);
    setSessionDraft(empty);
    setSessionActive(true);
    draftRef.current = empty;
    setStatus("idle");
  }, []);

  const flush = useCallback(() => {
    debouncerRef.current.flush(() => persist(draftRef.current));
  }, [persist]);

  return {
    draft,
    status: displayStatus,
    statusLabel: autosaveStatusLabel(displayStatus),
    hydrated: true,
    hadExisting,
    patchFields,
    setStep,
    resetDraft,
    flush,
    reload: (): LoadDraftResult => {
      const loaded = loadBriefDraft();
      if (loaded.ok) {
        setSessionDraft(loaded.draft);
        setSessionActive(true);
        setStatus("saved");
      }
      return loaded;
    },
    checkExists: () => hasBriefDraft(),
  };
}
