# Google AI Studio integration instructions

Use `perfumery_material_catalog_ai_studio_v1_1.jsonl` as the canonical seed catalog.

## Required product simplification
Remove all inventory-quantity, stock-depletion and production-batch concepts. The product model is strictly:

`Catalog -> My Shelf -> Formula`

- **Catalog**: global material dictionary.
- **My Shelf**: user-selected materials they own or can use. No quantity tracking. Optional fields: supplier, supplier product name, dilution/concentration, personal note.
- **Formula**: by default choose ingredients from My Shelf. If the mentor recommends a missing material, show `Not on My Shelf` and offer `Add to Shelf` / `Find alternatives on My Shelf`.

## Regulatory behavior
1. Never infer that a material is safe because no limit is present. `LOOKUP_REQUIRED` is an explicit state.
2. IFRA Category 4 values are percentages in the **finished consumer product**, not simply the fragrance concentrate.
3. Show IFRA status, standard type, amendment, Category 4 limit, source, verification date and short explanation separately.
4. Show EU Cosmetics status separately: prohibited/restricted/labeling/lookup required.
5. EU allergen labeling thresholds (0.001% leave-on; 0.01% rinse-off for applicable listed allergens) are **not** maximum-use limits.
6. If EU Annex III has a maximum concentration, show a separate `EU Max ready-for-use %` field.
7. EU-prohibited materials must display a strong blocking warning for an EU-cosmetics workflow.
8. For natural complex substances, explain that restricted constituents can contribute to IFRA limits and supplier analytical data/specification may be needed.
9. Cite official source links in every regulatory detail view.
10. The catalog dataset and app source code have separate licensing. Preserve ScenTree attribution/CC BY-NC 4.0 metadata.

## Suggested material detail UI
Tabs/sections:
- Overview
- Olfactory Profile
- My Notes / Scent Memory
- Used In Formulas
- Safety & Regulatory
- Sources

Safety & Regulatory should show a status banner and then two independent cards: `IFRA` and `EU Cosmetics`.

## Shelf experience
Catalog row/card actions:
- Add to My Shelf
- Remove from My Shelf
- View Details
- Similar Materials

Formula material picker:
- default filter: My Shelf
- toggle: Entire Catalog
- missing recommended material: `Not on My Shelf`
- action: `Show alternatives I own`

## Facet-based sourcing
Use `perfumery_starter_sets_v1.csv` to suggest missing materials by olfactory facet. Do not interpret “sourcing” as stock purchasing automation; it means recommending which material would broaden the user's palette.


## Olfactory pyramid / note-position UI
Every material now contains a structured `classification.pyramid` object. Use it directly; do not infer pyramid position from free text at render time.

Required icon behavior:
- `ui_code: T` -> highlight Top only.
- `H` -> highlight Heart only.
- `B` -> highlight Base only.
- `TH` -> highlight Top + Heart.
- `HB` -> highlight Heart + Base.
- `THB` -> highlight all three.
- `NONE` -> no olfactory pyramid highlight; display as Functional/Carrier.

The material list/card should show a compact three-level pyramid icon beside the note/material name. Highlight the corresponding pyramid segment(s). The material detail view should also state the text label, e.g. `Suggested use: Top–Heart`.

Use `pyramid_confidence` in the UI:
- `high`: normal highlight.
- `medium`: normal highlight plus “Suggested” tooltip.
- `low`: softer/dotted highlight plus “Suggested placement — verify by smelling/material documentation”.

Important: pyramid placement is not a regulatory property and is not absolute. It can change with dosage, dilution, base, formulation and supplier specification. Users may override the global suggestion in their personal material profile/My Shelf metadata; do not overwrite the master catalog.
