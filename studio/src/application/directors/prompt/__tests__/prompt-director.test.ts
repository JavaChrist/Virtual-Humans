import assert from "node:assert/strict";
import { test } from "node:test";
import type { PromptAnalysisCandidate } from "@/domain/prompt";
import {
  makePromptChain,
  makeValidPromptCandidate,
} from "@/domain/prompt/__tests__/fixtures";
import { createPromptDirector } from "../prompt-director";
import type { PromptAnalyzerPort } from "../analyzer-port";

function fake(candidate: PromptAnalysisCandidate): PromptAnalyzerPort {
  return { async analyze() { return candidate; } };
}

test("candidat valide → completed", async () => {
  const chain = makePromptChain({ withCharacter: true });
  const director = createPromptDirector({
    analyzer: fake(makeValidPromptCandidate()),
  });
  const brief = { ...chain.brief };
  const result = await director.run(
    {
      brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
      storyboard: chain.storyboard,
    },
    {
      correlationId: "corr-pd-run",
      mode: "execute",
      createdBy: "tester",
      planId: "pkgfixed",
    },
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.output.storyboardRevisionId, chain.storyboard.id);
  assert.equal(result.output.packages.length, chain.storyboard.scenes.length);
  assert.ok(result.output.packages.every((p) => p.correlationId === "corr-pd-run"));
  assert.ok(Object.isFrozen(result.output));
  assert.equal(brief.projectId, chain.brief.projectId);
});

test("référence essentielle absente → needs_input", async () => {
  const chain = makePromptChain({ withCharacter: true });
  // URL signée filtrée par mapStoryboardReferences → référence requise absente du package
  const storyboard = {
    ...chain.storyboard,
    scenes: chain.storyboard.scenes.map((s) => ({
      ...s,
      references: [
        {
          id: "missing",
          kind: "outfit" as const,
          sourceId: "https://cdn.example/?X-Amz-Signature=abc123",
          role: "wardrobe",
          required: true,
        },
      ],
    })),
  };
  const director = createPromptDirector({
    analyzer: fake(makeValidPromptCandidate()),
  });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
      storyboard: storyboard as typeof chain.storyboard,
    },
    { correlationId: "corr-pd-run", mode: "execute" },
  );
  assert.ok(result.status === "needs_input" || result.status === "invalid");
});

test("candidat invalide → invalid", async () => {
  const chain = makePromptChain();
  const director = createPromptDirector({
    analyzer: {
      async analyze() {
        return { notes: "x", provider: "bad" } as PromptAnalysisCandidate;
      },
    },
  });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
      storyboard: chain.storyboard,
    },
    { correlationId: "corr-pd-run", mode: "execute" },
  );
  assert.equal(result.status, "invalid");
});

test("erreur du port sans fuite", async () => {
  const chain = makePromptChain();
  const director = createPromptDirector({
    analyzer: {
      async analyze() {
        throw new Error("provider key sk-secretKEY123 leaked");
      },
    },
  });
  const result = await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
      storyboard: chain.storyboard,
    },
    { correlationId: "corr-pd-run", mode: "execute" },
  );
  assert.equal(result.status, "invalid");
  if (result.status !== "invalid") return;
  assert.equal(result.errors[0]!.message.includes("sk-secretKEY123"), false);
  assert.ok(result.errors[0]!.message.includes("[redacted]"));
});

test("entrées non mutées", async () => {
  const chain = makePromptChain();
  const sbCopy = JSON.stringify(chain.storyboard);
  const director = createPromptDirector({
    analyzer: fake(makeValidPromptCandidate()),
  });
  await director.run(
    {
      brief: chain.brief,
      marketingPlan: chain.marketingPlan,
      creativeConcept: chain.creativeConcept,
      videoScript: chain.videoScript,
      visualDirection: chain.visualDirection,
      storyboard: chain.storyboard,
    },
    { correlationId: "corr-pd-run", mode: "execute" },
  );
  assert.equal(JSON.stringify(chain.storyboard), sbCopy);
});
