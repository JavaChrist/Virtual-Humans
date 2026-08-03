import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCommandFingerprint,
  buildIdempotencyKey,
  GenerationDomainError,
  validateGenerationCommand,
  validateIdempotencyKey,
} from "../index";
import { AT, makeCommand, makeMinimalPackage, makeResolved, makeStep } from "./fixtures";

test("commande valide", () => {
  assert.doesNotThrow(() => validateGenerationCommand(makeCommand()));
});

test("mauvais projet / scène", () => {
  assert.throws(
    () => validateGenerationCommand(makeCommand({ projectId: "other" })),
    GenerationDomainError,
  );
  assert.throws(
    () => validateGenerationCommand(makeCommand({ sceneId: "sc-x" })),
    GenerationDomainError,
  );
});

test("prompt variant absent", () => {
  assert.throws(
    () =>
      validateGenerationCommand(
        makeCommand({
          step: makeStep({ promptVariantId: "missing" }),
        }),
      ),
    GenerationDomainError,
  );
});

test("référence manquante / dépendance non résolue", () => {
  const pkg = makeMinimalPackage({
    references: [
      {
        id: "r1",
        kind: "character",
        sourceId: "char-1",
        role: "presenter",
        required: true,
      },
    ],
  });
  assert.throws(
    () => validateGenerationCommand(makeCommand({ scenePackage: pkg })),
    GenerationDomainError,
  );
  assert.throws(
    () =>
      validateGenerationCommand(
        makeCommand({
          step: makeStep({ dependsOnStepIds: ["step:prev"] }),
        }),
      ),
    GenerationDomainError,
  );
  assert.doesNotThrow(() =>
    validateGenerationCommand(
      makeCommand({
        scenePackage: pkg,
        step: makeStep({ dependsOnStepIds: ["step:prev"] }),
        resolvedInputs: [
          makeResolved({ assetId: "char-1", role: "presenter" }),
          makeResolved({
            assetId: "out-1",
            role: "from_step",
            fromStepId: "step:prev",
          }),
        ],
      }),
    ),
  );
});

test("idempotency clé stable / attempt / invalide", () => {
  const a = buildIdempotencyKey({
    projectId: "p",
    planRevisionId: "pl",
    sceneId: "s",
    stepId: "st",
    attempt: 1,
  });
  const b = buildIdempotencyKey({
    projectId: "p",
    planRevisionId: "pl",
    sceneId: "s",
    stepId: "st",
    attempt: 1,
  });
  assert.equal(a, b);
  assert.notEqual(
    a,
    buildIdempotencyKey({
      projectId: "p",
      planRevisionId: "pl",
      sceneId: "s",
      stepId: "st",
      attempt: 2,
    }),
  );
  assert.throws(() => validateIdempotencyKey("bad key"), GenerationDomainError);
  assert.throws(
    () => validateIdempotencyKey("x".repeat(201)),
    GenerationDomainError,
  );
});

test("empreinte stable — URL signée exclue", () => {
  const base = {
    projectId: "p",
    planRevisionId: "pl",
    sceneId: "s",
    stepId: "st",
    action: "video",
    providerId: "fal",
    modelId: "m",
    capabilityProfile: "video.text_to_video",
    referenceAssetIds: ["a1"],
    dependsOnStepIds: [] as string[],
    attempt: 1,
  };
  const f1 = buildCommandFingerprint(base);
  const f2 = buildCommandFingerprint(base);
  assert.equal(f1, f2);
  // Changing only a signed URL is impossible in fingerprint input — asset ids only
  const f3 = buildCommandFingerprint({ ...base, referenceAssetIds: ["a2"] });
  assert.notEqual(f1, f3);
  void AT;
});
