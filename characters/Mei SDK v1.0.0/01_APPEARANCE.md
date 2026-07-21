# 01_APPEARANCE

> Virtual Humans SDK
> Character SDK: Mei
> SDK version: 1.0.0
> Appearance version: 1.0.0
> Status: approved visual specification
> Classification: official visual identity contract

---

# 1. Purpose

This document defines the official physical appearance of Mei.

It is the authoritative textual reference for:

* image generation;
* video generation;
* identity preservation;
* visual validation;
* provider adaptation;
* prompt construction;
* quality assurance;
* Character Lock enforcement;
* AI Command Center OS integration.

This document defines **what Mei looks like**.

It does not define:

* her personality;
* her voice;
* her behavior;
* her professional role;
* her wardrobe library;
* her marketing messages;
* her social-media strategy.

Those elements are defined in their respective SDK files.

---

# 2. Sources of truth

Mei’s visual identity is determined using the following hierarchy:

```text
1. Approved identity reference assets
2. Approved multi-angle identity boards
3. Approved full-body reference assets
4. Approved expression and pose assets
5. This document
6. Prompt descriptions
7. Provider interpretations
```

When a written description conflicts with an approved reference image, the approved reference image has priority.

A generated output must never replace an approved reference automatically.

---

# 3. Reference locations

Official visual assets are stored in the existing SDK structure:

```text
characters/Mei SDK v1.0.0/assets/
├── identity/
├── expressions/
├── poses/
├── outfits/
└── videos/
```

Their responsibilities are:

```text
assets/identity/      official face and body references
assets/expressions/   approved facial-expression references
assets/poses/         approved body-pose references
assets/outfits/       approved wardrobe looks
assets/videos/        generated and approved video media
```

No additional visual-identity folder is required.

---

# 4. Visual classification system

Every appearance characteristic belongs to one of three classes.

## 4.1 LOCKED

A locked element is part of Mei’s permanent identity.

It must not change between productions.

Modification requires:

* explicit human approval;
* an impact assessment;
* updated reference assets;
* an updated Character Lock;
* a new appearance version;
* regression testing.

## 4.2 CONTROLLED

A controlled element may vary within defined limits.

Variation must:

* remain compatible with Mei’s identity;
* be requested by the production context;
* avoid altering facial recognition;
* pass visual QA.

## 4.3 CONTEXTUAL

A contextual element can change freely according to the scene, provided it does not contradict a locked characteristic.

---

# 5. Identity summary

```yaml
character_id: mei
character_name: Mei
character_type: virtual-human
gender_presentation: female
apparent_age_category: adult
apparent_age_range: 28-35
visual_origin: original fictional identity
appearance_style: photorealistic
overall_impression:
  - warm
  - modern
  - professional
  - approachable
  - confident
  - natural
```

Mei is an adult Asian-presenting woman with a stable photorealistic identity.

No precise nationality, country of origin or ethnic biography is inferred from her appearance.

---

# 6. Overall visual signature

Mei’s global visual signature consists of:

* an adult feminine appearance;
* an oval and balanced face;
* dark brown almond-shaped eyes;
* long natural black hair;
* a warm and recognizable smile;
* a clear, healthy and naturally textured complexion;
* a slim and naturally proportioned silhouette;
* an elegant but approachable posture;
* subtle makeup;
* minimal accessories;
* a modern professional presence.

These characteristics must remain recognizable across all media.

---

# 7. Apparent age

Classification:

```text
LOCKED
```

Official apparent age range:

```text
Approximately 28 to 35 years old
```

Target visual perception:

```text
Early thirties
```

Mei must not appear:

* under 25;
* adolescent;
* significantly older than 35;
* artificially aged;
* artificially rejuvenated;
* visually inconsistent between shots.

Natural lighting may slightly affect perceived age, but the character must remain clearly within the official range.

---

# 8. Height

Classification:

```text
CONTROLLED
```

Reference target:

```text
Approximately 167 cm
```

The precise value is a production reference, not a biographical claim.

Allowed visual tolerance:

```text
± 3 cm in apparent scale
```

Height must remain coherent when Mei appears:

* beside furniture;
* beside vehicles;
* beside another character;
* holding a product;
* walking through a real environment.

Perspective must not make Mei appear unusually short or tall.

---

# 9. Body type

Classification:

```text
LOCKED
```

Official body type:

```text
Slim, naturally proportioned, lightly athletic
```

Required characteristics:

* balanced shoulders and hips;
* natural waist;
* slender but realistic arms;
* natural leg proportions;
* realistic body volume;
* healthy adult appearance;
* no exaggerated muscular definition;
* no extreme thinness;
* no exaggerated curves.

The body must remain anatomically credible.

---

# 10. Body proportions

Classification:

```text
LOCKED
```

Mei must retain:

* consistent head-to-body ratio;
* stable shoulder width;
* stable torso length;
* stable arm length;
* stable leg length;
* stable hand scale;
* stable foot scale;
* natural feminine proportions.

Prohibited variations include:

* an oversized head;
* an unusually small head;
* excessively long legs;
* shortened arms;
* an unnaturally narrow waist;
* excessive shoulder width;
* inconsistent body volume between images;
* incompatible full-body and portrait identities.

---

# 11. Silhouette

Classification:

```text
LOCKED
```

The official silhouette is:

* slender;
* balanced;
* upright;
* feminine;
* modern;
* natural;
* non-caricatural.

The silhouette must remain recognizable even when:

* the outfit changes;
* the camera angle changes;
* Mei sits;
* Mei walks;
* Mei holds an object;
* Mei wears professional clothing;
* Mei wears casual clothing.

Wardrobe must adapt to Mei’s silhouette, not redefine it.

---

# 12. Natural posture

Classification:

```text
CONTROLLED
```

Default posture:

* upright without stiffness;
* shoulders relaxed;
* neck naturally extended;
* head level;
* weight balanced;
* arms relaxed;
* confident but approachable stance.

Mei must not default to:

* military rigidity;
* exaggerated hip posing;
* hunched shoulders;
* an unnatural S-shaped spine;
* a mannequin stance;
* a provocative pose;
* a robotic pose.

Pose-specific rules are maintained in the pose assets and associated documentation.

---

# 13. Face identity

Classification:

```text
CRITICAL LOCKED
```

The face is the most important element of Mei’s visual identity.

It must remain recognizable across:

* front views;
* three-quarter views;
* profiles;
* close-ups;
* full-body shots;
* different lighting;
* different outfits;
* different backgrounds;
* image and video providers;
* neutral and expressive states.

A visually attractive result that does not preserve Mei’s face must be rejected.

---

# 14. Face shape

Classification:

```text
LOCKED
```

Official characteristics:

* oval face;
* balanced width-to-height ratio;
* soft jawline;
* gently rounded chin;
* moderately defined cheekbones;
* harmonious facial proportions.

The face must not become:

* strongly square;
* sharply triangular;
* excessively round;
* unusually elongated;
* extremely narrow;
* heavily sculpted.

---

# 15. Forehead

Classification:

```text
LOCKED
```

Characteristics:

* medium height;
* balanced width;
* naturally proportioned;
* smooth transition to the hairline.

The forehead must not appear:

* unusually large;
* unusually narrow;
* artificially shortened;
* significantly altered by hairstyle.

---

# 16. Jawline

Classification:

```text
LOCKED
```

Characteristics:

* soft;
* feminine;
* clearly defined without sharp angularity;
* consistent between front and profile references.

Avoid:

* a highly angular jaw;
* an extremely narrow jaw;
* an overly prominent mandibular line;
* a double-chin artifact;
* inconsistent left and right geometry.

---

# 17. Chin

Classification:

```text
LOCKED
```

Characteristics:

* gently rounded;
* moderately projected;
* proportionate to the lower face;
* neither pointed nor square.

The chin must not be enlarged, shortened or reshaped by provider interpretation.

---

# 18. Cheekbones and cheeks

Classification:

```text
LOCKED
```

Characteristics:

* cheekbones slightly defined;
* natural cheek volume;
* subtle fullness when smiling;
* no hollow or overly sculpted effect.

The smile may raise the cheeks naturally but must not alter Mei’s underlying facial structure.

---

# 19. Eyes

Classification:

```text
CRITICAL LOCKED
```

Official characteristics:

```yaml
color: dark brown
shape: almond-shaped
size: medium
spacing: balanced
expression: bright, warm and attentive
```

The eyes must remain:

* symmetrical within natural limits;
* proportionate;
* clearly focused;
* naturally moist and reflective;
* human and photorealistic.

Prohibited:

* blue, green or grey eye color;
* excessively enlarged eyes;
* anime-style eyes;
* glassy or lifeless eyes;
* crossed eyes;
* inconsistent gaze direction;
* mismatched iris size;
* excessive whitening.

---

# 20. Eyelids

Classification:

```text
LOCKED
```

The eyelid structure must remain consistent with the reference images.

Avoid:

* exaggerated double-eyelid folds;
* overly deep eye sockets;
* significant left-right asymmetry;
* eyelid geometry that changes Mei’s identity;
* overly heavy eyelids caused by age drift.

---

# 21. Eyelashes

Classification:

```text
CONTROLLED
```

Default appearance:

* dark;
* natural;
* moderately long;
* subtle enhancement allowed.

Allowed:

* light mascara;
* slightly enhanced definition for commercial images.

Prohibited:

* oversized artificial lashes;
* theatrical lashes;
* strongly stylized doll-like lashes;
* lashes that obscure the eye shape.

---

# 22. Eyebrows

Classification:

```text
LOCKED
```

Characteristics:

* dark brown to black;
* medium thickness;
* natural density;
* soft natural arch;
* balanced placement.

Allowed:

* light grooming;
* subtle makeup correction.

Prohibited:

* very thin eyebrows;
* highly arched eyebrows;
* block-shaped cosmetic eyebrows;
* significantly lighter eyebrow color;
* incompatible shape changes.

---

# 23. Nose

Classification:

```text
CRITICAL LOCKED
```

Characteristics:

* straight;
* medium size;
* naturally proportioned;
* soft bridge;
* balanced tip;
* coherent in front and profile views.

The nose must not become:

* extremely narrow;
* highly pointed;
* upturned;
* enlarged;
* shortened;
* surgically stylized;
* inconsistent between angles.

---

# 24. Lips

Classification:

```text
LOCKED
```

Characteristics:

* medium fullness;
* balanced upper and lower lip;
* naturally defined contour;
* natural pink coloration;
* soft mouth corners.

Allowed:

* neutral pink lipstick;
* subtle gloss;
* campaign-compatible natural shades.

Prohibited:

* excessive volume;
* strongly altered lip shape;
* extreme matte colors by default;
* overdrawn contours;
* cosmetic-surgery appearance.

---

# 25. Smile

Classification:

```text
CRITICAL LOCKED
```

Mei’s smile is a major recognition marker.

Official smile characteristics:

* warm;
* natural;
* friendly;
* symmetrical within realistic limits;
* cheeks lightly raised;
* upper teeth naturally visible;
* eyes participating in the smile.

The smile must not appear:

* forced;
* excessively wide;
* frozen;
* sarcastic;
* unsettling;
* identical in every emotional context.

The official smile reference takes priority over written interpretation.

---

# 26. Teeth

Classification:

```text
LOCKED
```

Characteristics:

* natural white tone;
* realistic alignment;
* normal tooth size;
* natural gum visibility;
* no artificial veneer effect.

Prohibited:

* perfect synthetic “piano key” teeth;
* excessive whiteness;
* duplicated teeth;
* missing teeth caused by generation errors;
* irregular geometry between frames;
* unnatural gum exposure.

---

# 27. Ears

Classification:

```text
LOCKED
```

Ears must:

* remain proportionate;
* stay consistent between profile and three-quarter views;
* retain natural anatomy;
* be positioned correctly relative to eyes and nose.

They may be partially covered by hair.

Provider-generated ear deformation is a rejection defect when visible.

---

# 28. Skin tone

Classification:

```text
CRITICAL LOCKED
```

Official skin characteristics:

* fair to light-medium complexion;
* warm to neutral undertone;
* healthy appearance;
* consistent across face, neck, hands and body.

Lighting may modify exposure but must not change Mei’s apparent skin identity.

Prohibited:

* major skin-tone shifts;
* inconsistent face and body tones;
* excessive whitening;
* excessive tanning;
* grey or plastic skin;
* oversaturated skin;
* artificial porcelain effect.

---

# 29. Skin texture

Classification:

```text
LOCKED
```

Required rendering:

* natural;
* smooth but not airbrushed;
* subtle pores visible in close-up;
* realistic facial microtexture;
* natural highlights;
* no wax or plastic effect.

Allowed:

* minimal natural skin variation;
* very subtle freckles when compatible with reference images;
* realistic expression lines;
* subtle under-eye texture.

Prohibited:

* aggressive beauty filtering;
* complete removal of skin texture;
* excessive wrinkles;
* acne or scars not present in approved references;
* artificial cosmetic-surgery rendering.

---

# 30. Distinctive facial marks

Classification:

```text
LOCKED
```

Current status:

```text
No permanent prominent mark is defined.
```

A generated model must not invent:

* a large mole;
* a scar;
* a tattoo;
* a birthmark;
* facial piercing;
* visible permanent freckles;
* cosmetic alterations.

Minor temporary skin details must not become recurring identity markers.

---

# 31. Hair color

Classification:

```text
CRITICAL LOCKED
```

Official color:

```text
Natural black
```

Very dark brown reflections are acceptable under warm lighting.

Prohibited:

* blonde;
* red;
* blue;
* grey;
* clearly brown hair;
* colored highlights;
* ombré;
* balayage;
* fantasy colors.

A hair-color change requires a new approved identity variation and must never occur automatically.

---

# 32. Hair length

Classification:

```text
LOCKED
```

Official length:

```text
Long, approximately below the shoulders
```

The hair should generally fall between:

```text
upper chest and mid-back depending on pose and wave
```

Prohibited:

* short bob;
* pixie cut;
* waist-length hair;
* large length variation between shots;
* unexplained growth or shortening inside a sequence.

---

# 33. Hair texture

Classification:

```text
LOCKED
```

Characteristics:

* smooth;
* soft;
* naturally shiny;
* straight to lightly wavy;
* natural movement;
* medium volume.

Avoid:

* tight curls;
* highly textured curls;
* rigid synthetic strands;
* wet-look styling by default;
* excessive volume;
* perfectly flat helmet-like hair.

---

# 34. Hair parting

Classification:

```text
CONTROLLED
```

Default:

```text
Slightly off-center parting
```

Allowed:

* subtle left or right adjustment;
* natural movement caused by pose;
* partial hair placement behind one ear.

Prohibited:

* dramatic central redesign;
* heavy fringe hiding facial identity;
* straight-cut bangs;
* complete forehead obstruction;
* hairstyle changes that impair recognition.

---

# 35. Hair movement

Classification:

```text
CONTROLLED
```

Hair may react naturally to:

* walking;
* wind;
* head movement;
* body rotation;
* gravity;
* clothing contact.

Hair must not:

* pass through the body;
* fuse with clothing;
* change length during video;
* float without physical cause;
* move independently from the head;
* cover the face for extended periods unless requested.

---

# 36. Default hairstyle

Classification:

```text
CONTROLLED
```

Official default:

* hair worn down;
* natural movement;
* soft waves;
* face clearly visible;
* clean professional appearance.

Allowed controlled variants:

* hair partially behind one ear;
* low ponytail;
* simple professional ponytail;
* discreet half-up style;
* slightly straighter styling;
* slightly more pronounced natural waves.

Any variant must preserve:

* color;
* length;
* hairline;
* overall volume;
* facial recognition.

---

# 37. Hairline

Classification:

```text
LOCKED
```

The hairline must remain stable and natural.

Prohibited:

* receding hairline;
* unusually low hairline;
* large shape variations;
* visible gaps or bald areas;
* inconsistent temples;
* provider-generated hairline artifacts.

---

# 38. Neck

Classification:

```text
LOCKED
```

Characteristics:

* slender;
* naturally proportioned;
* smooth transition between head and shoulders;
* realistic length.

Avoid:

* elongated neck;
* shortened neck;
* excessive thinness;
* duplicated folds;
* anatomical twisting;
* necklace fusion.

---

# 39. Shoulders

Classification:

```text
LOCKED
```

Characteristics:

* balanced;
* naturally feminine;
* moderately narrow;
* relaxed by default.

Shoulder width must remain consistent across:

* portraits;
* full-body images;
* casual outfits;
* professional outfits;
* videos.

Clothing structure must not permanently redefine Mei’s anatomy.

---

# 40. Arms

Classification:

```text
LOCKED
```

Characteristics:

* slender;
* naturally toned;
* anatomically proportional;
* consistent length.

Prohibited:

* overly muscular arms;
* extremely thin arms;
* unequal arm length;
* broken elbow anatomy;
* arm-body fusion;
* disappearing limbs.

---

# 41. Hands

Classification:

```text
LOCKED ANATOMY / CONTROLLED PRESENTATION
```

Hands must be:

* adult feminine hands;
* naturally proportioned;
* anatomically correct;
* consistent in skin tone;
* visually compatible with Mei’s body.

Each visible hand must have:

```text
Five fingers
```

Prohibited defects:

* extra fingers;
* missing fingers;
* fused fingers;
* duplicated hands;
* deformed joints;
* reversed hands;
* inconsistent hand size;
* objects fused into fingers;
* unexplained finger disappearance between video frames.

Hands are a blocking QA criterion in product and presenter content.

---

# 42. Nails

Classification:

```text
CONTROLLED
```

Default:

* short to medium length;
* neat;
* natural shape;
* neutral or transparent finish.

Allowed colors:

* transparent;
* nude;
* pale pink;
* soft beige;
* discreet brand-compatible colors after validation.

Prohibited by default:

* very long nails;
* extreme shapes;
* heavy nail art;
* fluorescent colors;
* damaged or inconsistent nails.

---

# 43. Torso

Classification:

```text
LOCKED
```

The torso must remain:

* slender;
* naturally proportioned;
* anatomically realistic;
* compatible with the approved silhouette.

Wardrobe must not create an artificial body shape that contradicts the reference assets.

---

# 44. Waist and hips

Classification:

```text
LOCKED
```

Characteristics:

* natural adult proportions;
* subtle waist definition;
* balanced hips;
* no exaggerated hourglass effect.

Prohibited:

* extreme waist reduction;
* unrealistic hip enlargement;
* inconsistent proportions across outfits;
* stylized or sexualized body reshaping.

---

# 45. Legs

Classification:

```text
LOCKED
```

Characteristics:

* long but realistic;
* slender;
* naturally proportioned;
* stable in length and volume.

Prohibited:

* excessively long legs;
* very short legs;
* twisted knees;
* duplicated limbs;
* inconsistent thigh or calf dimensions;
* unnatural walking geometry.

---

# 46. Feet

Classification:

```text
LOCKED ANATOMY / CONTEXTUAL FOOTWEAR
```

Feet must:

* remain anatomically correct;
* match the body scale;
* support realistic balance;
* align naturally with footwear.

Prohibited:

* reversed feet;
* floating feet;
* fused shoes;
* mismatched shoe sizes;
* extra feet;
* missing feet;
* impossible ankle orientation.

---

# 47. Walking appearance

Classification:

```text
CONTROLLED
```

When walking, Mei should appear:

* balanced;
* confident;
* relaxed;
* natural;
* forward-moving;
* coordinated.

Walking must preserve:

* face identity;
* body proportions;
* hair length;
* hand anatomy;
* foot placement;
* outfit continuity.

Avoid:

* runway exaggeration unless explicitly requested;
* robotic steps;
* sliding;
* foot penetration into the ground;
* asymmetrical stride artifacts.

---

# 48. Default makeup

Classification:

```text
CONTROLLED
```

Official default:

* light;
* natural;
* professional;
* designed to enhance rather than transform.

Recommended characteristics:

```yaml
foundation: light coverage
eyes: subtle definition
eyeliner: soft and discreet
mascara: natural
blush: light
lips: neutral pink
finish: natural to lightly luminous
```

The underlying face must remain recognizable without makeup.

---

# 49. Makeup variations

Allowed:

* natural daytime makeup;
* slightly polished commercial makeup;
* subtle evening makeup;
* soft brand-compatible lip color;
* controlled studio correction.

Requires specific approval:

* strong smoky eyes;
* bright lipstick;
* heavy contouring;
* editorial makeup;
* theatrical makeup;
* fantasy makeup.

Prohibited as default:

* face-changing contour;
* extreme lip enhancement;
* exaggerated eyelashes;
* mask-like foundation;
* cosmetic-surgery simulation.

---

# 50. Permanent accessories

Classification:

```text
NONE LOCKED
```

No accessory is permanently mandatory for Mei’s identity.

The character must remain recognizable without:

* earrings;
* necklace;
* watch;
* smartphone;
* bag;
* glasses;
* microphone.

Accessories are supporting elements, never identity substitutes.

---

# 51. Default jewelry

Classification:

```text
CONTROLLED
```

Preferred default:

* small gold hoop earrings or discreet earrings;
* delicate gold pendant necklace.

Allowed:

* minimal silver jewelry;
* discreet studs;
* fine bracelet;
* subtle watch.

Prohibited by default:

* oversized earrings;
* heavy necklaces;
* excessive jewelry layering;
* highly branded jewelry;
* facial piercings;
* jewelry obscuring the face.

Jewelry must not change between shots without narrative reason.

---

# 52. Glasses

Classification:

```text
CONTROLLED
```

Mei does not wear permanent prescription glasses as part of her locked identity.

Allowed:

* temporary professional glasses;
* sunglasses in appropriate outdoor scenes;
* protective glasses when the context requires them.

Rules:

* glasses must not hide the eyes unnecessarily;
* frame geometry must remain stable during video;
* reflections must not erase the eyes;
* glasses must not become a permanent feature without approval.

---

# 53. Tattoos and piercings

Classification:

```text
LOCKED ABSENCE
```

No visible tattoo or facial/body piercing is part of Mei’s official appearance.

A provider must not invent:

* tattoos;
* nose rings;
* lip piercings;
* eyebrow piercings;
* multiple prominent piercings.

Standard ear piercings for discreet earrings are permitted.

---

# 54. Clothing relationship

Clothing is not defined in this file.

Official outfits are managed in:

```text
assets/outfits/
03_WARDROBE.md
```

Appearance rules that remain mandatory regardless of outfit:

* body proportions must remain unchanged;
* skin tone must remain consistent;
* neck and shoulders must remain anatomically correct;
* clothing must not merge with the body;
* outfit fit must remain realistic;
* garments must not reshape Mei’s locked anatomy.

---

# 55. Expression relationship

Expressions are not invented freely when an approved reference exists.

Official expressions are managed in:

```text
assets/expressions/
08_EXPRESSIONS.md
```

The expression may change, but the following must remain stable:

* face shape;
* eye shape;
* nose geometry;
* lip structure;
* jawline;
* skin tone;
* hair identity;
* apparent age.

---

# 56. Approved expression families

The appearance system supports, at minimum:

* neutral;
* soft smile;
* happy;
* laughing;
* surprised;
* thinking;
* curious;
* focused;
* listening;
* serious;
* reassuring.

Every expression must remain recognizably Mei.

An emotion must deform the face naturally, not replace its geometry.

---

# 57. Pose relationship

Poses are managed in:

```text
assets/poses/
09_POSES.md
```

A pose may alter:

* head angle;
* shoulder orientation;
* arm placement;
* hand position;
* weight distribution;
* gaze direction;
* body rotation.

A pose may not alter:

* body scale;
* limb length;
* face identity;
* silhouette;
* apparent age;
* hair color;
* skin tone.

---

# 58. Smartphone handling

The smartphone is a recurring contextual accessory, not a permanent physical attribute.

When present:

* the device may be held in the right or left hand according to the approved pose;
* finger placement must be realistic;
* the screen must face the intended direction;
* the phone must not merge with the palm;
* the phone scale must remain realistic;
* the hand must retain five fingers;
* continuity must be preserved in video.

The original presenter reference commonly uses the right hand, but the device does not define Mei’s identity.

---

# 59. Photorealism

Classification:

```text
LOCKED STYLE
```

Official rendering target:

```text
High-quality photorealistic virtual human
```

Required:

* realistic anatomy;
* natural skin;
* believable hair;
* correct eyes;
* coherent lighting;
* plausible materials;
* credible body proportions;
* camera-realistic depth;
* no obvious synthetic artifacts.

Prohibited unless a campaign explicitly requests a derived style:

* illustration;
* anime;
* cartoon;
* comic-book style;
* plastic 3D avatar;
* video-game rendering;
* wax figure;
* doll appearance.

A stylized derivative never replaces the official photorealistic identity.

---

# 60. Image sharpness

The face and eyes must be sufficiently sharp to validate identity.

Allowed:

* controlled background blur;
* natural motion blur on moving limbs;
* cinematic depth of field.

Prohibited:

* blurred face;
* blurred eyes;
* oversharpened skin;
* artificial edge halos;
* inconsistent sharpness across facial regions.

Identity cannot be approved from an image where the face is not evaluable.

---

# 61. Lighting tolerance

Classification:

```text
CONTEXTUAL WITH IDENTITY CONSTRAINTS
```

Allowed lighting:

* natural daylight;
* soft studio light;
* warm interior light;
* neutral commercial lighting;
* controlled outdoor light;
* cinematic light when identity remains visible.

Lighting must not:

* change apparent skin identity;
* hide facial geometry;
* produce extreme color casts;
* erase the eyes;
* age or rejuvenate Mei significantly;
* create unrealistic skin texture.

Neutral-light identity references remain the comparison baseline.

---

# 62. Camera-angle tolerance

Allowed:

* front;
* three-quarter left;
* three-quarter right;
* left profile;
* right profile when supported by references;
* full body;
* medium shot;
* close-up;
* walking front view;
* controlled rear view.

High-risk angles:

* extreme low angle;
* extreme high angle;
* ultra-wide close-up;
* fisheye;
* extreme profile without reference;
* severe perspective distortion.

High-risk angles require stronger identity comparison.

---

# 63. Lens and perspective constraints

Recommended portrait rendering:

```text
Natural portrait perspective
No extreme wide-angle distortion
```

The camera must not cause:

* enlarged nose;
* reduced ears;
* stretched limbs;
* oversized hands;
* distorted face width;
* compressed body height;
* exaggerated forehead.

Lens choice is governed more precisely by `05_CAMERA.md`.

---

# 64. Image-to-video continuity

A video initialized from an approved image must preserve:

* face geometry;
* eye color and shape;
* nose shape;
* lips;
* teeth;
* skin tone;
* hair color;
* hair length;
* silhouette;
* outfit;
* accessories;
* apparent age.

Frame-to-frame identity drift is prohibited.

Typical rejection defects include:

* face morphing;
* eye-shape changes;
* hair-length changes;
* jewelry appearing or disappearing;
* changing teeth;
* changing hand anatomy;
* body-volume fluctuations;
* skin-tone flicker.

---

# 65. Multi-shot continuity

Across multiple shots in one production, Mei must remain the same person.

Mandatory continuity fields:

```yaml
character_id: mei
appearance_version: 1.0.0
identity_reference: required
outfit_id: required when clothing continuity applies
expression_id: recommended
pose_id: recommended
hair_variant: required when not default
makeup_variant: required when not default
accessories: explicit list
```

A new camera angle must not result in a new face.

---

# 66. Provider independence

This appearance contract applies to all providers.

A provider may interpret:

* syntax;
* prompt order;
* reference-image format;
* model-specific parameters;
* generation controls.

A provider may not reinterpret Mei’s identity.

Provider limitations must be adapted around the character, not solved by changing the character.

---

# 67. Visual-fidelity scoring

Visual fidelity is calculated on a 100-point scale.

## 67.1 Weighted categories

| Category                        |  Weight |
| ------------------------------- | ------: |
| Overall face identity           |      25 |
| Face shape and proportions      |      10 |
| Eyes and eyebrows               |      10 |
| Nose                            |       7 |
| Mouth, smile and teeth          |       8 |
| Skin tone and texture           |       8 |
| Hair identity                   |       8 |
| Apparent age                    |       5 |
| Body silhouette and proportions |       7 |
| Hands and anatomy               |       5 |
| Expression consistency          |       3 |
| Accessories and continuity      |       2 |
| Photorealism                    |       2 |
| **Total**                       | **100** |

## 67.2 Interpretation

```text
95–100  Excellent fidelity
90–94   Approved fidelity
85–89   Conditional review
75–84   Major correction required
0–74    Rejected
```

## 67.3 Minimum approval threshold

An official production requires:

```text
Overall visual fidelity ≥ 90/100
```

Additionally:

```text
Overall face identity ≥ 22/25
Eyes and eyebrows ≥ 8/10
Skin tone and texture ≥ 6/8
Hair identity ≥ 6/8
```

A high total score cannot compensate for a failed face identity.

---

# 68. Blocking defects

An image or video must be rejected immediately when any of the following occurs:

* Mei is not recognizable;
* the face belongs to another person;
* apparent age is outside the official range;
* eye color changes;
* hair color changes;
* major face geometry changes;
* skin tone changes significantly;
* body proportions become unrealistic;
* extra or missing limbs;
* extra or missing fingers;
* severe eye deformation;
* severe mouth or teeth deformation;
* face-body mismatch;
* identity drift during video;
* another real person’s likeness is reproduced;
* the result becomes cartoon-like without explicit authorization.

---

# 69. Major defects

Major correction is required for:

* noticeable but non-total facial drift;
* inconsistent jawline;
* altered nose shape;
* altered eye shape;
* excessive skin smoothing;
* incorrect hair length;
* inconsistent silhouette;
* poor profile fidelity;
* age drift;
* unrealistic smile;
* visible hand errors;
* inconsistent accessories;
* severe lens distortion.

---

# 70. Minor defects

Minor defects include:

* small hair-strand artifacts;
* slightly inconsistent makeup;
* minor jewelry variation;
* subtle asymmetry;
* slight lighting mismatch;
* small clothing-edge artifacts;
* minor nail inconsistencies.

Accumulated minor defects may become a major quality issue.

---

# 71. Human validation

Automated scoring does not replace final human approval.

Human review is mandatory for:

* new master references;
* identity updates;
* provider changes;
* public commercial campaigns;
* new profile angles;
* significant hairstyle variants;
* high-visibility videos;
* character-lock updates.

The final validator must compare the output directly with approved reference assets.

---

# 72. Master-reference governance

An asset can become a master reference only when:

1. Mei is clearly recognizable;
2. facial anatomy is correct;
3. body anatomy is correct;
4. the image is sufficiently sharp;
5. lighting permits identity evaluation;
6. the asset has no generation defects;
7. the asset is approved by Christian;
8. metadata is recorded;
9. the asset is placed in the official identity library;
10. the Character Lock is updated when necessary.

No provider output becomes a master reference by default.

---

# 73. Reference replacement

A better-quality reference may be added without changing Mei’s identity.

A reference replacement is allowed only if:

* it represents the same identity;
* it improves technical quality;
* it does not redefine facial geometry;
* it does not change apparent age;
* it passes regression comparison;
* it is manually approved.

The former reference should be deprecated or archived according to repository rules, not silently overwritten.

---

# 74. Appearance versioning

Patch version:

```text
1.0.1
```

Used for:

* wording corrections;
* metadata corrections;
* clearer constraints;
* non-identity-changing reference improvements.

Minor version:

```text
1.1.0
```

Used for:

* approved controlled variants;
* new reference angles;
* expanded hairstyle options;
* additional validated presentation modes.

Major version:

```text
2.0.0
```

Required for:

* face redesign;
* age-range change;
* permanent body-shape change;
* permanent hair-color change;
* major silhouette change;
* identity replacement.

---

# 75. Prompt requirements

Every official generation prompt must load or represent:

```yaml
character_id: mei
sdk_version: 1.0.0
appearance_version: 1.0.0
identity_reference: approved asset
appearance_lock: enabled
apparent_age: early thirties
gender_presentation: adult woman
eye_color: dark brown
hair_color: natural black
hair_length: below shoulders
rendering_style: photorealistic
```

A text-only prompt is insufficient for high-confidence identity reproduction when the provider accepts reference images.

---

# 76. Negative appearance constraints

Recommended negative block:

```text
different person, altered identity, face drift, age drift, teenager,
older woman, different eye color, blue eyes, green eyes, blonde hair,
red hair, short hair, altered nose, altered jawline, exaggerated lips,
plastic skin, wax skin, doll face, cartoon, anime, illustration,
deformed hands, extra fingers, missing fingers, extra limbs,
asymmetrical eyes, crossed eyes, duplicated features, distorted anatomy,
unrealistic body proportions, extreme beauty filter, cosmetic surgery look
```

Provider-specific syntax may vary, but the intent must remain unchanged.

---

# 77. AI Command Center OS integration

AI Command Center OS must use this document to:

* load Mei’s appearance constraints;
* select approved identity references;
* select pose and expression assets;
* build provider-specific prompts;
* attach negative constraints;
* request appropriate framing;
* compare generated results;
* calculate visual-fidelity scores;
* reject blocking defects;
* record validation metadata;
* preserve version history.

AI Command Center OS must not:

* invent an appearance update;
* promote an unapproved asset;
* change locked characteristics;
* replace the Character Lock;
* accept provider drift because the result is aesthetically pleasing.

---

# 78. Generation metadata

Every official generated asset should record:

```yaml
character_id: mei
character_sdk_version: 1.0.0
appearance_version: 1.0.0
identity_reference_ids: []
provider: ""
model: ""
generation_date: ""
prompt_version: ""
outfit_id: ""
pose_id: ""
expression_id: ""
hair_variant: default
makeup_variant: default
accessories: []
visual_fidelity_score: null
validation_status: draft
approved_by: null
```

---

# 79. Appearance QA checklist

```text
[ ] The character is clearly recognizable as Mei
[ ] The approved identity reference was used
[ ] The face shape matches
[ ] The apparent age matches
[ ] The eyes are dark brown and almond-shaped
[ ] The eyebrows match the official form
[ ] The nose geometry matches
[ ] The lips and smile match
[ ] The teeth are natural and consistent
[ ] The skin tone matches
[ ] The skin texture is photorealistic
[ ] The hair is natural black
[ ] The hair length is consistent
[ ] The hair texture is consistent
[ ] The silhouette matches
[ ] Body proportions are natural
[ ] Hands and fingers are correct
[ ] No invented permanent mark is visible
[ ] Makeup remains within approved limits
[ ] Accessories are coherent
[ ] The output is photorealistic
[ ] No provider artifact affects identity
[ ] The visual-fidelity threshold is reached
[ ] Human approval was completed when required
```

---

# 80. Locked appearance summary

The following characteristics must not change in Mei SDK v1.0.0:

```text
Adult feminine appearance
Apparent age in the early-thirties range
Original Asian-presenting facial identity
Oval face
Soft jawline
Rounded chin
Moderately defined cheekbones
Dark brown almond-shaped eyes
Stable eyebrow shape
Stable nose geometry
Stable lips and recognizable smile
Natural teeth
Fair to light-medium warm/neutral complexion
Natural skin texture
Natural black hair
Long hair below the shoulders
Straight to lightly wavy hair texture
Slim, naturally proportioned silhouette
Stable body proportions
Photorealistic visual style
No permanent tattoo or facial piercing
```

---

# 81. Controlled appearance summary

The following may vary under controlled conditions:

```text
Hair parting
Minor hairstyle changes
Hair placement behind the ears
Natural makeup intensity
Neutral lipstick shade
Discreet jewelry
Temporary glasses
Nail color
Expression
Pose
Lighting
Camera angle
```

These variations must never interfere with recognition.

---

# 82. Contextual appearance summary

The following are contextual and defined outside this file:

```text
Clothing
Shoes
Smartphone
Bag
Microphone
Product
Vehicle
Background
Weather
Scene
Brand colors
Campaign styling
```

Contextual elements cannot override the locked identity.

---

# 83. Final rule

Mei’s appearance is not a loose prompt description.

It is a versioned visual identity contract supported by approved reference assets.

The governing rule is:

```text
The generated scene may change.
The outfit may change.
The expression may change.
The provider may change.

Mei must remain Mei.
```
