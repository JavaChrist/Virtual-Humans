/**
 * View-model for Director merge/export. No engine picker. Runtime remains OFF.
 */
export type MergeExportSectionView = {
  title: "Merge / Export";
  availableInProduction: false;
  engineExposed: false;
  directorNavChanged: false;
  bundleResolved: boolean;
  mergeReadiness: "prepared_disabled" | "blocked";
  exportReadiness: "prepared_disabled" | "blocked";
  disabledReason: string;
  blockingReasons: string[];
  mergeExportAuthorized: false;
  publicationAllowed: false;
  fakeStateLabel: string | null;
};

export function buildMergeExportSectionView(input?: {
  videoResolved?: boolean;
  audioResolved?: boolean;
  lipsyncResolved?: boolean;
  bundleCoherent?: boolean;
  runtimeOff?: boolean;
  fakeState?: "idle" | "dry_run" | "executing" | "completed" | null;
}): MergeExportSectionView {
  const videoResolved = input?.videoResolved === true;
  const audioResolved = input?.audioResolved === true;
  const lipsyncResolved = input?.lipsyncResolved === true;
  const bundleCoherent = input?.bundleCoherent !== false && videoResolved && audioResolved && lipsyncResolved;
  const runtimeOff = input?.runtimeOff !== false;
  const blockingReasons: string[] = [];
  if (!videoResolved) blockingReasons.push("Référence vidéo I2V absente.");
  if (!audioResolved) blockingReasons.push("Référence audio Voice absente.");
  if (!lipsyncResolved) blockingReasons.push("Output lipsync absent.");
  if (!bundleCoherent) blockingReasons.push("Bundle incohérent : sélection explicite requise.");
  if (runtimeOff) {
    blockingReasons.push("Chemin merge/export préparé mais désactivé. Aucun moteur n’est sélectionné.");
  }
  blockingReasons.push("L’export réel n’est pas autorisé. Publication et téléchargement restent interdits.");
  const prepared = bundleCoherent && runtimeOff;
  return {
    title: "Merge / Export",
    availableInProduction: false,
    engineExposed: false,
    directorNavChanged: false,
    bundleResolved: bundleCoherent,
    mergeReadiness: prepared ? "prepared_disabled" : "blocked",
    exportReadiness: prepared ? "prepared_disabled" : "blocked",
    disabledReason:
      "Merge / export /director est câblé en mode désactivé. Aucune exécution réelle, aucun fichier et aucune publication ne sont disponibles.",
    blockingReasons,
    mergeExportAuthorized: false,
    publicationAllowed: false,
    fakeStateLabel: input?.fakeState && input.fakeState !== "idle" ? input.fakeState : null,
  };
}
