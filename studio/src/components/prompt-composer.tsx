"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import type { CharacterResponse, Lang, TemplateResponse } from "@/lib/types";

interface Props {
  categories: string[];
  characterName?: string;
  value: string;
  onChange: (prompt: string) => void;
}

function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) =>
    values[k]?.trim() ? values[k] : `{{${k}}}`,
  );
}

const IDENTITY = (name: string, lang: Lang) =>
  lang === "fr"
    ? `Préserver l'identité exacte de ${name} : visage, coiffure, proportions, teint, tenue et accessoires. Mouvement humain naturel, aucune déformation.`
    : `Preserve ${name}'s exact identity: face, hairstyle, proportions, skin tone, outfit and accessories. Natural human motion, no distortion.`;

const NO_TEXT = (lang: Lang) =>
  lang === "fr"
    ? `Aucun texte, aucune lettre, aucun sous-titre ni logo incrusté dans l'image.`
    : `No text, letters, captions or logos rendered in the image.`;

export function PromptComposer({ categories, characterName, value, onChange }: Props) {
  const { characterId, characterName: ctxName } = useCharacter();
  const name = ctxName || characterName || "";
  const [char, setChar] = useState<CharacterResponse | null>(null);
  const [category, setCategory] = useState(categories[0]);
  const [templateName, setTemplateName] = useState<string>("");
  const [lang, setLang] = useState<Lang>("fr");
  const [tpl, setTpl] = useState<TemplateResponse | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [injectIdentity, setInjectIdentity] = useState(true);
  const [noText, setNoText] = useState(true);

  useEffect(() => {
    apiGet<CharacterResponse>(withCharacter("/api/character", characterId))
      .then(setChar)
      .catch(() => {});
    // Templates may differ per character: reset the current selection.
    setTemplateName("");
    setTpl(null);
  }, [characterId]);

  const templates = char?.templates[category] ?? [];

  useEffect(() => {
    if (!templateName) {
      setTpl(null);
      return;
    }
    apiGet<TemplateResponse>(
      withCharacter(`/api/template?category=${category}&name=${templateName}`, characterId),
    )
      .then((t) => {
        setTpl(t);
        // Pre-fill the character variable with the active character name.
        setVars({ character: name });
      })
      .catch(() => setTpl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, templateName, characterId]);

  const block = tpl?.blocks[lang];
  const composed = useMemo(() => {
    if (!block?.prompt) return "";
    let out = fill(block.prompt, vars);
    if (noText) out += `\n\n${NO_TEXT(lang)}`;
    if (injectIdentity) out += `\n\n${IDENTITY(name, lang)}`;
    return out;
  }, [block, vars, injectIdentity, noText, name, lang]);

  // Push composed prompt up whenever it changes.
  useEffect(() => {
    if (composed) onChange(composed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composed]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Catégorie</label>
          <select
            className="select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setTemplateName("");
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Template</label>
          <select className="select" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
            <option value="">— choisir —</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] p-1 border border-[var(--border)]">
          {(["fr", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-md text-xs font-semibold uppercase ${
                lang === l ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={injectIdentity}
            onChange={(e) => setInjectIdentity(e.target.checked)}
          />
          Clause d&apos;identité
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
          <input type="checkbox" checked={noText} onChange={(e) => setNoText(e.target.checked)} />
          Éviter le texte à l&apos;écran
        </label>
      </div>

      {block && !block.prompt && (
        <p className="text-sm text-[var(--muted)]">
          Ce template n&apos;a pas de bloc de prompt exploitable dans cette langue.
        </p>
      )}

      {block?.variables && block.variables.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {block.variables.map((v) => (
            <div key={v}>
              <label className="label">{v}</label>
              <input
                className="input"
                placeholder={`{{${v}}}`}
                value={vars[v] ?? ""}
                onChange={(e) => setVars((s) => ({ ...s, [v]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="label">Prompt final (modifiable)</label>
        <textarea
          className="textarea"
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sélectionne un template ou écris directement ton prompt…"
        />
      </div>
    </div>
  );
}
