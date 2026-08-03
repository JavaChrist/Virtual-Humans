import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dedupeConstraints,
  findConstraintContradictions,
  type ConstraintBlock,
} from "../constraints";

test("déduplication", () => {
  const list = dedupeConstraints([
    {
      code: "a",
      description: "Same",
      source: "brief",
      severity: "required",
    },
    {
      code: "a",
      description: "same",
      source: "brief",
      severity: "required",
    },
  ]);
  assert.equal(list.length, 1);
});

test("contradiction bloquante", () => {
  const block: ConstraintBlock = {
    required: [
      {
        code: "must_keep_outfit",
        description: "Keep outfit",
        source: "storyboard",
        severity: "required",
      },
    ],
    forbidden: [
      {
        code: "forbid_keep_outfit",
        description: "Keep outfit",
        source: "storyboard",
        severity: "required",
      },
    ],
    continuity: [],
    safety: [],
  };
  assert.ok(findConstraintContradictions(block).length > 0);
});

test("contraintes cohérentes", () => {
  const block: ConstraintBlock = {
    required: [
      {
        code: "must_identity",
        description: "Preserve identity",
        source: "visual_direction",
        severity: "required",
      },
    ],
    forbidden: [
      {
        code: "forbid_extra_people",
        description: "No extra people",
        source: "storyboard",
        severity: "required",
      },
    ],
    continuity: [],
    safety: [],
  };
  assert.equal(findConstraintContradictions(block).length, 0);
});
