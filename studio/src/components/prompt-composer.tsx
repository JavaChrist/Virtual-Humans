"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { usePersistentState } from "@/lib/use-persistent-state";
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

/** Libellés FR des variables de templates (Hook, Duration, CTA…). */
const VAR_LABELS_FR: Record<string, string> = {
  character: "Personnage",
  hook: "Accroche",
  duration: "Durée",
  cta: "Appel à l'action",
  topic: "Sujet",
  mood: "Ambiance",
  message: "Message",
  location: "Lieu",
  question: "Question",
  outfit: "Tenue",
  tone: "Ton",
  expression: "Expression",
  background: "Arrière-plan",
  product: "Produit",
  brand: "Marque",
  audience: "Audience",
  offer: "Offre",
  objective: "Objectif",
  channels: "Canaux",
  benefits: "Bénéfices",
  value: "Valeur",
  title: "Titre",
  title_text: "Texte du titre",
  outline: "Plan",
  setting: "Cadre",
  questions: "Questions",
  environment: "Environnement",
  theme: "Thème",
  items: "Éléments",
  insight: "Insight",
  angle: "Angle",
  points: "Points",
  headline: "Titre d'accroche",
  event: "Événement",
  context: "Contexte",
  availability: "Disponibilité",
  client: "Client",
  previous: "Échange précédent",
  objection: "Objection",
  need: "Besoin",
  solution: "Solution",
  terms: "Conditions",
  pricing: "Tarifs",
  validity: "Validité",
  system: "Système",
  components: "Composants",
  decisions: "Décisions",
  project: "Projet",
  purpose: "Objectif",
  usage: "Utilisation",
  subject: "Sujet",
  requirements: "Exigences",
  constraints: "Contraintes",
  goal: "But",
  prerequisites: "Prérequis",
  steps: "Étapes",
};

const CATEGORY_LABELS_FR: Record<string, string> = {
  video: "Vidéo",
  image: "Image",
  social: "Réseaux sociaux",
  marketing: "Marketing",
  sales: "Ventes",
  documentation: "Documentation",
};

function varLabel(v: string): string {
  return VAR_LABELS_FR[v] ?? v.replace(/_/g, " ");
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
  // Brouillon auto (persistant par personnage) : template + variables survivent au changement de page.
  const dkey = (field: string) => (characterId ? `vh:draft:composer:${characterId}:${field}` : null);
  const [char, setChar] = useState<CharacterResponse | null>(null);
  const [category, setCategory] = usePersistentState(dkey("category"), categories[0]);
  const [templateName, setTemplateName] = usePersistentState<string>(dkey("template"), "");
  const [lang, setLang] = usePersistentState<Lang>(dkey("lang"), "fr");
  const [tpl, setTpl] = useState<TemplateResponse | null>(null);
  const [vars, setVars] = usePersistentState<Record<string, string>>(dkey("vars"), {});
  const [injectIdentity, setInjectIdentity] = usePersistentState(dkey("injectIdentity"), true);
  const [noText, setNoText] = usePersistentState(dkey("noText"), true);

  useEffect(() => {
    apiGet<CharacterResponse>(withCharacter("/api/character", characterId))
      .then(setChar)
      .catch(() => {});
    // Le template et les variables sont restaurés par personnage (brouillon) ;
    // on efface juste le bloc chargé, il sera re-fetché ci-dessous.
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
        // On garde les variables déjà saisies (brouillon) et on force juste le nom du personnage.
        setVars((prev) => ({ ...prev, character: name }));
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
                {CATEGORY_LABELS_FR[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Modèle de prompt</label>
          <select className="select" value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
            <option value="">— choisir —</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name.replace(/_/g, " ")}
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
              <label className="label">{varLabel(v)}</label>
              <input
                className="input"
                placeholder={varLabel(v)}
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
