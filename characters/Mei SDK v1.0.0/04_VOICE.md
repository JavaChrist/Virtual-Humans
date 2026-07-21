# 04_VOICE

> Virtual Humans SDK
> Character SDK: Mei
> SDK version: 1.0.0
> Voice version: 1.0.0
> Status: approved voice specification
> Classification: official vocal identity contract

---

# 1. Purpose

This document defines Mei’s official vocal identity.

It governs:

* voice selection;
* vocal personality;
* delivery style;
* speech rhythm;
* pronunciation;
* emotional delivery;
* multilingual consistency;
* text-to-speech generation;
* provider adaptation;
* audio quality;
* lip-sync compatibility;
* voice validation;
* AI Command Center OS integration.

This document defines **how Mei must sound**.

It does not define:

* Mei’s physical appearance;
* her personality in full;
* her visual expressions;
* her body behavior;
* her scripts;
* her legal permissions;
* campaign-specific claims.

Those elements are defined in their respective SDK files.

---

# 2. Voice source of truth

The official hierarchy is:

```text
1. Approved master voice reference
2. Approved voice model and configuration
3. Approved pronunciation references
4. 04_VOICE.md
5. 02_PERSONALITY.md
6. Campaign voice direction
7. Provider-specific configuration
8. Provider interpretation
```

When a generated voice conflicts with the approved master voice, the master voice has priority.

A technically clean voice that does not sound like Mei must be rejected.

---

# 3. Voice identity principle

Mei must have one stable vocal identity across:

* product presentations;
* tutorials;
* commercial videos;
* social media;
* customer-support content;
* application onboarding;
* brand campaigns;
* multilingual productions;
* different text-to-speech providers.

The provider may change.

The voice model may be migrated.

Mei’s perceived vocal identity must remain stable.

---

# 4. Voice classification system

Every vocal characteristic belongs to one of three classes.

## 4.1 LOCKED

A locked characteristic is part of Mei’s permanent vocal identity.

It cannot change without:

* explicit human approval;
* comparison with the master reference;
* a voice impact assessment;
* regression testing;
* updated metadata;
* a new voice version when required.

## 4.2 CONTROLLED

A controlled characteristic may vary according to:

* context;
* audience;
* language;
* campaign;
* emotional state;
* platform;
* video duration.

The variation must remain recognizably Mei.

## 4.3 CONTEXTUAL

A contextual characteristic is temporary.

Examples:

* speaking more slowly for a tutorial;
* using more energy for a social video;
* reducing warmth for legal information;
* whispering briefly in a scripted scene.

Contextual delivery does not redefine Mei’s voice.

---

# 5. Core voice summary

```yaml
character_id: mei
voice_version: 1.0.0
voice_gender_presentation: female
apparent_voice_age: early thirties
voice_style:
  - warm
  - clear
  - modern
  - professional
  - reassuring
  - natural
  - confident
default_energy: medium
default_pace: moderate
default_formality: medium
default_emotional_intensity: low-to-medium
```

---

# 6. Vocal archetype

Mei’s vocal archetype is:

```text
The Warm Professional Guide
```

Her voice should sound:

* competent;
* accessible;
* natural;
* calm;
* pleasant;
* attentive;
* credible.

It must not sound like:

* a radio announcer;
* a voice-over trailer;
* a call-center robot;
* a seductive commercial voice;
* a childish influencer;
* an authoritarian instructor;
* a synthetic assistant without personality.

---

# 7. Apparent vocal age

Classification:

```text
LOCKED
```

Official apparent vocal age:

```text
Approximately 28 to 35 years old
```

Target perception:

```text
Early thirties
```

The voice must not sound:

* adolescent;
* elderly;
* significantly younger than Mei’s appearance;
* significantly older than Mei’s appearance.

Visual and vocal age must remain coherent.

---

# 8. Vocal gender presentation

Classification:

```text
LOCKED
```

Mei uses an adult feminine voice.

The voice should remain:

* natural;
* balanced;
* non-caricatural;
* free from exaggerated gender performance.

A voice-model migration must preserve this presentation.

---

# 9. Vocal warmth

Classification:

```text
CRITICAL LOCKED
```

Warmth is one of Mei’s primary vocal signatures.

It should be expressed through:

* soft but clear articulation;
* controlled smiling tone;
* natural melodic movement;
* calm breathing;
* welcoming sentence openings;
* non-aggressive emphasis.

Warmth must not become:

* artificial sweetness;
* excessive intimacy;
* flirtation;
* exaggerated emotionality;
* childlike softness.

---

# 10. Vocal clarity

Classification:

```text
CRITICAL LOCKED
```

Every word must remain understandable.

Required:

* precise articulation;
* clean consonants;
* audible word endings;
* controlled pace;
* correct pauses;
* stable volume;
* limited mumbling;
* limited swallowing of syllables.

Clarity is more important than speed or dramatic delivery.

---

# 11. Vocal professionalism

Classification:

```text
LOCKED
```

Mei’s delivery should feel prepared without sounding over-rehearsed.

Professionalism includes:

* stable speech rhythm;
* accurate pronunciation;
* correct emphasis;
* controlled emotion;
* confident phrasing;
* absence of vocal tics;
* appropriate formality.

It must not become:

* coldness;
* rigidity;
* institutional monotony;
* theatrical authority.

---

# 12. Vocal confidence

Classification:

```text
LOCKED
```

Confidence should be calm and credible.

Mei should:

* finish sentences clearly;
* avoid unnecessary upward inflection;
* avoid repeated hesitation;
* maintain stable vocal support;
* emphasize key information;
* sound comfortable with the content.

Confidence must not become:

* arrogance;
* false certainty;
* aggressive volume;
* excessive command tone.

---

# 13. Vocal reassurance

Classification:

```text
LOCKED
```

Mei should sound reassuring during:

* onboarding;
* tutorials;
* support explanations;
* process guidance;
* error resolution;
* transition messages.

Reassurance may be expressed through:

* slightly slower pace;
* warmer tone;
* softer emphasis;
* clear sequencing;
* stable pitch.

False reassurance is prohibited.

---

# 14. Naturalness

Classification:

```text
CRITICAL LOCKED
```

Mei must sound like a natural contemporary speaker.

Avoid:

* robotic timing;
* identical sentence melody;
* mechanical pauses;
* synthetic breath placement;
* exaggerated pronunciation;
* unnatural syllable stretching;
* monotone delivery;
* repeated artificial enthusiasm.

Naturalness does not require imperfect audio.

It requires believable human-style speech.

---

# 15. Pitch range

Classification:

```text
LOCKED RANGE / CONTROLLED MOVEMENT
```

Mei’s default pitch should be:

```text
Medium feminine register
```

The voice must not be:

* unusually high;
* unusually low;
* childlike;
* breathy to the point of weakness;
* heavy or overly dramatic.

Pitch movement should remain natural and moderate.

---

# 16. Pitch variation

Classification:

```text
CONTROLLED
```

Pitch may vary to express:

* greeting;
* emphasis;
* curiosity;
* reassurance;
* enthusiasm;
* conclusion;
* warning.

Pitch variation must not become:

* sing-song delivery;
* exaggerated question melody;
* constant upward inflection;
* unstable identity;
* emotional overacting.

---

# 17. Timbre

Classification:

```text
CRITICAL LOCKED
```

Official timbre characteristics:

* warm;
* clear;
* smooth;
* slightly bright;
* natural;
* adult;
* pleasant;
* non-nasal;
* non-metallic.

The timbre must remain stable across:

* languages;
* emotional states;
* providers;
* recording sessions;
* short and long-form content.

---

# 18. Breathiness

Classification:

```text
CONTROLLED
```

Default breathiness:

```text
Low
```

A small amount of natural breath may support warmth.

Prohibited:

* whispery delivery by default;
* excessive air loss;
* seductive breathiness;
* weak sentence endings;
* noisy synthetic breathing.

---

# 19. Resonance

Mei’s voice should have:

* balanced facial resonance;
* sufficient body to sound credible;
* clear midrange presence;
* no excessive chest heaviness;
* no sharp nasal dominance.

The voice must remain intelligible on:

* smartphones;
* laptop speakers;
* social-media playback;
* embedded application audio;
* compressed video.

---

# 20. Speech pace

Classification:

```text
CONTROLLED
```

Default pace:

```text
Approximately 145 to 165 words per minute in French
```

Pace may vary according to content:

| Content type                | Recommended pace |
| --------------------------- | ---------------: |
| Legal or safety information |      120–145 wpm |
| Tutorial                    |      130–155 wpm |
| Product presentation        |      145–165 wpm |
| Commercial video            |      155–180 wpm |
| Social short video          |      165–190 wpm |
| Customer support            |      125–150 wpm |

Speed must never reduce comprehension.

---

# 21. Rhythm

Classification:

```text
LOCKED STYLE
```

Official rhythm:

* fluid;
* structured;
* calm;
* moderately dynamic;
* easy to follow.

Mei should use:

* clear phrase groups;
* logical stress;
* natural variation;
* short pauses between ideas;
* slightly longer pauses between sections.

Avoid:

* flat rhythm;
* constant speed;
* machine-gun delivery;
* excessive dramatic pauses;
* identical timing for every sentence.

---

# 22. Pauses

Classification:

```text
CONTROLLED
```

Pauses should support meaning.

Recommended:

```text
Short pause: 150–300 ms
Standard pause: 300–600 ms
Section pause: 600–1000 ms
```

Exact values may vary by provider and language.

Pauses should occur:

* after an important statement;
* before a new step;
* after a question;
* before a CTA;
* between title and explanation.

Avoid:

* pauses inside a grammatical unit;
* long unexplained silence;
* breathless text;
* identical pause duration everywhere.

---

# 23. Sentence endings

Mei should finish statements with:

* stable tone;
* clear articulation;
* controlled downward or neutral inflection;
* no disappearing final syllable.

Questions may rise naturally, but not excessively.

Calls to action should sound:

* clear;
* encouraging;
* non-aggressive.

---

# 24. Articulation

Classification:

```text
CRITICAL LOCKED
```

Articulation must remain:

* precise;
* natural;
* non-theatrical;
* consistent.

Particular attention is required for:

* product names;
* application names;
* technical terms;
* URLs;
* numbers;
* abbreviations;
* foreign words;
* brand names.

Over-articulation is also a defect when it sounds unnatural.

---

# 25. French pronunciation

French is Mei’s primary production language unless otherwise specified.

Default French pronunciation should be:

```text
Standard contemporary French
```

It should avoid a strong regional accent by default.

Required:

* clear liaison when natural;
* no forced liaison;
* correct silent letters;
* natural schwa handling;
* correct nasal vowels;
* stable `r`;
* natural sentence melody.

---

# 26. French accent

Classification:

```text
LOCKED DEFAULT / CONTROLLED LOCALIZATION
```

Official default:

```text
Neutral metropolitan French accent
```

This does not imply a fictional nationality or biography.

A regional accent variation requires:

* explicit production intent;
* validated voice reference;
* consistency across the full production;
* approval as a controlled variant.

---

# 27. English pronunciation

When speaking English, Mei should use:

```text
Clear international English
```

Default direction:

* natural;
* accessible;
* neutral;
* non-caricatural;
* easy for international audiences to understand.

The production may specify:

* British English;
* American English;
* international English.

The selected variety must remain consistent.

---

# 28. Multilingual identity

Classification:

```text
CRITICAL CONTROLLED
```

Mei must remain recognizably the same character across languages.

The following should remain stable:

* vocal age;
* timbre;
* warmth;
* pitch range;
* speech confidence;
* energy profile;
* emotional restraint;
* overall vocal identity.

Localization may modify:

* rhythm;
* pronunciation;
* sentence melody;
* pace;
* pause placement.

A new language must not create a new character voice.

---

# 29. Foreign words in French

Foreign brand names or technical terms should be pronounced according to:

1. official brand pronunciation;
2. accepted usage in French;
3. campaign pronunciation guide;
4. provider phonetic configuration.

The same word must not be pronounced differently within one production.

---

# 30. Brand-name pronunciation

Every recurring brand or product name should have a pronunciation entry.

Example metadata:

```yaml
term: RideCloud
language: fr
preferred_pronunciation: "Ride Cloud"
phonetic_hint: ""
approved_audio_reference: ""
status: approved
```

Pronunciation must be validated before high-volume production.

---

# 31. Acronyms

Acronyms must be defined as either:

* letter-by-letter;
* word pronunciation;
* localized pronunciation;
* expanded form.

Examples:

```yaml
term: PWA
fr_pronunciation: "pé double vé a"
mode: letters
```

```yaml
term: SDK
fr_pronunciation: "esse dé ka"
mode: letters
```

The script or pronunciation dictionary must control the result.

---

# 32. Numbers

Numbers must be spoken according to context.

Examples:

```text
3,99 € → trois euros quatre-vingt-dix-neuf
2026 → deux mille vingt-six
v1.0.0 → version un point zéro point zéro
15 km → quinze kilomètres
10 % → dix pour cent
```

Ambiguous numerical notation should be rewritten in speech-ready form.

---

# 33. Dates

Dates must be converted into natural spoken language.

Example:

```text
20/07/2026
```

becomes:

```text
le vingt juillet deux mille vingt-six
```

The exact spoken form may vary according to language.

Numeric date strings should not be sent directly to text-to-speech without normalization.

---

# 34. Currency

Currency values must be explicit.

Examples:

```text
3,99 € → trois euros quatre-vingt-dix-neuf
12,99 € par mois → douze euros quatre-vingt-dix-neuf par mois
1 500 € → mille cinq cents euros
```

Currency pronunciation must match the target market.

---

# 35. Units

Units should be expanded when needed for clarity.

Examples:

```text
km → kilomètres
km/h → kilomètres par heure
cm → centimètres
kg → kilogrammes
Go → gigaoctets
Mo → mégaoctets
```

Technical units may remain abbreviated only when natural in the target language.

---

# 36. URLs and email addresses

Long URLs should not normally be spoken.

Preferred:

* use a short domain;
* simplify the call to action;
* display the URL visually;
* say “rendez-vous sur…”;
* avoid spelling complex parameters.

Email addresses should be normalized for speech.

Example:

```text
contact@ridecloud.fr
```

becomes:

```text
contact, arobase, ridecloud, point fr
```

---

# 37. Punctuation handling

Punctuation must guide delivery, not be read literally.

Scripts should use:

* commas for brief separation;
* periods for complete stops;
* colons before explanations;
* dashes sparingly;
* ellipses only when a deliberate hesitation is required;
* exclamation marks in moderation.

Multiple exclamation marks are prohibited.

---

# 38. Text preparation

Before voice generation, every script should be converted into a speech-ready version.

The process should include:

1. removing markdown syntax;
2. expanding abbreviations;
3. normalizing dates;
4. normalizing numbers;
5. validating brand names;
6. inserting pronunciation hints;
7. splitting long sentences;
8. inserting intended pauses;
9. removing visual-only instructions;
10. checking legal wording.

---

# 39. Filler words

Mei should not use filler words by default.

Avoid repeated:

* euh;
* alors;
* donc;
* voilà;
* en fait;
* du coup;
* vous savez.

A very limited conversational filler may be used for realism in a specifically scripted scene.

It must never reduce professionalism.

---

# 40. Hesitation

Classification:

```text
RESTRICTED
```

Mei may hesitate briefly when:

* acting in a fictional scene;
* expressing reflection;
* simulating a natural conversation;
* searching for a careful formulation.

Hesitation must not appear during:

* core product claims;
* legal information;
* essential instructions;
* safety guidance;
* pricing information.

---

# 41. Emotional voice model

Approved emotional families:

```text
neutral
welcoming
warm
happy
enthusiastic
reassuring
focused
serious
curious
surprised
concerned
satisfied
```

Every emotion must remain within Mei’s vocal identity.

---

# 42. Emotional intensity scale

```text
0 — neutral
1 — subtle
2 — visible
3 — expressive
4 — strong
5 — extreme
```

Default intensity:

```text
1 to 2
```

Promotional content may use:

```text
2 to 3
```

Level 4 requires explicit approval.

Level 5 is prohibited for standard Mei content.

---

# 43. Neutral delivery

Neutral delivery should remain:

* alive;
* attentive;
* clear;
* natural;
* non-monotone.

Neutral does not mean emotionally empty.

It means that no strong emotion dominates the message.

---

# 44. Welcoming delivery

Used for:

* greetings;
* onboarding;
* introductions;
* opening a tutorial;
* welcoming users.

Characteristics:

* slightly warmer timbre;
* gentle smile in the voice;
* moderate upward energy;
* clear opening phrase;
* relaxed pace.

---

# 45. Happy delivery

Used for:

* positive results;
* completed actions;
* successful onboarding;
* user achievements;
* positive product outcomes.

Characteristics:

* brighter tone;
* slightly faster rhythm;
* moderate pitch lift;
* natural smile.

Avoid childish excitement.

---

# 46. Enthusiastic delivery

Used for:

* product launches;
* social-media content;
* campaign highlights;
* feature announcements.

Characteristics:

* increased energy;
* stronger emphasis;
* slightly faster pace;
* more melodic variation.

The voice must remain controlled and credible.

---

# 47. Reassuring delivery

Used for:

* support;
* complex instructions;
* error recovery;
* privacy explanations;
* user concerns.

Characteristics:

* slower pace;
* stable pitch;
* softer emphasis;
* clear pauses;
* reduced excitement.

Reassurance must not become whispering.

---

# 48. Focused delivery

Used for:

* technical explanations;
* detailed demonstrations;
* procedural steps;
* comparisons.

Characteristics:

* precise articulation;
* moderate pace;
* reduced melodic variation;
* strong information structure;
* clear emphasis.

Focused delivery must not become cold.

---

# 49. Serious delivery

Used for:

* legal information;
* warnings;
* limitations;
* important conditions;
* safety messages.

Characteristics:

* reduced smile;
* lower energy;
* controlled downward inflection;
* slower pace;
* direct articulation.

It must not sound threatening.

---

# 50. Curious delivery

Used for:

* discovery;
* product exploration;
* questions;
* comparison;
* feature introduction.

Characteristics:

* slightly rising melody;
* moderate warmth;
* visible interest;
* natural question phrasing.

Avoid childish wonder.

---

# 51. Surprised delivery

Classification:

```text
CONTROLLED
```

Surprise must be:

* brief;
* proportionate;
* credible;
* linked to a real event in the script.

Avoid:

* exaggerated gasps;
* shouted reactions;
* influencer-style shock;
* cartoon vocalizations.

---

# 52. Concerned delivery

Used for:

* acknowledging a user problem;
* explaining a risk;
* highlighting an issue;
* discussing a delay.

Characteristics:

* warmer lower energy;
* precise wording;
* no panic;
* no dramatic sadness.

---

# 53. Laughing

Classification:

```text
RESTRICTED
```

A light laugh may be used in:

* lifestyle content;
* social content;
* scripted friendly dialogue.

The laugh must be:

* brief;
* natural;
* non-repetitive;
* contextually justified.

Prohibited:

* laughter during serious information;
* exaggerated scripted laughter;
* mocking laughter;
* long uncontrolled laughter.

---

# 54. Whispering

Classification:

```text
RESTRICTED
```

Whispering may be used only for:

* a short creative effect;
* a fictional scene;
* a deliberate social-media hook.

Whispering must not be used for:

* standard presentation;
* instructions;
* legal information;
* accessibility-critical content;
* full videos.

---

# 55. Shouting

Classification:

```text
PROHIBITED BY DEFAULT
```

Mei must not shout in standard productions.

Raised energy is allowed.

Aggressive or excessive volume is not.

---

# 56. Seductive delivery

Classification:

```text
PROHIBITED BY DEFAULT
```

Mei’s standard voice must not be:

* seductive;
* intimate;
* breathy;
* flirtatious;
* suggestive.

This restriction applies to:

* commercial content;
* tutorials;
* social media;
* support;
* application onboarding.

---

# 57. Childlike delivery

Classification:

```text
PROHIBITED
```

Mei must not use:

* childish pitch;
* baby voice;
* exaggerated cuteness;
* juvenile phrasing;
* adolescent vocal mannerisms.

Her voice must remain clearly adult.

---

# 58. Robotic delivery

Classification:

```text
BLOCKING DEFECT
```

Robotic indicators include:

* flat melody;
* equal stress on all words;
* unnatural timing;
* repeated cadence;
* abrupt cuts;
* synthetic consonants;
* identical sentence endings;
* non-human breathing.

A technically intelligible but robotic result must be corrected.

---

# 59. Presenter delivery

For presenter content, Mei should:

* look and sound engaged;
* speak directly to the audience;
* emphasize benefits and actions;
* use stable rhythm;
* remain concise;
* finish statements confidently.

The delivery should not sound like an audiobook.

---

# 60. Tutorial delivery

Tutorial voice should be:

* patient;
* sequential;
* calm;
* clear;
* slightly slower than default.

Each step should sound distinct.

Recommended vocal structure:

```text
Instruction
Pause
Expected result
Transition
```

---

# 61. Commercial delivery

Commercial delivery may use:

* more energy;
* stronger emphasis;
* slightly faster pace;
* positive rhythm;
* concise CTA.

It must remain:

* truthful;
* professional;
* non-aggressive;
* natural;
* recognizably Mei.

---

# 62. Social-media delivery

Social delivery may be:

* faster;
* more dynamic;
* more conversational;
* more expressive;
* more concise.

It must not become:

* shrill;
* childish;
* chaotic;
* excessively trendy;
* exaggeratedly enthusiastic.

---

# 63. Customer-support delivery

Support delivery should prioritize:

* calmness;
* empathy;
* clarity;
* step-by-step structure;
* stable volume;
* reduced speed.

Mei must not sound defensive or impatient.

---

# 64. Legal delivery

Legal and contractual information requires:

* slower pace;
* neutral seriousness;
* precise articulation;
* no humor;
* no exaggerated warmth;
* no dramatic music interference;
* full wording without omission.

Legal delivery must remain understandable.

---

# 65. Safety delivery

Safety information requires:

* clear emphasis;
* controlled seriousness;
* slower pace;
* sufficient pause after warnings;
* no ambiguous wording;
* no cheerful contradiction.

Mei must not dramatize risk.

She must communicate it clearly.

---

# 66. Long-form delivery

For long-form content:

* vary sentence rhythm;
* use section pauses;
* avoid constant enthusiasm;
* reduce vocal fatigue;
* maintain stable identity;
* preserve consistent loudness;
* use logical chapter transitions.

Long content should be divided into manageable generation segments.

---

# 67. Short-form delivery

For short videos:

* begin clearly;
* avoid unnecessary greeting length;
* place the main idea early;
* keep high intelligibility;
* use controlled energy;
* finish with a concise CTA.

Fast delivery must not become rushed.

---

# 68. Dialogue delivery

In dialogue, Mei should:

* react after the other speaker;
* avoid overlap unless scripted;
* vary listening and speaking states;
* preserve natural response timing;
* adapt volume to distance;
* maintain her core voice identity.

The other character’s style must not cause Mei to imitate a different personality.

---

# 69. Voice and facial-expression alignment

The voice must match the visible expression.

Examples:

```text
Warm smile → warm or happy delivery
Serious face → serious or focused delivery
Curious expression → curious delivery
Concerned expression → reassuring or concerned delivery
```

Prohibited mismatches:

* smiling voice with a warning;
* enthusiastic voice with a serious face;
* sad voice with a promotional smile;
* laughter without visible facial support.

---

# 70. Voice and gesture alignment

Vocal emphasis should coordinate with:

* hand gestures;
* head movement;
* product pointing;
* CTA presentation;
* transitions.

A strong gesture without vocal emphasis may feel unnatural.

Constant gestural and vocal emphasis must also be avoided.

---

# 71. Voice and camera alignment

Delivery may adapt to framing.

## Close-up

* more subtle energy;
* smaller emotional variation;
* controlled intimacy;
* precise articulation.

## Medium shot

* standard presenter energy;
* moderate emphasis;
* clear projection.

## Full body

* slightly stronger projection;
* clearer rhythm;
* gesture-compatible phrasing.

---

# 72. Voice and background environment

The perceived voice must match the environment.

Examples:

* studio: clean and direct;
* street: realistic ambient integration;
* vehicle showroom: slight natural room presence;
* station: controlled ambient noise;
* office: restrained room tone.

The voice must not sound recorded in an incompatible acoustic space.

---

# 73. Studio recording target

Preferred master-audio characteristics:

```yaml
sample_rate: 48000 Hz
bit_depth: 24-bit preferred
channels: mono voice master
peak_level: below -1 dBFS
clipping: prohibited
background_noise: minimal
reverb: minimal
processing: transparent
```

Provider output may differ technically, but final production should meet professional standards.

---

# 74. Loudness

Target loudness depends on the distribution platform.

General spoken-video target:

```text
Approximately -16 LUFS integrated for stereo delivery
```

or:

```text
Approximately -19 LUFS integrated for mono delivery
```

Final loudness must be validated during mastering.

The voice must remain clearly audible over music and ambient sound.

---

# 75. Peak control

True peak should generally remain:

```text
At or below -1 dBTP
```

Clipping is prohibited.

Hard limiting that creates audible distortion must be avoided.

---

# 76. Noise control

Prohibited audio defects:

* hiss;
* hum;
* clicks;
* pops;
* digital crackle;
* background conversation;
* provider artifacts;
* unstable noise floor;
* excessive room tone;
* pumping noise reduction.

Noise removal must not damage the voice.

---

# 77. Sibilance

Classification:

```text
CONTROLLED QA
```

Sibilance must remain natural.

Avoid:

* harsh `s`;
* sharp `ch`;
* metallic high frequencies;
* over-de-essing that removes clarity.

Sibilance should be checked on headphones and smartphone speakers.

---

# 78. Plosives

Plosive consonants must not create:

* low-frequency bursts;
* clipping;
* distorted `p`;
* distorted `b`;
* unnatural provider pops.

Text-to-speech outputs must also be checked for artificial consonant transients.

---

# 79. Mouth noise

Unwanted mouth noises should be minimized:

* clicks;
* saliva noise;
* exaggerated lip sounds;
* unnatural breath noises.

Complete removal of all natural texture is not required if it creates a synthetic result.

---

# 80. Breathing

Breaths may be:

* natural;
* discreet;
* contextually placed;
* consistent with phrase length.

Prohibited:

* loud breaths;
* repeated identical synthetic breaths;
* breaths during impossible moments;
* breathing that conflicts with lip-sync;
* gasping without narrative reason.

---

# 81. Audio processing

Allowed processing:

* gentle equalization;
* light compression;
* subtle de-essing;
* transparent noise reduction;
* level normalization;
* controlled limiting.

Avoid:

* obvious autotune;
* heavy compression;
* artificial widening;
* strong reverb;
* pitch shifting that changes identity;
* aggressive denoising;
* telephone effect unless scripted.

---

# 82. Music relationship

Background music must not:

* mask speech;
* compete with articulation;
* contradict emotional tone;
* force excessive voice loudness;
* contain vocals that interfere with Mei.

Music level should adapt dynamically under speech.

---

# 83. Sound-effect relationship

Sound effects may support:

* transitions;
* interface actions;
* product reveals;
* CTA emphasis;
* scene changes.

They must not:

* cover key words;
* startle the audience;
* create misleading realism;
* interfere with legal information.

---

# 84. Lip-sync compatibility

The voice must support accurate lip synchronization.

Requirements:

* stable timing;
* correct phoneme duration;
* natural pauses;
* no abrupt word truncation;
* no post-generation speed change without revalidation;
* no heavy time-stretch artifacts.

The final voice file used for lip-sync must be versioned and immutable during rendering.

---

# 85. Lip-sync tolerances

Recommended synchronization tolerance:

```text
Excellent: within approximately 40 ms
Acceptable: within approximately 80 ms
Review required: above approximately 80 ms
```

Perceived tolerance may vary according to:

* framing;
* language;
* consonant visibility;
* speech speed;
* camera distance.

Close-ups require stricter validation.

---

# 86. Audio-video continuity

Across shots, preserve:

* voice model;
* voice configuration;
* pitch;
* timbre;
* pace range;
* loudness;
* emotional state;
* room tone;
* microphone character.

Typical rejection defects:

* a different voice in another shot;
* sudden pitch shift;
* changing accent;
* changing vocal age;
* different room acoustics;
* inconsistent volume;
* emotional discontinuity.

---

# 87. Voice-model configuration

Each approved provider configuration should record:

```yaml
provider: ""
model: ""
voice_id: ""
voice_name: ""
language: fr
stability: null
similarity: null
style: null
speaker_boost: null
speed: 1.0
pitch: 0
seed: null
status: approved
```

Only parameters supported by the provider should be stored.

---

# 88. Master voice reference

The master voice reference must contain enough material to evaluate:

* neutral delivery;
* warm delivery;
* enthusiastic delivery;
* serious delivery;
* numbers;
* dates;
* brand names;
* questions;
* long sentences;
* short sentences;
* natural pauses.

A single short greeting is not sufficient as a complete master reference.

---

# 89. Voice reference script

The master reference should include a controlled script covering:

```text
Greeting
Self-identification
Product introduction
Tutorial instruction
Question
Positive result
Serious limitation
Date
Price
Technical term
Brand name
Call to action
Conclusion
```

The script must not invent a human biography for Mei.

---

# 90. Voice cloning

Voice cloning may be used only when:

* the source voice is legally authorized;
* consent and usage rights are documented;
* the voice is not copied from an unconsenting person;
* the clone is approved for Mei;
* security and access controls are defined.

Mei must not imitate a celebrity, public figure or identifiable private person without explicit legal authorization.

---

# 91. Voice security

Voice assets should be protected against:

* unauthorized export;
* unauthorized cloning;
* unapproved provider upload;
* identity theft;
* fraudulent calls;
* deceptive impersonation;
* uncontrolled public distribution.

Sensitive voice-model identifiers should not be exposed unnecessarily.

---

# 92. Disclosure

When Mei’s synthetic nature is materially relevant, disclosure must follow:

* applicable law;
* platform rules;
* campaign requirements;
* `LEGAL_STANDARD.md`;
* `15_LEGAL.md`.

The voice must not be used to deceive users into believing Mei is a real human employee when disclosure is required.

---

# 93. Provider independence

The voice contract applies to all providers.

Provider-specific adapters may change:

* API syntax;
* model parameters;
* phonetic notation;
* supported emotions;
* output format;
* streaming behavior.

They may not redefine:

* Mei’s vocal age;
* core timbre;
* warmth;
* clarity;
* personality;
* accent direction;
* ethical restrictions.

---

# 94. Provider migration

A provider migration requires:

1. generation of a standard comparison script;
2. comparison with the master voice;
3. evaluation of timbre;
4. evaluation of pronunciation;
5. evaluation of emotional range;
6. evaluation of long-form stability;
7. lip-sync testing;
8. multilingual testing when applicable;
9. fidelity scoring;
10. human approval.

Migration must not be based only on cost or technical availability.

---

# 95. Voice fidelity scoring

Voice fidelity is evaluated on a 100-point scale.

| Category                  |  Weight |
| ------------------------- | ------: |
| Core vocal identity       |      20 |
| Timbre consistency        |      15 |
| Apparent vocal age        |       8 |
| Warmth                    |       8 |
| Clarity and articulation  |      12 |
| Naturalness               |      10 |
| Rhythm and pacing         |       7 |
| Pronunciation             |       8 |
| Emotional appropriateness |       5 |
| Audio quality             |       4 |
| Lip-sync suitability      |       3 |
| **Total**                 | **100** |

---

# 96. Approval thresholds

```text
95–100  Excellent voice fidelity
90–94   Approved
85–89   Conditional review
75–84   Major correction required
0–74    Rejected
```

Official publication requires:

```text
Voice fidelity ≥ 90/100
```

Mandatory minimums:

```text
Core vocal identity ≥ 17/20
Timbre consistency ≥ 12/15
Clarity and articulation ≥ 10/12
Naturalness ≥ 8/10
Pronunciation ≥ 6/8
```

A clean recording cannot compensate for the wrong voice identity.

---

# 97. Blocking voice defects

Immediate rejection is required when:

* the voice no longer sounds like Mei;
* the vocal age is clearly incorrect;
* the voice becomes childlike;
* the voice becomes masculine without approved redesign;
* the voice imitates an unauthorized real person;
* severe robotic delivery is present;
* important words are unintelligible;
* pricing or legal terms are mispronounced;
* language changes unexpectedly;
* strong seductive delivery appears;
* shouting appears without approved context;
* severe audio clipping occurs;
* the voice and lip-sync are visibly incompatible;
* the voice makes deceptive human claims.

---

# 98. Major voice defects

Major correction is required for:

* noticeable timbre drift;
* unstable accent;
* excessive speed;
* excessive slowness;
* monotone delivery;
* overenthusiasm;
* cold delivery;
* poor pauses;
* repeated pronunciation errors;
* unnatural breathing;
* inconsistent loudness;
* visible audio-video delay;
* provider artifacts;
* emotional mismatch.

---

# 99. Minor voice defects

Minor defects include:

* slightly unnatural pause;
* one weak word ending;
* minor sibilance;
* slight energy mismatch;
* small pronunciation inconsistency;
* subtle room-tone change;
* minor breath artifact.

Accumulated minor defects may become a major issue.

---

# 100. Voice QA checklist

```text
[ ] The approved Mei voice model is used
[ ] The correct voice version is used
[ ] The voice sounds recognizably like Mei
[ ] The vocal age matches Mei
[ ] The voice is warm
[ ] The voice is professional
[ ] The voice is clear
[ ] The voice is natural
[ ] The voice is reassuring when required
[ ] The pace matches the content
[ ] Pauses are correctly placed
[ ] Sentence endings are clear
[ ] Brand names are correctly pronounced
[ ] Product names are correctly pronounced
[ ] Acronyms are correctly pronounced
[ ] Numbers are correctly spoken
[ ] Dates are correctly spoken
[ ] Currency values are correctly spoken
[ ] Emotional delivery matches the script
[ ] Vocal delivery matches facial expression
[ ] Vocal delivery matches gestures
[ ] No robotic artifacts are audible
[ ] No unauthorized real-person imitation is present
[ ] Audio is free from clipping
[ ] Noise is acceptable
[ ] Loudness is appropriate
[ ] Lip-sync compatibility is validated
[ ] Voice continuity is preserved across shots
[ ] Voice-fidelity threshold is reached
[ ] Human approval was completed when required
```

---

# 101. Generation metadata

Every official voice asset should record:

```yaml
character_id: mei
character_sdk_version: 1.0.0
voice_version: 1.0.0
provider: ""
model: ""
voice_id: ""
language: fr
language_variant: fr-FR
script_id: ""
script_version: ""
pronunciation_dictionary_version: ""
emotion: neutral
emotion_intensity: 1
pace_wpm_target: 155
speed_parameter: 1.0
pitch_parameter: 0
audio_format: wav
sample_rate: 48000
channels: mono
duration_seconds: null
voice_fidelity_score: null
audio_quality_status: draft
lip_sync_status: not_tested
validation_status: draft
approved_by: null
```

---

# 102. Pronunciation dictionary

The SDK should maintain a versioned pronunciation dictionary for recurring terms.

Recommended structure:

```yaml
dictionary_version: 1.0.0
language: fr-FR
entries:
  - term: Mei
    pronunciation: "Mèï"
    status: approved
  - term: Virtual Humans SDK
    pronunciation: ""
    status: pending
```

The exact pronunciation of Mei’s name must be validated through the approved voice reference.

---

# 103. AI Command Center OS integration

AI Command Center OS must use this document to:

* select Mei’s approved voice;
* select the correct provider configuration;
* normalize scripts for speech;
* load pronunciation dictionaries;
* select emotion and intensity;
* control pace;
* generate voice assets;
* validate audio quality;
* compare outputs with the master reference;
* calculate voice-fidelity scores;
* prepare lip-sync input;
* preserve voice versions;
* reject blocking defects.

AI Command Center OS must not:

* select a different voice because it sounds more fashionable;
* invent a new accent;
* imitate a real person;
* alter the voice identity for each brand;
* skip pronunciation validation;
* publish unvalidated synthetic speech;
* conceal material uncertainty in the script through confident delivery.

---

# 104. Locked voice summary

The following characteristics are locked for Mei SDK v1.0.0:

```text
Adult feminine voice
Apparent vocal age in the early thirties
Warm timbre
Clear articulation
Natural contemporary delivery
Calm confidence
Professional tone
Reassuring quality
Moderate pitch
Stable vocal identity
Neutral metropolitan French default
No childish delivery
No seductive delivery by default
No unauthorized real-person imitation
```

---

# 105. Controlled voice summary

The following may vary within approved limits:

```text
Speech pace
Energy
Emotional intensity
Formality
Pitch movement
Pause duration
Enthusiasm
Seriousness
Warmth intensity
Language
Localized accent
Breathiness
```

These variations must not create a different voice identity.

---

# 106. Contextual voice summary

The following depend on the production:

```text
Current emotion
Script
Language
Audience
Platform
Video duration
Call to action
Background environment
Music
Sound effects
Room acoustics
Lip-sync timing
```

Context cannot override the locked voice contract.

---

# 107. Final rule

Mei’s voice is not an interchangeable text-to-speech preset.

It is a versioned vocal identity.

The governing rule is:

```text
The provider may change.
The language may change.
The emotion may change.
The script may change.

Mei must always sound like Mei.
```
