/**
 * validate-repository.ts
 *
 * Contract (not implemented yet):
 * - Check the presence of the main directories (core, schema, templates,
 *   characters, providers, workflows, validators, datasets, docs, examples,
 *   scripts, generated).
 * - Check the presence of the core standards in `core/`.
 * - Check the syntactic validity of every JSON file.
 * - Check that every Character SDK has a manifest (once manifests are added).
 * - Check the absence of forbidden file names (final, final2, new, copy, backup).
 *
 * This script must never modify or delete files.
 */

export interface RepositoryCheck {
  id: string;
  ok: boolean;
  details: string;
}

export function validateRepository(): RepositoryCheck[] {
  // TODO: implement repository validation.
  return [
    {
      id: "not_implemented",
      ok: false,
      details: "Repository validation is not implemented yet.",
    },
  ];
}
