import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePersonality } from "../personality";
import { bulletItems, fencedBlocks, findSection, splitSections } from "../markdown";

const SAMPLE = `# 4. Core personality summary

\`\`\`yaml
character_id: mei
personality_version: 1.0.0
core_traits:
  - warm
  - professional
communication_style:
  - simple
  - direct
\`\`\`

---

# 6. Core identity sentence

\`\`\`text
Mei is warm, modern, professional and reassuring.
\`\`\`

---

# 7. Primary traits

\`\`\`text
Warm
Professional
Reliable
\`\`\`

---

# 8. Secondary traits

\`\`\`text
Playful
Curious
\`\`\`

---

# 9. Prohibited personality traits

* arrogant;
* aggressive;

---

# 66. Calls to action

Preferred:

\`\`\`text
Essayez maintenant.
\`\`\`

Avoid:

\`\`\`text
Achetez immédiatement.
\`\`\`

---

# 67. Greetings

\`\`\`text
Bonjour, je suis Mei.
\`\`\`

---

# 68. Conclusions

\`\`\`text
À bientôt.
\`\`\`

---

# 83. Personality metadata

\`\`\`yaml
warmth_level: high
energy_level: medium
formality_level: medium
humor_level: low
form_of_address: vous
language: fr
character_id: mei
\`\`\`
`;

test("splitSections finds level-1 sections", () => {
  const sections = splitSections(SAMPLE);
  assert.ok(sections.length >= 9);
  assert.ok(findSection(sections, "primary traits"));
});

test("fencedBlocks filters by language", () => {
  const yaml = fencedBlocks(findSection(splitSections(SAMPLE), "core personality summary")!.body, "yaml");
  assert.equal(yaml.length, 1);
  assert.match(yaml[0], /character_id: mei/);
});

test("bulletItems strips markers and punctuation", () => {
  const body = findSection(splitSections(SAMPLE), "prohibited")!.body;
  assert.deepEqual(bulletItems(body), ["arrogant", "aggressive"]);
});

test("parsePersonality builds a structured profile", () => {
  const { profile, issues } = parsePersonality(SAMPLE, "02_PERSONALITY.md");
  assert.deepEqual(profile.coreTraits, ["warm", "professional"]);
  assert.deepEqual(profile.communicationStyle, ["simple", "direct"]);
  assert.deepEqual(profile.primaryTraits, ["Warm", "Professional", "Reliable"]);
  assert.deepEqual(profile.secondaryTraits, ["Playful", "Curious"]);
  assert.deepEqual(profile.prohibitedTraits, ["arrogant", "aggressive"]);
  assert.equal(profile.coreIdentitySentence, "Mei is warm, modern, professional and reassuring.");
  assert.deepEqual(profile.greetings, ["Bonjour, je suis Mei."]);
  assert.deepEqual(profile.conclusions, ["À bientôt."]);
  assert.deepEqual(profile.ctaPreferred, ["Essayez maintenant."]);
  assert.deepEqual(profile.ctaAvoided, ["Achetez immédiatement."]);
  assert.equal(profile.formOfAddress, "vous");
  assert.equal(profile.language, "fr");
  assert.equal(profile.levels.warmth.value, 0.85);
  assert.equal(profile.levels.humor.raw, "low");
  // Non-canonical phrases surface as an info, not an error.
  assert.ok(issues.some((i) => i.code === "PHRASES_NOT_CANONICAL" && i.severity === "info"));
});

test("parsePersonality exposes declared character ids", () => {
  const { declaredCharacterIds } = parsePersonality(SAMPLE, "02_PERSONALITY.md");
  assert.equal(declaredCharacterIds.summary, "mei");
  assert.equal(declaredCharacterIds.metadata, "mei");
});

test("parsePersonality flags empty core traits as an error", () => {
  const { issues } = parsePersonality("# 1. Purpose\n\nNothing structured here.\n", "x.md");
  assert.ok(issues.some((i) => i.code === "PERSONALITY_CORE_TRAITS_EMPTY" && i.severity === "error"));
});
