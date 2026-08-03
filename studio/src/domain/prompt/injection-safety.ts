/**
 * Prompt-injection safety (VHS-106).
 * Untrusted business data is never treated as system instructions.
 * Hostile samples are NOT echoed in public error messages.
 */

import type { PromptValidationIssue, PromptWarning } from "./errors";

export type InjectionFinding = {
  code: string;
  severity: "blocking" | "warning";
  /** Opaque field path only — never the hostile payload. */
  field: string;
  publicMessage: string;
};

const PATTERNS: Array<{
  code: string;
  severity: "blocking" | "warning";
  re: RegExp;
}> = [
  {
    code: "role_override",
    severity: "blocking",
    re: /\b(you are now|tu es maintenant|act as system|agis comme (le )?système|ignore (all |previous |tes )?instructions?|ignore les (instructions|règles|regles)|disregard (previous|prior)|oublie (les|tes) instructions)\b/i,
  },
  {
    code: "system_delimiter",
    severity: "blocking",
    re: /(<\|?(system|developer|assistant)\|?>|```\s*system\b|\[SYSTEM\]|<<\s*SYS\s*>>)/i,
  },
  {
    code: "secret_exfil",
    severity: "blocking",
    re: /\b(reveal|révèle|revele|montre|affiche|exfiltrat|dump)\b.{0,40}\b(secret|api[_ ]?key|password|mot de passe|token|clé api|cle api)\b/i,
  },
  {
    code: "signed_url",
    severity: "blocking",
    re: /https?:\/\/\S*(X-Amz-Signature|Signature=|token=|access_key)/i,
  },
  {
    code: "api_key_shape",
    severity: "blocking",
    re: /\b(sk-[a-zA-Z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|ghp_[a-zA-Z0-9]{20,})\b/,
  },
  {
    code: "provider_selection",
    severity: "blocking",
    re: /\b(use|utilise|choisis|select)\b.{0,30}\b(openai|gpt-4|kling|veo|fal\.ai|elevenlabs|runway|midjourney)\b/i,
  },
  {
    code: "delimiter_escape",
    severity: "warning",
    re: /("""\s*END|###\s*END\s*PROMPT|<\/?(prompt|data)>)/i,
  },
];

/**
 * Scan a string field for injection. Returns findings without including matched text.
 */
export function scanUntrustedText(
  text: string | undefined,
  field: string,
): InjectionFinding[] {
  if (!text?.trim()) return [];
  const findings: InjectionFinding[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      findings.push({
        code: p.code,
        severity: p.severity,
        field,
        publicMessage:
          p.severity === "blocking"
            ? `Contenu non fiable bloquant détecté (${p.code}).`
            : `Contenu non fiable suspect (${p.code}).`,
      });
    }
  }
  return findings;
}

/** Wrap untrusted data for safe inclusion in rendered prompts. */
export function delimitUntrustedData(label: string, value: string): string {
  const safe = value
    .replace(/<\/?data>/gi, "")
    .replace(/```/g, "'''")
    .slice(0, 2000);
  return `[DATA:${label}]\n${safe}\n[/DATA:${label}]`;
}

export function findingsToIssues(
  findings: InjectionFinding[],
): { issues: PromptValidationIssue[]; warnings: PromptWarning[] } {
  const issues: PromptValidationIssue[] = [];
  const warnings: PromptWarning[] = [];
  for (const f of findings) {
    if (f.severity === "blocking") {
      issues.push({
        code: "injection_blocked",
        field: f.field,
        message: f.publicMessage,
      });
    } else {
      warnings.push({
        code: f.code,
        field: f.field,
        message: f.publicMessage,
      });
    }
  }
  return { issues, warnings };
}
