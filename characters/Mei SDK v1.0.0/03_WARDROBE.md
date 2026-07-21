# 03_WARDROBE

> Virtual Humans SDK
> Character SDK: Mei
> SDK version: 1.0.0
> Wardrobe version: 1.0.0
> Status: approved wardrobe specification
> Classification: official clothing and styling contract

---

# 1. Purpose

This document defines Mei’s official wardrobe system.

It governs:

* clothing selection;
* outfit consistency;
* styling rules;
* garment quality;
* permitted variations;
* prohibited styling;
* outfit identification;
* brand adaptation;
* image-to-video continuity;
* visual validation;
* AI Command Center OS integration.

This document defines **what Mei may wear and how her outfits must be managed**.

It does not redefine:

* Mei’s physical appearance;
* her body proportions;
* her personality;
* her voice;
* her expressions;
* her poses;
* campaign-specific brand rules;
* legal disclosure requirements.

Those elements are defined in their respective SDK files.

---

# 2. Wardrobe source of truth

The official hierarchy is:

```text
1. Approved outfit reference images
2. Approved outfit metadata
3. 03_WARDROBE.md
4. 01_APPEARANCE.md
5. Campaign styling instructions
6. Provider-specific prompts
7. Provider interpretation
```

When a written description conflicts with an approved outfit image, the approved image has priority.

A generated outfit must never automatically become an official look.

---

# 3. Official asset location

Approved wardrobe assets remain in the existing structure:

```text
characters/Mei SDK v1.0.0/assets/outfits/
```

No additional wardrobe directory is required.

The folder may contain:

* official outfit reference images;
* outfit thumbnails;
* front views;
* three-quarter views;
* full-body views;
* garment detail images;
* provider-ready references;
* approved outfit variants.

---

# 4. Wardrobe principles

Mei’s wardrobe must remain:

* modern;
* elegant;
* professional;
* approachable;
* realistic;
* wearable;
* visually coherent;
* compatible with her personality;
* adaptable to different brands;
* non-provocative by default.

The wardrobe should support the message without becoming the main subject unless the production is specifically about fashion.

---

# 5. Wardrobe classification system

Every wardrobe element belongs to one of four classes.

## 5.1 OFFICIAL LOOK

A complete approved outfit with a unique identifier.

An official look includes:

* garments;
* colors;
* footwear;
* visible accessories;
* styling notes;
* approved use cases;
* restrictions;
* reference assets.

## 5.2 CONTROLLED VARIANT

A permitted variation of an official look.

Examples:

* jacket open or closed;
* sleeves slightly rolled;
* approved shoe alternative;
* discreet jewelry change;
* minor fabric adaptation;
* approved seasonal variation.

## 5.3 CONTEXTUAL ITEM

An item selected for a specific scene.

Examples:

* coat;
* scarf;
* safety vest;
* helmet;
* gloves;
* weather protection;
* temporary branded accessory.

## 5.4 PROHIBITED ITEM

An item or styling direction incompatible with Mei SDK v1.0.0.

---

# 6. Outfit identity model

Every official outfit must have a stable identifier.

Format:

```text
LOOK_001
LOOK_002
LOOK_003
...
```

The identifier must not depend on:

* file name alone;
* provider;
* campaign;
* brand;
* image resolution;
* language.

An official look keeps the same ID across all approved assets.

---

# 7. Outfit metadata model

Each official look should be represented by metadata equivalent to:

```yaml
outfit_id: LOOK_001
character_id: mei
wardrobe_version: 1.0.0
status: approved
display_name: ""
category: ""
formality: ""
season: ""
primary_colors: []
secondary_colors: []
garments: []
footwear: ""
accessories: []
approved_contexts: []
restricted_contexts: []
reference_assets: []
controlled_variants: []
validation_status: approved
approved_by: Christian
```

---

# 8. Wardrobe categories

Approved wardrobe categories include:

```text
professional
business-casual
smart-casual
casual
presenter
technology
automotive
travel
lifestyle
seasonal
formal
event
branded
safety-context
```

A look may belong to more than one category.

---

# 9. Default wardrobe style

Classification:

```text
LOCKED DIRECTION
```

Mei’s default wardrobe direction is:

```text
Modern smart-casual with professional elegance
```

Typical characteristics:

* clean silhouettes;
* fitted but not tight garments;
* contemporary cuts;
* moderate color contrast;
* simple layering;
* limited patterns;
* quality fabrics;
* discreet accessories;
* practical footwear.

---

# 10. Relationship with Mei’s appearance

Wardrobe must respect `01_APPEARANCE.md`.

Clothing must never:

* alter Mei’s locked body proportions;
* create an artificial waist;
* enlarge or reduce her body unnaturally;
* hide her face in standard presenter content;
* change her apparent age significantly;
* create a different character identity;
* fuse with skin or hair;
* distort shoulders, arms or legs.

Mei’s anatomy remains the source of truth.

The outfit adapts to Mei.

Mei does not adapt anatomically to the outfit.

---

# 11. Relationship with Mei’s personality

Wardrobe must visually support:

* warmth;
* professionalism;
* confidence;
* modernity;
* approachability;
* elegance;
* reliability.

Avoid styling that makes Mei appear:

* intimidating;
* childish;
* provocative;
* excessively luxurious;
* theatrical;
* aggressive;
* careless;
* outdated;
* visually disconnected from the audience.

---

# 12. Fit

Classification:

```text
CRITICAL CONTROLLED
```

Garments should fit naturally.

Required:

* realistic shoulder seams;
* correct sleeve length;
* natural waist placement;
* believable fabric tension;
* correct trouser length;
* coherent jacket proportions;
* appropriate shoe fit.

Prohibited:

* garments fused to the body;
* excessively tight clothing;
* oversized clothing without a deliberate approved style;
* impossible folds;
* floating fabric;
* inconsistent garment dimensions;
* changing fit between video frames.

---

# 13. Modesty and coverage

Default wardrobe must remain suitable for:

* public advertising;
* professional presentations;
* product demonstrations;
* social media;
* business communication;
* general audiences.

Default rules:

* no excessive cleavage;
* no transparent clothing;
* no visible underwear;
* no extremely short garments;
* no fetish styling;
* no deliberately sexualized clothing;
* no suggestive cut-outs;
* no body paint presented as clothing.

A campaign cannot silently override these rules.

---

# 14. Necklines

Preferred:

* crew neck;
* round neck;
* modest V-neck;
* boat neck;
* shirt collar;
* blouse collar;
* simple structured neckline.

Controlled:

* deeper V-neck when still professional;
* asymmetric neckline for an approved event look.

Prohibited by default:

* plunging neckline;
* excessive chest exposure;
* lingerie-style neckline;
* transparent neckline panels.

---

# 15. Sleeve styles

Approved:

* sleeveless professional top;
* short sleeves;
* three-quarter sleeves;
* long sleeves;
* blouse sleeves;
* fitted jacket sleeves;
* lightly rolled sleeves.

Sleeves must:

* remain anatomically coherent;
* preserve hand visibility when needed;
* avoid merging with wrists;
* stay consistent between frames.

---

# 16. Tops

Approved top categories:

* blouse;
* shirt;
* fine knit;
* fitted T-shirt;
* structured top;
* polo;
* professional tank top with appropriate coverage;
* sweater;
* lightweight turtleneck;
* branded presenter top.

Tops should be:

* clean;
* modern;
* correctly fitted;
* free of random text;
* compatible with microphone placement when applicable.

---

# 17. Shirts and blouses

Preferred characteristics:

* clean collar;
* soft or structured fabric;
* modern cut;
* natural drape;
* restrained detailing.

Allowed:

* solid colors;
* subtle stripes;
* discreet patterns;
* soft texture;
* sleeves rolled neatly.

Avoid:

* oversized bows;
* excessive ruffles;
* highly transparent fabrics;
* historical styling;
* random logos;
* unstable button geometry.

---

# 18. Jackets and blazers

Approved:

* fitted blazer;
* relaxed modern blazer;
* short structured jacket;
* lightweight professional jacket;
* brand-compatible outer layer.

Jackets may be:

* open;
* closed;
* partially closed;
* worn over an approved top.

Continuity must preserve:

* button state;
* lapel shape;
* pocket placement;
* sleeve length;
* color;
* fabric;
* open or closed status.

---

# 19. Knitwear

Approved:

* fine knit sweater;
* fitted cardigan;
* lightweight turtleneck;
* modern crew-neck knit;
* soft professional knit.

Avoid:

* highly bulky knitwear in presenter scenes;
* childish motifs;
* excessive pilling;
* impossible knit texture;
* random pattern mutation;
* oversized collars hiding the face.

---

# 20. T-shirts

T-shirts may be used for:

* casual presentations;
* application demonstrations;
* technology content;
* social media;
* branded campaigns.

Preferred:

* fitted or lightly relaxed cut;
* opaque fabric;
* simple neckline;
* clean surface;
* solid or controlled brand color.

Any visible text or logo must be explicitly validated.

---

# 21. Trousers

Approved:

* tailored trousers;
* straight-leg trousers;
* slim trousers;
* wide-leg professional trousers;
* chinos;
* dark clean jeans;
* modern casual trousers.

Trousers must:

* sit naturally at the waist;
* preserve realistic leg anatomy;
* have coherent folds;
* maintain stable length;
* avoid body fusion.

---

# 22. Jeans

Approved jeans style:

* modern;
* clean;
* well fitted;
* limited distressing;
* realistic denim texture.

Preferred colors:

* dark blue;
* medium blue;
* black;
* off-white when contextually appropriate.

Prohibited by default:

* extreme tears;
* excessive distressing;
* very low waist;
* highly decorated denim;
* provocative cut-outs.

---

# 23. Skirts

Approved:

* knee-length pencil skirt;
* A-line skirt;
* midi skirt;
* structured professional skirt;
* flowing but controlled midi skirt.

Skirts must remain:

* professional;
* anatomically coherent;
* stable during movement;
* compatible with the pose.

Prohibited by default:

* very short miniskirts;
* extreme slits;
* transparent skirts;
* unstable fabric revealing unintended areas.

---

# 24. Dresses

Approved:

* professional sheath dress;
* modern midi dress;
* shirt dress;
* wrap-inspired dress with modest coverage;
* structured event dress;
* simple lifestyle dress.

Dresses should preserve:

* Mei’s natural silhouette;
* professional elegance;
* realistic movement;
* appropriate coverage.

Avoid:

* ballroom costumes;
* bridal appearance;
* highly revealing cuts;
* red-carpet styling without campaign approval;
* exaggerated luxury styling.

---

# 25. Shorts

Classification:

```text
RESTRICTED CONTEXTUAL
```

Shorts may be used only for:

* warm-weather lifestyle scenes;
* travel content;
* casual outdoor content;
* sports-related context when appropriate.

They must be:

* adult;
* modest;
* well fitted;
* non-provocative.

Shorts are not part of the default professional presenter wardrobe.

---

# 26. Outerwear

Approved:

* trench coat;
* tailored coat;
* modern short coat;
* lightweight rain jacket;
* technical jacket;
* casual jacket;
* automotive jacket;
* winter coat.

Outerwear must be contextually justified.

It must not appear in indoor studio content without reason.

---

# 27. Footwear

Approved default categories:

* loafers;
* clean sneakers;
* ankle boots;
* low or medium heels;
* flat shoes;
* professional pumps;
* practical outdoor footwear;
* context-appropriate safety footwear.

Footwear should be:

* modern;
* clean;
* correctly scaled;
* stable;
* coherent with the outfit;
* suitable for the action.

---

# 28. Heel height

Preferred:

```text
Flat to medium heel
```

High heels may be used only for:

* formal events;
* approved fashion scenes;
* static commercial imagery;
* specific brand contexts.

Avoid:

* extreme heels;
* impossible balance;
* high heels during technical or active demonstrations;
* footwear that creates unnatural posture.

---

# 29. Sneakers

Approved sneakers should be:

* clean;
* contemporary;
* visually simple;
* appropriately colored;
* correctly proportioned.

Avoid:

* oversized fantasy soles;
* random brand logos;
* highly complex patterns;
* dirty or damaged appearance unless narratively required.

---

# 30. Boots

Approved:

* ankle boots;
* practical motorcycle boots;
* clean winter boots;
* professional heeled boots;
* safety boots when context requires them.

Boot height and structure must remain stable across frames.

---

# 31. Bags

Classification:

```text
CONTEXTUAL
```

Allowed:

* handbag;
* shoulder bag;
* tote;
* laptop bag;
* backpack;
* travel bag;
* small professional bag.

Bags must:

* have realistic straps;
* remain attached correctly;
* not fuse with the body;
* stay consistent in video;
* not display unauthorized logos.

---

# 32. Belts

Classification:

```text
CONTROLLED
```

Belts may be used to:

* complete an outfit;
* support trouser fit;
* create a clean visual line;
* align with brand styling.

Avoid:

* oversized buckles;
* excessive luxury branding;
* impossible belt geometry;
* belts that unnaturally reshape the waist.

---

# 33. Jewelry relationship

Jewelry rules are shared with `01_APPEARANCE.md`.

Wardrobe styling may include:

* discreet earrings;
* fine necklace;
* subtle bracelet;
* simple watch;
* one or two restrained rings.

Jewelry must remain secondary to the outfit and Mei’s face.

---

# 34. Watches

Approved:

* understated analog watch;
* modern smartwatch;
* discreet professional watch.

The watch may support:

* technology content;
* lifestyle content;
* fitness-related demonstrations;
* professional presentation.

It must not change wrist or hand anatomy.

---

# 35. Headwear

Classification:

```text
RESTRICTED CONTEXTUAL
```

Allowed only when justified:

* safety helmet;
* motorcycle helmet;
* bicycle helmet;
* sun hat;
* winter hat;
* cap;
* branded event headwear.

Headwear must not permanently obscure Mei’s face or replace her hairstyle identity.

---

# 36. Scarves

Allowed:

* light professional scarf;
* winter scarf;
* subtle fashion scarf;
* brand-colored scarf.

Scarves must:

* remain physically plausible;
* not cover the mouth in presenter content;
* not fuse with hair;
* preserve neck anatomy.

---

# 37. Gloves

Allowed when context requires:

* winter gloves;
* motorcycle gloves;
* work gloves;
* protective gloves;
* presentation gloves for specific technical content.

Gloves must preserve correct hand anatomy and realistic grip.

---

# 38. Eyewear relationship

Eyewear remains controlled by `01_APPEARANCE.md`.

Wardrobe selection may include:

* sunglasses;
* temporary professional glasses;
* safety eyewear.

Eyewear must be explicitly included in outfit continuity metadata.

---

# 39. Color philosophy

Mei’s wardrobe should use colors that support:

* warmth;
* modernity;
* professionalism;
* clarity;
* brand adaptability.

Preferred base colors:

```text
white
off-white
black
navy
charcoal
light grey
beige
camel
soft brown
denim blue
```

Preferred accent colors:

```text
deep blue
soft blue
burgundy
forest green
warm yellow
soft pink
terracotta
teal
```

Accent colors must remain controlled.

---

# 40. Black

Black is approved for:

* trousers;
* jackets;
* dresses;
* shoes;
* structured professional looks;
* modern event styling.

An entirely black outfit should avoid:

* funeral appearance;
* severe authority styling;
* loss of garment detail;
* excessive visual coldness.

Warmth may be restored through:

* lighting;
* makeup;
* accessories;
* fabric variation;
* an open expression.

---

# 41. White

White is approved for:

* shirts;
* blouses;
* tops;
* sneakers;
* trousers;
* selected jackets.

White garments must retain:

* fabric texture;
* correct exposure;
* separation from the background;
* opacity;
* stable color.

Avoid clipped highlights and transparent rendering.

---

# 42. Blue

Blue is a preferred wardrobe family because it supports:

* trust;
* professionalism;
* technology;
* clarity;
* calmness.

Approved shades include:

* navy;
* royal blue;
* medium blue;
* pale blue;
* denim blue;
* controlled brand blue.

---

# 43. Yellow

Yellow may be used as:

* an accent;
* a branded color;
* a jacket or top in an approved look;
* a connection to automotive or technology branding.

Yellow must remain:

* intentional;
* well exposed;
* compatible with Mei’s skin tone;
* free from fluorescent drift unless explicitly required.

---

# 44. Red and burgundy

Approved uses:

* restrained top;
* blazer;
* dress;
* accessory;
* brand-compatible accent.

Preferred:

* burgundy;
* deep red;
* muted red;
* warm red.

Avoid by default:

* highly saturated full-red styling;
* provocative red-dress clichés;
* red combined with excessive glamour.

---

# 45. Green

Approved:

* forest green;
* olive;
* sage;
* teal-green;
* controlled brand green.

Avoid:

* green garments during green-screen production;
* uncontrolled chroma spill;
* fluorescent green unless deliberately designed.

Green-screen compatibility must be checked before production.

---

# 46. Patterns

Approved patterns:

* subtle stripes;
* small checks;
* restrained geometric patterns;
* discreet texture;
* minimal floral pattern for lifestyle content.

Prohibited by default:

* large unstable patterns;
* optical patterns causing video artifacts;
* complex repeating logos;
* provider-generated pseudo-text;
* highly distracting prints.

Patterns must remain stable between frames.

---

# 47. Logos

A visible logo is allowed only when:

* the brand is authorized;
* the correct official asset is used;
* placement is validated;
* proportions are correct;
* colors are correct;
* legal usage is confirmed.

A provider must never invent a logo.

Random pseudo-logos are prohibited.

---

# 48. Text on clothing

Text is allowed only when explicitly requested and validated.

Requirements:

* exact approved wording;
* correct spelling;
* readable typography;
* stable placement;
* no deformation;
* no frame-to-frame mutation.

For most generated content, text should be added in post-production rather than generated directly on clothing.

---

# 49. Brand adaptation

Mei may wear brand-adapted clothing through:

* approved colors;
* discreet logo placement;
* campaign-specific garment choice;
* branded accessories;
* approved uniform styling.

Brand adaptation must not:

* replace Mei’s core style;
* create a mascot costume;
* overload the outfit with logos;
* make Mei visually unrecognizable;
* violate the brand’s legal rules.

---

# 50. Multi-brand neutrality

Mei is brand-independent.

Therefore, her permanent wardrobe identity cannot belong exclusively to:

* one automotive brand;
* one application;
* one retailer;
* one fashion company;
* one technology company.

Official neutral looks must always remain available.

---

# 51. Presenter wardrobe

Presenter looks should prioritize:

* clear silhouette;
* visible hands;
* microphone compatibility;
* good separation from the background;
* stable fabric;
* moderate contrast;
* face visibility;
* comfortable movement.

Avoid:

* noisy jewelry;
* unstable flowing sleeves;
* highly reflective fabrics;
* distracting patterns;
* clothing matching the background exactly.

---

# 52. Green-screen wardrobe

For a pure green background, prohibit:

* green garments;
* green accessories;
* green reflections;
* translucent fabrics showing green spill;
* reflective surfaces that capture the green background.

Preferred colors:

* blue;
* black;
* white;
* beige;
* burgundy;
* yellow;
* grey.

Hair edges and garment edges must remain clean for keying.

---

# 53. Blue-screen wardrobe

For blue-screen production, avoid:

* blue garments;
* blue denim when it interferes with keying;
* blue accessories;
* reflective surfaces capturing the screen color.

Wardrobe must be selected according to the actual background technology.

---

# 54. Automotive wardrobe

Approved directions:

* smart-casual;
* modern jacket and trousers;
* clean presenter outfit;
* practical shoes;
* brand-colored accent;
* technical outerwear;
* motorcycle-specific equipment when required.

Avoid:

* clothing that suggests a mechanic qualification without context;
* unauthorized manufacturer uniforms;
* impractical footwear around vehicles;
* loose garments near moving equipment.

---

# 55. Motorcycle wardrobe

Depending on the scene, Mei may wear:

* motorcycle jacket;
* protective trousers;
* motorcycle boots;
* gloves;
* helmet;
* casual off-bike presentation clothing.

Safety equipment must be represented accurately when the scene implies actual riding.

A fashion jacket must not be presented as certified protective equipment unless verified.

---

# 56. Technology wardrobe

Preferred:

* modern blouse;
* fitted T-shirt;
* blazer;
* clean trousers;
* minimalist sneakers;
* smartwatch;
* subtle technology-brand color.

Technology styling should feel:

* contemporary;
* clean;
* accessible;
* credible;
* non-futuristic unless explicitly requested.

---

# 57. Application-presentation wardrobe

For application demos:

* avoid garments visually competing with the interface;
* preserve clear hand visibility;
* use neutral or brand-compatible colors;
* maintain a polished but accessible style;
* avoid excessive accessories.

The application remains the subject.

---

# 58. Travel wardrobe

Approved:

* smart-casual layers;
* trench coat;
* comfortable trousers;
* clean sneakers;
* practical bag;
* weather-appropriate outerwear;
* simple scarf.

Travel styling must remain realistic for:

* station environments;
* airports;
* city walking;
* hotels;
* transport demonstrations.

---

# 59. Lifestyle wardrobe

Lifestyle content may use:

* jeans;
* relaxed blouse;
* knitwear;
* simple dress;
* casual jacket;
* sneakers;
* ankle boots;
* seasonal accessories.

The result must remain adult, elegant and consistent with Mei’s identity.

---

# 60. Formal wardrobe

Formal content may use:

* tailored suit;
* elegant midi dress;
* structured jumpsuit;
* professional heels;
* refined jewelry.

Formal must not become:

* bridal;
* gala-level without reason;
* excessively luxurious;
* theatrical;
* provocative.

---

# 61. Safety-context wardrobe

When required, wardrobe may include:

* reflective vest;
* protective helmet;
* gloves;
* safety glasses;
* work jacket;
* safety shoes;
* high-visibility clothing.

Safety garments must:

* match the scene;
* be worn correctly;
* not include false certifications;
* remain anatomically and physically correct.

---

# 62. Seasonal adaptation

Approved seasonal categories:

```text
spring
summer
autumn
winter
all-season
```

Seasonal clothing must remain coherent with:

* location;
* weather;
* lighting;
* activity;
* background;
* footwear;
* accessories.

A winter coat in a summer scene is a continuity defect unless narratively explained.

---

# 63. Weather adaptation

Wardrobe may adapt to:

* rain;
* wind;
* cold;
* heat;
* snow;
* sun.

Examples:

* rain jacket;
* coat;
* umbrella;
* gloves;
* lighter fabrics;
* sun hat.

Weather adaptation must preserve Mei’s official styling direction.

---

# 64. Fabric selection

Preferred visual fabrics:

* cotton;
* denim;
* wool blend;
* fine knit;
* linen blend;
* crepe;
* matte synthetic technical fabric;
* soft leather or leather-like material when appropriate.

Fabrics should render:

* realistically;
* consistently;
* with believable folds;
* with controlled reflections.

---

# 65. Reflective fabrics

Classification:

```text
RESTRICTED
```

Highly reflective fabrics may create:

* lighting artifacts;
* color contamination;
* unstable video texture;
* body-shape distortion;
* unwanted visual attention.

Use only for:

* specific fashion content;
* event styling;
* technical or safety garments;
* approved campaign concepts.

---

# 66. Transparent fabrics

Classification:

```text
PROHIBITED BY DEFAULT
```

Transparent or semi-transparent fabrics require explicit approval.

They must never:

* reveal underwear;
* create accidental nudity;
* cause unstable body rendering;
* sexualize standard presenter content.

---

# 67. Fabric movement

Garments must react naturally to:

* walking;
* sitting;
* wind;
* arm movement;
* body rotation;
* gravity.

Prohibited:

* fabric passing through the body;
* clothing moving independently;
* garment length changing;
* disappearing jacket sections;
* sleeves changing shape between frames;
* unstable hems.

---

# 68. Layering

Approved layering examples:

```text
shirt + blazer
top + jacket
T-shirt + overshirt
blouse + coat
knit + trench coat
presenter top + branded jacket
```

Each layer must remain visually distinct and physically plausible.

Layer order must not change between frames.

---

# 69. Outfit continuity

Within one continuous production, the following must remain stable:

* outfit ID;
* garment colors;
* garment cuts;
* sleeve position;
* buttons;
* zippers;
* jacket open or closed state;
* footwear;
* jewelry;
* watch;
* belt;
* bag;
* visible logo;
* fabric texture.

Any intentional change must be scripted and recorded.

---

# 70. Image-to-video continuity

When animating an official outfit reference, the video must preserve:

* exact outfit identity;
* garment fit;
* colors;
* neckline;
* sleeve length;
* trouser or skirt length;
* shoes;
* accessories;
* visible branding.

Typical rejection defects:

* color drift;
* changing neckline;
* disappearing buttons;
* moving logos;
* different shoes;
* jacket appearing or disappearing;
* fabric merging with hands;
* inconsistent sleeve length.

---

# 71. Multi-shot continuity

Each shot must record:

```yaml
outfit_id: ""
outfit_variant: default
jacket_state: ""
sleeve_state: ""
footwear_id: ""
accessories: []
brand_elements: []
season: ""
weather_context: ""
```

A new camera angle must not recreate the outfit approximately.

It must preserve the same look.

---

# 72. Outfit variants

A controlled variant must be attached to an official look.

Example:

```yaml
outfit_id: LOOK_003
variant_id: LOOK_003_V02
changes:
  - jacket_open
  - sleeves_rolled_once
unchanged:
  - garments
  - colors
  - footwear
  - jewelry
```

A variant must not silently become a new official look.

---

# 73. Creating a new official look

A new look requires:

1. a clear use case;
2. a complete outfit definition;
3. a unique ID;
4. generated or photographed references;
5. anatomy validation;
6. garment-quality validation;
7. appearance compatibility review;
8. personality compatibility review;
9. continuity metadata;
10. human approval;
11. Character Lock compatibility;
12. repository registration.

---

# 74. Official look approval criteria

An outfit can be approved only when:

* Mei remains recognizable;
* body proportions are preserved;
* garments are realistic;
* fit is correct;
* colors are stable;
* footwear is coherent;
* accessories are controlled;
* no unintended text appears;
* no unauthorized logo appears;
* all visible anatomy is correct;
* the outfit supports its intended context;
* the reference image is technically usable.

---

# 75. Outfit deprecation

An official look may be deprecated when:

* it no longer matches quality standards;
* it duplicates another look;
* reference assets are defective;
* a brand authorization expires;
* it creates provider instability;
* it no longer supports the SDK direction.

Deprecation must not delete historical metadata silently.

---

# 76. Outfit versioning

Patch version:

```text
1.0.1
```

Used for:

* metadata correction;
* asset-name correction;
* description clarification;
* non-visual documentation updates.

Minor version:

```text
1.1.0
```

Used for:

* new official looks;
* approved variants;
* expanded footwear;
* seasonal additions;
* new brand-neutral styling options.

Major version:

```text
2.0.0
```

Required for:

* complete wardrobe-direction change;
* permanent styling repositioning;
* major formality change;
* fundamental aesthetic redesign.

---

# 77. Wardrobe scoring

Wardrobe fidelity is scored on a 100-point scale.

| Category                |  Weight |
| ----------------------- | ------: |
| Outfit identity         |      18 |
| Garment accuracy        |      15 |
| Fit and proportions     |      12 |
| Color fidelity          |      10 |
| Fabric realism          |       8 |
| Footwear accuracy       |       7 |
| Accessory continuity    |       6 |
| Anatomy compatibility   |      10 |
| Context suitability     |       6 |
| Brand and logo accuracy |       5 |
| Image/video continuity  |       3 |
| **Total**               | **100** |

---

# 78. Approval thresholds

```text
95–100  Excellent wardrobe fidelity
90–94   Approved
85–89   Conditional review
75–84   Major correction required
0–74    Rejected
```

Official publication requires:

```text
Wardrobe fidelity ≥ 90/100
```

Mandatory minimums:

```text
Outfit identity ≥ 15/18
Garment accuracy ≥ 12/15
Fit and proportions ≥ 9/12
Anatomy compatibility ≥ 8/10
```

---

# 79. Blocking wardrobe defects

Immediate rejection is required for:

* unintended nudity;
* transparent clothing exposing the body;
* outfit belonging to the wrong official look;
* major color change;
* severe body distortion;
* clothing fused with anatomy;
* unauthorized logo;
* invented text;
* missing garment;
* incompatible footwear;
* major frame-to-frame outfit mutation;
* sexualized styling outside approved context;
* childlike styling;
* unsafe clothing in a safety-critical scene.

---

# 80. Major wardrobe defects

Major correction is required for:

* incorrect neckline;
* wrong jacket cut;
* wrong trouser or skirt length;
* significant fabric inconsistency;
* garment fit altering Mei’s silhouette;
* missing accessories;
* wrong footwear;
* random logo-like marks;
* unstable patterns;
* incorrect seasonal styling;
* mismatch between outfit and production context.

---

# 81. Minor wardrobe defects

Minor defects include:

* slight fold inconsistency;
* minor jewelry variation;
* small fabric-texture drift;
* slightly different button spacing;
* subtle sleeve-position difference;
* small shoe-detail variation.

Accumulated minor defects may require rejection.

---

# 82. Prohibited default wardrobe directions

Mei must not be styled by default as:

* hypersexualized influencer;
* lingerie model;
* fetish character;
* schoolgirl;
* adolescent;
* fantasy princess;
* superhero;
* military officer;
* police officer;
* medical professional;
* mechanic;
* airline employee;
* lawyer;
* certified safety specialist;
* luxury-fashion celebrity.

Role-specific uniforms require validated context and must not imply false qualifications.

---

# 83. Uniforms and professional roles

Uniforms may be used only when:

* the scene clearly requires them;
* the role is fictional or properly authorized;
* the uniform does not imply an unverified qualification;
* branding is authorized;
* legal and safety implications are reviewed.

A costume must not be presented as proof of expertise.

---

# 84. Cultural clothing

Classification:

```text
RESTRICTED AND REVIEWED
```

Cultural or traditional clothing may be used only when:

* contextually justified;
* respectfully represented;
* accurately researched;
* free from stereotypes;
* approved for the production.

Mei’s Asian-presenting appearance does not authorize assumptions about nationality or traditional dress.

---

# 85. Religious clothing

Classification:

```text
RESTRICTED AND REVIEWED
```

Religious clothing must not be assigned to Mei without:

* explicit production intent;
* contextual justification;
* respectful validation;
* legal and cultural review.

Appearance must never be used to infer religion.

---

# 86. Political clothing

Classification:

```text
PROHIBITED BY DEFAULT
```

Mei must not wear:

* party logos;
* campaign slogans;
* political uniforms;
* ideological symbols;
* activist clothing;

unless the production has explicit legal, ethical and editorial approval.

---

# 87. Offensive or unsafe clothing

Prohibited:

* hateful symbols;
* discriminatory slogans;
* extremist branding;
* explicit sexual content;
* illegal product promotion;
* dangerous instructions;
* counterfeit branding;
* unauthorized regulated-industry claims.

---

# 88. Prompt requirements

Every wardrobe-aware generation prompt should specify:

```yaml
character_id: mei
character_sdk_version: 1.0.0
wardrobe_version: 1.0.0
outfit_id: LOOK_XXX
outfit_reference: required
outfit_variant: default
garment_list: []
primary_colors: []
footwear: ""
accessories: []
jacket_state: ""
sleeve_state: ""
continuity_lock: enabled
```

When the provider accepts image references, the approved outfit reference must be supplied.

---

# 89. Negative wardrobe constraints

Recommended negative block:

```text
wrong outfit, different clothing, altered garment color, missing jacket,
extra jacket, changed neckline, changed sleeve length, different shoes,
missing shoes, transparent clothing, visible underwear, excessive cleavage,
sexualized outfit, deformed fabric, clothing fused with body,
floating garment, broken buttons, random logo, fake text, unreadable text,
pattern mutation, changing accessories, inconsistent jewelry,
body shape altered by clothing, wardrobe continuity error
```

Provider syntax may vary, but the constraints remain mandatory.

---

# 90. AI Command Center OS integration

AI Command Center OS must use this file to:

* select an approved outfit;
* load its reference assets;
* match outfit to content type;
* check background compatibility;
* prevent green-screen conflicts;
* build provider-specific wardrobe prompts;
* enforce outfit continuity;
* validate branding;
* calculate wardrobe fidelity;
* reject blocking defects;
* register generated variants;
* preserve outfit version history.

AI Command Center OS must not:

* invent official outfit IDs;
* approve new looks automatically;
* add unauthorized logos;
* silently replace garments;
* infer uniforms from the subject;
* modify Mei’s anatomy to fit clothing.

---

# 91. Wardrobe QA checklist

```text
[ ] The correct outfit ID is used
[ ] The official reference asset is loaded
[ ] Mei remains recognizable
[ ] Mei’s body proportions are preserved
[ ] Every required garment is present
[ ] No unrequested garment is present
[ ] Garment colors match
[ ] Fit is realistic
[ ] Fabric is realistic
[ ] Neckline is correct
[ ] Sleeves are correct
[ ] Jacket state is correct
[ ] Trousers, skirt or dress length is correct
[ ] Footwear is correct
[ ] Jewelry is correct
[ ] Accessories are correct
[ ] No unauthorized logo is visible
[ ] No invented text is visible
[ ] Clothing is appropriate for the context
[ ] Clothing is appropriate for the weather
[ ] Clothing is compatible with the background
[ ] Green-screen conflicts were checked
[ ] Anatomy is correct
[ ] No clothing-body fusion is present
[ ] Outfit continuity is preserved
[ ] Wardrobe-fidelity threshold is reached
[ ] Human approval was completed when required
```

---

# 92. Generation metadata

Each official generated asset should record:

```yaml
character_id: mei
character_sdk_version: 1.0.0
wardrobe_version: 1.0.0
outfit_id: ""
outfit_variant: default
reference_asset_ids: []
provider: ""
model: ""
generation_date: ""
content_type: ""
brand_id: ""
primary_colors: []
garments: []
footwear: ""
accessories: []
jacket_state: ""
sleeve_state: ""
wardrobe_fidelity_score: null
validation_status: draft
approved_by: null
```

---

# 93. Existing look governance

The ten existing approved Mei looks are the initial wardrobe library for SDK v1.0.0.

They must be registered using:

```text
LOOK_001
LOOK_002
LOOK_003
LOOK_004
LOOK_005
LOOK_006
LOOK_007
LOOK_008
LOOK_009
LOOK_010
```

Each identifier must correspond permanently to one existing visual look.

The visual order already used in the asset library must be preserved when assigning these IDs.

No look may be renumbered later merely because a new outfit is inserted.

New looks continue sequentially:

```text
LOOK_011
LOOK_012
LOOK_013
...
```

---

# 94. Existing look registration template

For each existing look, the repository should maintain information equivalent to:

```yaml
outfit_id: LOOK_001
display_name: ""
status: approved
category: []
formality: ""
season: ""
primary_colors: []
garments: []
footwear: ""
accessories: []
approved_contexts: []
restricted_contexts: []
reference_assets: []
controlled_variants: []
notes: ""
```

The reference images remain the visual source of truth.

---

# 95. Locked wardrobe rules

The following rules are locked for Mei SDK v1.0.0:

```text
Modern and professional overall direction
Smart-casual default style
Realistic garment fit
Non-provocative default presentation
No unauthorized logos
No invented text
No anatomy modification
No outfit mutation within a sequence
No automatic promotion of generated outfits
Stable official outfit identifiers
Brand independence
```

---

# 96. Controlled wardrobe elements

The following may vary under controlled conditions:

```text
Outfit
Garment colors
Jacket state
Sleeve state
Footwear
Jewelry
Watch
Bag
Glasses
Seasonal layer
Brand accent
Formality
```

Every variation must remain documented and compatible with Mei’s identity.

---

# 97. Contextual wardrobe elements

The following depend on the production:

```text
Weather protection
Safety equipment
Helmet
Gloves
Scarf
Coat
Travel bag
Microphone attachment
Brand logo
Campaign-specific accessory
Role-specific garment
```

Contextual elements do not become permanent wardrobe characteristics.

---

# 98. Final rule

Mei’s wardrobe is a versioned production system, not an improvised clothing prompt.

The governing rule is:

```text
The outfit may support the scene.
The outfit may support the brand.
The outfit may support the product.

It must never distort Mei,
replace her identity,
or become inconsistent during production.
```
