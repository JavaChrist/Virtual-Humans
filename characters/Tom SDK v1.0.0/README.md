# Tom SDK v1.0.0

> Virtual Humans SDK — Character Package
> Status: **en cours de personnalisation** (décisions créatives À VALIDER)

Tom is a **male virtual commercial presenter**, complementary to Mei, used to
present, explain and promote Christian's applications, products and services.

## Identity

```yaml
characterId: tom
characterCode: TOM-001
displayName: Tom
version: 1.0.0
```

- `characterId` (`tom`): canonical technical identifier (API, URL, registry, persistence).
- `characterCode` (`TOM-001`): human-readable business code.

## Status of this package

This package was created from Mei's structure and is being personalized file by
file. It is a **fully independent character**: no data is merged with Mei, and no
Tom document declares Mei as its primary identity. The only legitimate reference to
Mei lives in `13_RELATIONSHIPS.md` (Tom ↔ Mei, professional collaboration).

### À VALIDER (creative decisions not invented)

The following are **not defined** and must be validated by Christian:

- precise physical appearance (eye color, exact measurements/height, face dimensions);
- perceived origin;
- the 10 definitive outfits;
- the final voice (`voiceId` intentionally empty);
- official opening / closing phrases;
- official expressions and poses;
- definitive camera rules;
- fine personality traits (current personality is a provisional base).

### Assets

Tom's own images are in place under `assets/` (identity, expressions, poses,
outfits). The runtime exposes them normally. Some outfit **text descriptors**
(`look.json` / `look.md`) may still need alignment to Tom's real wardrobe and are
marked **À VALIDER**.

## Working base (provisional)

Man, ~30 years old, wavy brown hair, short neat brown beard, warm face, natural and
reassuring attitude; credible, modern and accessible; may hold a smartphone in his
right hand during presentations. Slightly more composed and pragmatic than Mei;
never cold, rigid or overly salesy.

## Layout

```text
00_IDENTITY.md … 26_VIDEO_MEMORY.md   Character specification documents
99_CHARACTER_LOCK.md                  Lock (Tom not yet locked)
memory/                               Persistent memories (00_IDENTITY = runtime identity)
prompts/                              System / behavior / templates prompts
videos/                               Video model notes
voice/config.json                     Voice configuration (voiceId empty — À VALIDER)
assets/                               Tom's images (identity, expressions, poses, outfits)
documents/                            Reports (asset replacement report)
```
