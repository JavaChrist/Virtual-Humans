/**
 * Phase 11C — synthetic Voice identity catalog dry-run. 0 provider, 0 Production write.
 */
import { PHASE_11C_CANONICAL_SCRIPT_ID } from "./phase-11c-spoken-segment";
import {
  PHASE_11C_PROJECT_ID,
  PHASE_11C_WORKSPACE_ID,
} from "./phase-11c-voice-allowlist";
import {
  buildVoiceIdentityCatalog,
  decideVoiceIdentityCatalogVerdict,
  fingerprintCatalogSelection,
  type VoiceIdentityStableKey,
  type VoiceLocatorResolution,
} from "./phase-11c-voice-identity-catalog";
import {
  createVoiceIdentityConsentStore,
  persistVoiceIdentityConsent,
} from "./phase-11c-voice-identity-consent";
import {
  createProjectVoiceBindingStore,
  persistProjectVoiceBinding,
} from "./phase-11c-voice-identity-binding";
import { resolveVoiceIdentityForSegment } from "./phase-11c-voice-identity-resolver";
import {
  assertNoVoiceIdInPlan,
  buildVoiceIdentityPlanRef,
  fingerprintVoiceIdentityPlan,
  voiceIdentityPlanIsStale,
} from "./phase-11c-voice-identity-plan";

export function syntheticLocator(fingerprint: string, locator: string): VoiceLocatorResolution {
  return {
    locator,
    present: true,
    fingerprint,
    fingerprintPrefix: fingerprint.slice(0, 12),
    valueExposed: false,
  };
}

export function runVoiceIdentityCatalogDryRun(input: {
  env?: Record<string, string | undefined>;
  resolutions: Record<VoiceIdentityStableKey, VoiceLocatorResolution>;
}): {
  meiDialogue: VoiceIdentityStableKey;
  tomDialogue: VoiceIdentityStableKey;
  voiceOverFemale: VoiceIdentityStableKey;
  voiceOverMale: VoiceIdentityStableKey;
  voiceOverWithoutChoiceBlocked: true;
  collisionBlocked: true;
  providerCalls: 0;
  productionWrites: 0;
  voiceIdExposed: false;
  femalePlanFingerprint: string;
  malePlanFingerprint: string;
  selectionChangeCreatesNewFingerprint: true;
  autoGenerate: false;
  verdict: ReturnType<typeof decideVoiceIdentityCatalogVerdict>;
} {
  const catalog = buildVoiceIdentityCatalog({
    env: input.env ?? {},
    resolutions: input.resolutions,
  });
  const consents = createVoiceIdentityConsentStore();
  const when = "2026-08-15T18:00:00.000Z";
  const consentIds: Record<VoiceIdentityStableKey, string> = {
    character_mei: "00000000-0000-4000-8000-000000000001",
    character_tom: "00000000-0000-4000-8000-000000000002",
    narrator_female: "00000000-0000-4000-8000-000000000003",
    narrator_male: "00000000-0000-4000-8000-000000000004",
  };
  for (const key of Object.keys(catalog.identities) as VoiceIdentityStableKey[]) {
    persistVoiceIdentityConsent(consents, {
      id: consentIds[key],
      voiceIdentityStableKey: key,
      createdAt: when,
      idempotencyKey: `consent-${key}-v1`,
    });
  }
  const consentMap = {
    character_mei: consents.records.find((row) => row.voiceIdentityStableKey === "character_mei"),
    character_tom: consents.records.find((row) => row.voiceIdentityStableKey === "character_tom"),
    narrator_female: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_female"),
    narrator_male: consents.records.find((row) => row.voiceIdentityStableKey === "narrator_male"),
  };

  const mei = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "dialogue",
    speakerKind: "character",
    characterId: "mei",
    identities: catalog.identities,
    consents: consentMap,
  });
  const tom = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "dialogue",
    speakerKind: "character",
    characterId: "tom",
    identities: catalog.identities,
    consents: consentMap,
  });
  const female = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: catalog.identities,
    consents: consentMap,
    narratorChoices: ["narrator_female"],
  });
  const male = resolveVoiceIdentityForSegment({
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    identities: catalog.identities,
    consents: consentMap,
    narratorChoices: ["narrator_male"],
  });

  let voiceOverWithoutChoiceBlocked = false;
  try {
    resolveVoiceIdentityForSegment({
      workspaceId: PHASE_11C_WORKSPACE_ID,
      projectId: PHASE_11C_PROJECT_ID,
      spokenKind: "voice_over",
      speakerKind: "narrator",
      identities: catalog.identities,
      consents: consentMap,
    });
  } catch {
    voiceOverWithoutChoiceBlocked = true;
  }

  let collisionBlocked = false;
  try {
    buildVoiceIdentityCatalog({
      env: {},
      resolutions: {
        ...input.resolutions,
        narrator_female: input.resolutions.character_mei,
      },
    });
  } catch {
    collisionBlocked = true;
  }

  const femalePlan = buildVoiceIdentityPlanRef({
    resolution: female,
    consentAttestationId: consentMap.narrator_female?.id ?? null,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
    segmentId: "segment-2",
    spokenKind: "voice_over",
    speaker: "narrator",
    selectionRevision: 1,
  });
  const malePlan = buildVoiceIdentityPlanRef({
    resolution: male,
    consentAttestationId: consentMap.narrator_male?.id ?? null,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: 1,
    segmentId: "segment-2",
    spokenKind: "voice_over",
    speaker: "narrator",
    selectionRevision: 2,
  });
  assertNoVoiceIdInPlan(femalePlan);
  assertNoVoiceIdInPlan(malePlan);
  if (!voiceIdentityPlanIsStale({ plan: femalePlan, narratorStableKey: "narrator_male", selectionRevision: 2 })) {
    throw new Error("Phase 11C dry-run: selection change must stale the previous plan.");
  }

  const bindings = createProjectVoiceBindingStore();
  persistProjectVoiceBinding(bindings, {
    id: "11111111-1111-4111-8111-111111111111",
    bindingRole: "narrator",
    voiceIdentityStableKey: "narrator_female",
    selectedBy: "christian",
    createdAt: when,
    idempotencyKey: "bind-female-v1",
    expectedRevision: 0,
  });

  return {
    meiDialogue: mei.stableKey,
    tomDialogue: tom.stableKey,
    voiceOverFemale: female.stableKey,
    voiceOverMale: male.stableKey,
    voiceOverWithoutChoiceBlocked: voiceOverWithoutChoiceBlocked ? true : ((): never => {
      throw new Error("Phase 11C dry-run: missing narrator choice must be blocked.");
    })(),
    collisionBlocked: collisionBlocked ? true : ((): never => {
      throw new Error("Phase 11C dry-run: identity collision must be blocked.");
    })(),
    providerCalls: 0,
    productionWrites: 0,
    voiceIdExposed: false,
    femalePlanFingerprint: fingerprintVoiceIdentityPlan(femalePlan),
    malePlanFingerprint: fingerprintVoiceIdentityPlan(malePlan),
    selectionChangeCreatesNewFingerprint: ((): true => {
      const changed =
        fingerprintCatalogSelection({
          stableKey: "narrator_female",
          scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
          scriptRevision: 1,
          selectionRevision: 1,
          expectedFingerprint: female.expectedFingerprint,
        }) !==
        fingerprintCatalogSelection({
          stableKey: "narrator_male",
          scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
          scriptRevision: 1,
          selectionRevision: 2,
          expectedFingerprint: male.expectedFingerprint,
        });
      if (!changed) {
        throw new Error("Phase 11C dry-run: selection change must create a new fingerprint.");
      }
      return true;
    })(),
    autoGenerate: false,
    verdict: decideVoiceIdentityCatalogVerdict(catalog),
  };
}
