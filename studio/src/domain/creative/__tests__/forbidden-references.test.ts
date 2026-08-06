import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectForbiddenReferences,
  inspectForbiddenReferences,
} from "../forbidden-references";

function mustRefuse(text: string, label: string) {
  const hit = inspectForbiddenReferences(text);
  assert.ok(hit, `doit refuser: ${label}`);
  assert.ok(hit.matchHash.length === 64);
  assert.ok(hit.matchLen > 0);
  assert.equal(hit.sourceType, "candidate_field");
  assert.ok(detectForbiddenReferences(text, "bigIdea").length > 0);
}

function mustAllow(text: string, label: string) {
  assert.equal(
    inspectForbiddenReferences(text),
    null,
    `ne doit pas refuser: ${label} — matched ${inspectForbiddenReferences(text)?.matchedRule}`,
  );
}

test("hostile — imitation artiste / style refusée", () => {
  mustRefuse("dans le style de Picasso", "style FR");
  mustRefuse("dans le style exact de Picasso", "style exact FR");
  mustRefuse("in the style of Nolan", "style EN");
  mustRefuse("in the exact style of Nolan", "style exact EN");
  mustRefuse("à la manière de Wes Anderson", "manière");
  mustRefuse("à la façon de Kubrick", "façon");
  mustRefuse("in the manner of Spielberg", "manner EN");
  mustRefuse("inspiré par Nolan pour le rythme", "inspiré nommé");
  mustRefuse("inspired by Nolan for pacing", "inspired named");
  mustRefuse("comme Tom Cruise dans l'ouverture", "comme First Last + contexte");
});

test("hostile — franchise / studio / personnage / evasion refusés", () => {
  mustRefuse("comme un film Marvel", "franchise marvel");
  mustRefuse("esthétique Pixar", "pixar");
  mustRefuse("disney vibes", "disney");
  mustRefuse("star wars aesthetic", "star wars");
  mustRefuse("harry potter universe", "harry potter");
  mustRefuse("look Dreamworks", "studio");
  mustRefuse("ambiance studio ghibli", "ghibli");
  mustRefuse("référence Mickey Mouse", "personnage");
  mustRefuse("look p1xar", "evasion typo pixar");
  mustRefuse("d1sney vibes", "evasion typo disney");
  mustRefuse("m@rvel tone", "evasion typo marvel");
});

test("hostile — ne pas refuser plateformes, produit, générique, factuel", () => {
  mustAllow("Publier sur LinkedIn pour les professionnels", "plateforme Brief");
  mustAllow("Comme Objectif Education accélère la validation", "nom produit user");
  mustAllow("comme Confirmer la compréhension en fin de vidéo", "CTA factuel");
  mustAllow("comme indicateur de réussite pédagogique", "vocabulaire plan");
  mustAllow("comme un film documentaire intimiste", "cinéma générique");
  mustAllow("palette chaude, rythme dynamique, texture grain", "descripteurs");
  mustAllow("cadrage serré, lumière latérale, composition asymétrique", "visuel générique");
  mustAllow("mouvement lent puis accélération sur le CTA", "mouvement");
  mustAllow("authentic cinematic documentary feel", "keywords allowlist-like");
  mustAllow("inspiré par la lumière du matin", "inspiration non nominative");
  mustAllow("inspired by soft morning light", "inspired generic EN");
  mustAllow("opening like a question then proof", "comparaison sans IP");
});

test("diagnostics redacted — pas de texte candidat dans l'issue", () => {
  const issues = detectForbiddenReferences(
    "dans le style de Picasso avec secret-candidate-xyz",
    "logline",
  );
  assert.equal(issues.length, 1);
  const issue = issues[0]!;
  assert.equal(issue.code, "forbidden_reference");
  assert.equal(issue.field, "logline");
  assert.ok(issue.diagnostics?.matchedRule);
  assert.ok(issue.diagnostics?.category);
  assert.ok(issue.diagnostics?.matchHash);
  const blob = JSON.stringify(issue);
  assert.equal(blob.includes("Picasso"), false);
  assert.equal(blob.includes("secret-candidate-xyz"), false);
});
