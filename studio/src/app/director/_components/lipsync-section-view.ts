/**
 * View-model for Director lipsync. No provider picker. Runtime remains OFF.
 */
export type LipsyncSectionView = {
  title: "Lipsync";
  availableInProduction: false;
  providerExposed: false;
  directorNavChanged: false;
  videoResolved: boolean;
  audioResolved: boolean;
  readiness: "prepared_disabled" | "blocked";
  disabledReason: string;
  blockingReasons: string[];
  mergeExportAuthorized: false;
  fakeStateLabel: string | null;
};

export function buildLipsyncSectionView(input?: {
  videoResolved?: boolean;
  audioResolved?: boolean;
  runtimeOff?: boolean;
  fakeState?: "idle" | "dry_run" | "executing" | "completed" | null;
}): LipsyncSectionView {
  const videoResolved = input?.videoResolved === true;
  const audioResolved = input?.audioResolved === true;
  const runtimeOff = input?.runtimeOff !== false;
  const blockingReasons: string[] = [];
  if (!videoResolved) blockingReasons.push("Référence vidéo absente.");
  if (!audioResolved) blockingReasons.push("Référence audio absente.");
  if (runtimeOff) blockingReasons.push("Chemin lipsync préparé mais désactivé. Aucun provider n’est sélectionné.");
  blockingReasons.push("Merge et export restent interdits.");
  return {
    title: "Lipsync",
    availableInProduction: false,
    providerExposed: false,
    directorNavChanged: false,
    videoResolved,
    audioResolved,
    readiness: videoResolved && audioResolved && runtimeOff ? "prepared_disabled" : "blocked",
    disabledReason: "Lipsync /director est câblé en mode désactivé. Aucune exécution réelle n’est disponible.",
    blockingReasons,
    mergeExportAuthorized: false,
    fakeStateLabel: input?.fakeState && input.fakeState !== "idle" ? input.fakeState : null,
  };
}
