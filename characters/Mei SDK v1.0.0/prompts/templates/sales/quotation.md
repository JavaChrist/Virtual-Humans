# Quotation Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: sales
> Status: stable

---

## EN

### Purpose
Generate a clear price quotation.

### Variables
- `{{character}}` — the character identity reference.
- `{{client}}` — the client.
- `{{items}}` — line items and quantities.
- `{{pricing}}` — unit prices and totals.
- `{{validity}}` — validity period and conditions.

### Prompt Template
```text
Quotation by {{character}} for {{client}}.
List {{items}} with {{pricing}}, subtotal, taxes and total, plus {{validity}} and payment terms.
Transparent, itemized, no hidden costs.
```

### Output Structure
- Itemized lines with prices.
- Subtotal, taxes, total.
- Validity and payment terms.

### Rules
- Must not redefine the Virtual Human identity.
- Prices and terms must be accurate and complete.
- Comply with the core sales and legal standards.

---

## FR

### Objectif
Générer un devis clair.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{client}}` — le client.
- `{{items}}` — lignes et quantités.
- `{{pricing}}` — prix unitaires et totaux.
- `{{validity}}` — durée de validité et conditions.

### Modèle de prompt
```text
Devis de {{character}} pour {{client}}.
Lister {{items}} avec {{pricing}}, sous-total, taxes et total, ainsi que {{validity}} et conditions de paiement.
Transparent, détaillé, sans coûts cachés.
```

### Structure de sortie
- Lignes détaillées avec prix.
- Sous-total, taxes, total.
- Validité et conditions de paiement.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les prix et conditions doivent être exacts et complets.
- Respecter les standards ventes et légaux de `core/`.
