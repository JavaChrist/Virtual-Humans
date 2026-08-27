/**
 * User-facing update-blocker copy. Short, no HTML, no ids, no secrets.
 * Reuses the existing in-memory registry — this is not a second registry.
 */

export const UPDATE_BLOCKER_REASONS = {
  generating: "Une génération est en cours.",
  saving: "Votre projet est en cours d'enregistrement.",
  unsaved: "Des modifications ne sont pas encore enregistrées.",
  login: "Connexion en cours.",
} as const;

export type UpdateBlockerReason =
  (typeof UPDATE_BLOCKER_REASONS)[keyof typeof UPDATE_BLOCKER_REASONS];

export const UPDATE_BLOCKER_IDS = {
  directorText: (kind: string) => `director-text-${kind}`,
  directorProduction: "director-production",
  directorProjectCreate: "director-project-create",
  directorBriefDraft: "director-brief-draft",
  directorBriefRevision: "director-brief-revision",
  directorDelivery: "director-delivery",
  directorRouting: "director-routing",
  directorPrompts: "director-prompts",
  directorMotionReview: "director-motion-review",
  generateVideo: "generate-video",
  generateScene: "generate-scene",
  sceneSave: "scene-save",
  generateLipsync: "generate-lipsync",
  generateImage: "generate-image",
  generateVoice: "generate-voice",
  generateStoryboard: "generate-storyboard",
  productsSave: "products-save",
  login: "login",
} as const;
