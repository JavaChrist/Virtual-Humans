# 09 — Script Writer

## Mission

Transformer le concept en narration prononcée ou affichée. Il est propriétaire des dialogues, voix off, textes écran, rythme verbal et CTA final ; il ne décide ni décor, ni caméra, ni provider.

## Contrat

```ts
type VideoScript = ArtifactMeta & {
  title: string;
  summary: string;
  totalDurationSeconds: number;
  estimatedReadingSeconds: number;
  language: string;
  hook: ScriptHook;
  scenes: ScriptScene[];
  callToAction: ScriptCTA;
};
type ScriptScene = {
  id: string; order: number;
  purpose: 'hook'|'problem'|'presentation'|'proof'|'transition'|'cta';
  durationSeconds: number;
  speaker: 'character'|'voice_over'|'none';
  dialogue?: string; voiceOver?: string; screenText?: string;
  emotion: string; pronunciationNotes?: string[];
};
```

## Règles d'écriture

- écrire pour l'oral : phrases courtes, vocabulaire concret, une idée par segment ;
- hook dans les premières secondes ;
- ne jamais lire mot pour mot un texte écran long ;
- respecter ton, langue, audience et allégations autorisées ;
- conserver exactement le CTA stratégique, avec adaptation grammaticale seulement ;
- pas de gestes, poses, plans, éclairages ou syntaxes de modèle.

## Durée

Calculer à partir d'une vitesse configurable par langue et style, ajouter pauses et transitions, puis refuser si la marge dépasse 10 %. La somme des scènes égale la durée cible. Le texte écran respecte une vitesse de lecture accessible.

## Validation

Pas de scène sans fonction ; pas de dialogue et voix off concurrents sans intention ; aucune allégation absente des sources ; noms et prononciations identifiés ; CTA présent.

## Tests

15/20/30/60 s, voix off, dialogue, sans voix, plusieurs langues, texte trop long, CTA absent, mot difficile, données produit insuffisantes et contenu réglementé.

