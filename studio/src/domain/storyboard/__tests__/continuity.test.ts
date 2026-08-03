import assert from "node:assert/strict";
import { test } from "node:test";
import { projectContinuity, defaultContinuityKeys } from "../continuity";
import { finalizeStoryboardProject } from "../finalize";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";

test("règles projetées et clés présentes", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.ok(sb.continuity.projectedRuleIds.length >= 1);
  assert.ok(sb.scenes.every((s) => s.continuityKeys.length > 0));
});

test("clé manquante", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const scenes = candidate.scenes.map((s) => ({
    ...s,
    durationSeconds: 1,
    continuityKeys: [] as string[],
  }));
  const { issues } = projectContinuity(chain.visualDirection, scenes, []);
  assert.ok(issues.some((i) => i.message.includes("manquante")));
});

test("rupture volontaire justifiée", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const vd1 = chain.visualDirection.segments[0]!;
  const vd2 = chain.visualDirection.segments[1]!;
  // Pair isolée : rupture justifiée entre scènes 0 et 1 uniquement
  const pair = candidate.scenes.slice(0, 2).map((s) => ({ ...s, durationSeconds: 1 }));
  pair[0]!.continuityKeys = defaultContinuityKeys(chain.visualDirection, vd1.id);
  pair[1]!.continuityKeys = defaultContinuityKeys(chain.visualDirection, vd2.id).map((k) =>
    k.startsWith("location:") ? "location:other-place" : k,
  );
  const breaks = [
    {
      sceneId: pair[1]!.id,
      scope: "location",
      justification: "Rupture intentionnelle vers un second lieu pour le problème.",
    },
  ];
  const { issues } = projectContinuity(chain.visualDirection, pair, breaks);
  assert.equal(
    issues.filter((i) => i.message.includes("Rupture lieu silencieuse")).length,
    0,
    JSON.stringify(issues),
  );
});

test("rupture silencieuse refusée", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  candidate.scenes[1]!.continuityKeys = candidate.scenes[1]!.continuityKeys.map((k) =>
    k.startsWith("location:") ? "location:break-silent" : k,
  );
  const scenes = candidate.scenes.map((s) => ({ ...s, durationSeconds: 1 }));
  const { issues } = projectContinuity(chain.visualDirection, scenes, []);
  assert.ok(issues.some((i) => i.message.includes("silencieuse")));
});

test("scène sans personnage autorisée", () => {
  const chain = makeStoryboardChain({ withCharacter: false });
  const candidate = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  assert.ok(candidate.scenes.every((s) => s.references.length === 0));
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-1", createdBy: "tester", correlationId: "corr-sb-1" },
  });
  assert.equal(sb.scenes.length > 0, true);
});
