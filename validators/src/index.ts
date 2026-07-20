import { validateCharacter } from "./validate-character";
import type { ValidationResult } from "./validate-schema";

export type { ValidationIssue, ValidationResult } from "./validate-schema";
export { validateSchema } from "./validate-schema";
export { validateCharacter } from "./validate-character";
export { validateManifest } from "./validate-manifest";
export { validatePrompt } from "./validate-prompt";
export { validateGeneration } from "./validate-generation";
export { validateQualityReport } from "./validate-quality-report";
export { validateCharacterLock } from "./validate-character-lock";

function main(): void {
  const result: ValidationResult = validateCharacter(undefined);
  console.log(JSON.stringify(result, null, 2));
}

main();
