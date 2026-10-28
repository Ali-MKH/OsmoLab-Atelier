# OsmoLab Atelier Refactor — Stage 2 of 3
## Regulatory Evidence Model + Safety Semantics + Formula/Accord Data Integrity

### How to use this file
Run this stage only **after Stage 1 passes its acceptance criteria**.

Execute **only Stage 2**. Do not begin Stage 3.

### Context-budget rules

1. Do not reread the whole repository.
2. Assume Stage 1 architecture is the baseline.
3. Start with the files listed below and use targeted symbol search.
4. Inspect large React files only around regulatory/formula sections.
5. Apply edits directly; do not paste full rewritten files into chat.
6. Keep the final response concise.
7. Preserve the existing deterministic Formula Engine behavior unless changes are required for the safety model.
8. No inventory/stock/lot/production concepts.

---

# Goal

Make OsmoLab's regulatory and formulation persistence scientifically and structurally trustworthy while preserving its educational nature.

Target principles:

- Regulatory evidence is independent from olfactory description.
- IFRA and EU rules are stored as separate evidence records.
- Unknown is never equivalent to unrestricted.
- Demo/user-entered data is never presented as officially verified.
- Compliance requires verified evidence.
- Formula and Accord versions are reproducible from normalized version items.
- Evaluations/experiments reference immutable version IDs rather than labels.

---

# Primary files to inspect

- `src/db/schema.ts`
- current Drizzle migrations
- `src/db/workspace-repo.ts`
- `src/domain/types.ts`
- `src/domain/safety-engine.ts`
- `src/domain/formula-engine.ts`
- `src/domain/engines.test.ts`
- `src/domain/seed-data.ts` only where compatibility data is still used
- `src/components/DualRegulatorySlider.tsx`
- `src/components/MaterialsAndInventoryView.tsx` only regulatory sections
- `src/components/FormulaLabView.tsx` only safety/regulatory and formula persistence sections
- `server.ts` only affected routes
- `data/catalog/v1.1/regulatory.csv`
- `data/catalog/v1.1/schema.json`
- official-source URLs already stored in the v1.1 dataset

Do not invent new regulatory facts from memory.

---

# Part A — Regulatory evidence model

## 1. Replace the overloaded regulatory row with an evidence-oriented model

Create a structure equivalent to:

### `material_regulatory_records`

```text
id
material_id

jurisdiction
authority

rule_type
status

standard_or_annex
reference_number
product_category

max_finished_product_pct
max_ready_for_use_pct

label_threshold_leave_on_pct
label_threshold_rinse_off_pct

condition_text
summary

source_url
source_document
source_version

verified_at
verification_status

created_at
updated_at
```

Recommended enums / controlled values:

### `authority`
```text
IFRA
EU_COSMETICS
SUPPLIER
USER
```

### `rule_type`
```text
MAX_USE
PROHIBITION
SPECIFICATION
LABEL_THRESHOLD
CONSTITUENT_CONTRIBUTION
INFORMATION
```

### `verification_status`
```text
VERIFIED_OFFICIAL
PARTIALLY_VERIFIED
LOOKUP_REQUIRED
USER_ENTERED_UNVERIFIED
DEMO
```

Do not use a boolean `isDemoData` as the primary trust model.

Existing fields may remain temporarily for migration compatibility but must no longer be the canonical runtime source.

## 2. Preserve source provenance

Every regulatory detail shown as verified must be traceable to a stored source URL/document/version/verification date.

Rules:

- `LOOKUP_REQUIRED` must remain neutral/indeterminate.
- Blank values must never become `100%`.
- `USER_ENTERED_UNVERIFIED` may be used for formulation notes but not authoritative compliance.
- `DEMO` may be used for education but not authoritative compliance.
- ScenTree attribution is catalog provenance; it must not be presented as the regulatory authority unless a specific fact genuinely came from that source.

## 3. Add constituent data

Create a material-constituent structure, for example:

### `material_constituents`

```text
id
material_id
constituent_name
constituent_cas
typical_pct
min_pct
max_pct
source_url
source_document
verification_status
```

This is primarily needed for natural complex substances and allergen contribution calculations.

Supplier analytical data should be able to override a catalog typical value at the user's Shelf level later without changing the global catalog.

Do not build inventory or lot analysis.

---

# Part B — Correct safety/compliance semantics

## 4. Replace boolean compliance with three-state semantics

The public formula-level result should distinguish:

```text
COMPLIANT
NON_COMPLIANT
INDETERMINATE
```

Rules:

- `NON_COMPLIANT`: at least one verified applicable rule is exceeded/prohibited.
- `INDETERMINATE`: no verified violation is known, but one or more applicable ingredients/rules lack sufficient verified evidence.
- `COMPLIANT`: all applicable required checks have sufficient verified evidence and none are violated.

Keep useful secondary counters:
- violations,
- warnings,
- missing/indeterminate evidence,
- allergen declarations.

Do not label "no known violation" as compliant.

## 5. IFRA handling

- IFRA maximum acceptable concentration is evaluated in the finished consumer product.
- Resolve the applicable category record explicitly.
- Never fall back to a different category's numeric limit.
- A missing Category 4 record must produce `INDETERMINATE`, not an inferred number.
- `SPECIFICATION` and `PROHIBITION` must remain distinguishable from numeric `MAX_USE`.

The current direct + nested Accord contribution aggregation is valuable and should be preserved.

## 6. EU Cosmetics handling

Keep the following conceptually separate:

1. EU prohibition,
2. EU maximum ready-for-use / Annex restriction,
3. fragrance allergen labeling threshold,
4. specification/conditions.

Do not represent allergen label threshold as a max-use limit.

## 7. Implement constituent-level allergen aggregation

For every applicable constituent:

```text
constituent contribution =
material concentration in finished product
× constituent percentage in that material
```

Then aggregate the same constituent across all direct materials and nested accords.

Example concept:

```text
Bergamot ─┐
Lemon    ─┼─> total Limonene in finished product
Lavender ─┘
```

Then compare the aggregate to the correct product labeling threshold:

- leave-on threshold field,
- rinse-off threshold field.

Do not hard-code `0.001%` for every workflow.

Use the formula/intended-product context to determine leave-on vs rinse-off where possible. If product classification is ambiguous, return `INDETERMINATE` for the label check and explain why.

## 8. Remove fabricated Material Detail usage values

In Material Detail, do not pass a fake value such as:

```ts
limit * 0.4
```

into a gauge labeled as actual finished-product usage.

Without formula context, show:
- rule/status,
- IFRA limit,
- EU restriction,
- label thresholds,
- source,
- verification state.

The comparative utilization slider is only valid when a real formula concentration is available.

## 9. Correct regulatory wording

Replace wording that implies demo data is "verified".

Use explicit language such as:
- `Educational demonstration data — not verified for compliance`
- `Official source verified`
- `Partially verified`
- `Lookup required`
- `User-entered, unverified`

Keep the safety disclaimer.

---

# Part C — Normalize Formula and Accord version persistence

## 10. Create normalized Formula version items

Create:

### `formula_version_items`

```text
id
formula_version_id
line_order
item_type
material_id
accord_version_id
percentage
quantity_grams
dilution_pct
solvent
notes
created_at
```

Rules:

- `item_type = MATERIAL | ACCORD`
- exactly one of `material_id` / `accord_version_id` should be set based on item type.
- Add appropriate constraints and indexes.
- Do not use material name as identity.
- Preserve historical snapshot behavior.

Existing `items_json` may remain temporarily as a deprecated compatibility column during migration, but new writes should use normalized items after successful cutover.

## 11. Add true Accord versioning

Create:

```text
accords
accord_versions
accord_version_items
```

A Formula version referencing an Accord must reference an immutable `accord_version_id`, not a mutable Accord definition.

This guarantees historical formula reproducibility.

## 12. Replace version-label references

Add `formula_version_id` foreign keys to:
- experiments,
- evaluations,
- any other history record currently depending on `formulaVersionLabel`.

Backfill existing rows from formula + version label.

After successful backfill, runtime reads/writes should use the immutable ID. Labels remain presentation fields only.

## 13. Add integrity constraints

At minimum:

- unique `(formula_id, version_label)`,
- foreign key `parent_version_id -> formula_versions.id`,
- parent version must belong to the same formula (enforce in service/domain if DB constraint is awkward),
- unique Accord version labels within an Accord,
- foreign keys on all normalized item rows,
- useful indexes on `formula_version_id`, `material_id`, `accord_version_id`.

## 14. Make version save atomic

Saving a Formula version must be one transaction:

```text
formula metadata update/create
+ formula version insert/update draft
+ version items replace/insert
+ active version update
+ audit log
```

Committed versions are immutable.

Editing a committed version must create a new version/branch rather than mutate it.

Accord version creation must follow the same atomicity principle.

## 15. Stable API/domain DTO boundary

Keep domain engines independent of Drizzle row objects.

Repository should map normalized rows into existing deterministic engine DTOs:

```text
DB rows -> domain FormulaVersion / FormulaLineItem -> Formula Engine
```

Do not push database concerns into formula math.

---

# Migrations

Use an expand/backfill/cutover approach:

1. Create new tables/columns.
2. Backfill from existing regulatory rows and JSON version items.
3. Validate row counts and referential integrity.
4. Switch runtime reads.
5. Switch runtime writes.
6. Keep deprecated columns only as temporary compatibility if needed.

Do not destroy historical data during this stage.

---

# Acceptance criteria

Stage 2 is complete only when:

1. IFRA and EU rules are represented as distinct regulatory evidence records.
2. Verification status has more than a demo boolean and is used by runtime logic.
3. `LOOKUP_REQUIRED` cannot yield `COMPLIANT`.
4. Demo and user-entered data cannot yield authoritative compliance by themselves.
5. Formula-level safety exposes `COMPLIANT | NON_COMPLIANT | INDETERMINATE`.
6. IFRA uses the actual selected product category and finished-product concentration.
7. EU allergen label checks aggregate constituents across all contributing materials/accords.
8. Leave-on and rinse-off thresholds are distinct.
9. Material Detail contains no fabricated "current usage".
10. Demo regulatory wording no longer says "verified".
11. Formula version items are normalized and queryable.
12. Accord versions are immutable and normalized.
13. Experiments/evaluations reference `formula_version_id`.
14. Formula and Accord version writes are transactional.
15. Committed versions remain immutable.
16. Existing formulas/evaluations survive migration.
17. Typecheck, unit tests, migration validation, and production build pass.

---

# Tests to add/update

At minimum:

### Regulatory
- missing verified IFRA record -> `INDETERMINATE`,
- verified exceed -> `NON_COMPLIANT`,
- all required verified and safe -> `COMPLIANT`,
- demo-only limit does not produce authoritative compliance,
- wrong IFRA category is never used as numeric fallback,
- EU prohibition blocks EU cosmetics workflow,
- EU max-use restriction is separate from allergen label threshold.

### Constituent aggregation
- same allergen from two direct materials is summed,
- allergen from direct material + nested Accord is summed,
- leave-on and rinse-off thresholds produce different outcomes,
- missing constituent percentage produces `INDETERMINATE` rather than zero.

### Version integrity
- committed version cannot be overwritten,
- formula version item rows reconstruct exactly the engine DTO,
- Accord historical version remains unchanged after a later Accord edit,
- evaluation/experiment FK points to correct immutable version,
- duplicate `(formula_id, version_label)` is rejected,
- transaction rollback leaves no partial version on simulated failure.

---

# Do not do in Stage 2

Do not:
- perform broad UI redesign,
- split every large component,
- remove Firebase Auth,
- implement inventory,
- add commerce/purchasing,
- rewrite all PWA code,
- clean every AI Studio artifact.

Those belong to Stage 3 or are explicitly out of scope.

---

# Required final response from the coding agent

Return only:

1. `Completed`
2. New regulatory model summary
3. New Formula/Accord persistence summary
4. Migration/backfill files
5. Main files changed
6. Tests/build results
7. Remaining blockers, if any

Do not paste full source files.
Do not start Stage 3.
