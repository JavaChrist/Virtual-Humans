# 04_VOICE

> Virtual Humans SDK
> Character SDK: Tom
> Version: 1.0.0
> Status: PROVISOIRE / À VALIDER (voix finale non définie)

> ⚠️ Ce fichier a été réinitialisé pour Tom. La voix de Mei a été retirée.
> La **voix finale de Tom n'est pas choisie**. Ne réutilisez pas la voix de Mei.

---

# 1. Objectif

Ce document définira la voix officielle et stable de Tom (fournisseur, modèle,
identifiant de voix, réglages) une fois validée.

---

# 2. Base de travail (non verrouillée)

En cohérence avec le positionnement de Tom (chaleureux, fiable, posé, rassurant,
pédagogue) :

* voix masculine adulte ;
* timbre chaleureux et posé ;
* débit clair et naturel ;
* ton rassurant, non agressif, non « vendeur » ;
* langue de travail : français.

Ces éléments sont une **base à valider**, pas une voix définitive.

---

# 3. Configuration runtime

La configuration technique vit dans `voice/config.json` :

```json
{
  "provider": "elevenlabs",
  "model": "eleven_multilingual_v2",
  "voiceId": "",
  "voiceName": "Tom",
  "language": "fr"
}
```

> ⚠️ `voiceId` doit rester **vide** tant qu'une voix masculine n'a pas été
> sélectionnée et validée pour Tom.

---

# 4. Éléments À VALIDER (ne pas inventer)

```text
Fournisseur définitif: À VALIDER
Modèle définitif: À VALIDER
voiceId définitif: À VALIDER
Hauteur / registre exact: À VALIDER
Accent: À VALIDER
Réglages fins (stability, similarity, style, speed): base provisoire, À VALIDER
```
