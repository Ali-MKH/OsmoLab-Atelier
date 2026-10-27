# Perfumery Material Catalog v1.1

Generated: 2026-10-26

## What is included
- 815 material names seeded from ScenTree's current ingredient list (261 rows under its Naturals section + 554 under its Synthetics section).
- A curated olfactory subset for common training/formulation materials.
- A deliberately small **officially verified starter subset** of IFRA/EU regulatory records.
- Unknown regulatory values are marked `LOOKUP_REQUIRED`; they are never treated as unrestricted.

## Recommended app model
`Catalog -> My Shelf -> Formula`

`My Shelf` should only represent materials the user owns/has access to. It does **not** track quantity, inventory depletion, or production batches. Optional user fields can include supplier, product name, dilution, and notes.

## Import to Google AI Studio
Best file for AI ingestion: `perfumery_material_catalog_ai_studio_v1.jsonl`.
For tabular/database import use `perfumery_material_catalog_v1.csv` or the XLSX workbook.

## Regulatory model
### IFRA
- Baseline in this dataset: 51st Amendment.
- As of 2026-10-26, the 52nd Amendment final Notification is expected in January 2027 and should be treated as pending/proposed until notified.
- Category 4 is the key category for fine fragrance.
- IFRA maximum acceptable concentrations are stated in the **finished consumer product**.
- `LOOKUP_REQUIRED` does not mean unrestricted.

### EU Cosmetics
- Legal basis: Regulation (EC) No 1223/2009 and its current amendments.
- Annex II = prohibited substances; Annex III = restricted substances/conditions.
- Fragrance allergen label thresholds are separate from maximum-use limits.
- General individual-label trigger for listed fragrance allergens: >0.001% in leave-on products and >0.01% in rinse-off products, subject to the applicable Annex III entry.
- CosIng is useful as an information/search interface but the legally binding source is the Regulation and its Annexes.

## Licensing
ScenTree describes its work under CC BY-NC 4.0. Keep the dataset license separate from your app source-code license. If your code is MIT/Apache, place catalog data in a separate `/data` directory with attribution and `LICENSE-DATA.md`.

Source: https://www.scentree.co/en/discover_scentree.html
License: https://creativecommons.org/licenses/by-nc/4.0/

## Important limitation
This is a structured starter catalog, **not a complete safety database**. Regulatory data changes and may depend on material identity, isomer, natural-complex composition, product category, concentration, purity, and supplier specification. Before real-world use, verify current IFRA standards/certificates, EU Annexes, supplier SDS/specification, and a qualified product safety assessment.


## Olfactory pyramid metadata (v1.1)
Each material has structured suggested Top / Heart / Base placement for UI highlighting. Multi-zone materials may use Top–Heart or Heart–Base. The dataset includes explicit top/heart/base booleans, a compact UI code, confidence, inference basis and a contextual-use disclaimer. Functional carriers/solvents use `NONE`. This is formulation guidance, not an absolute physical or regulatory classification.
