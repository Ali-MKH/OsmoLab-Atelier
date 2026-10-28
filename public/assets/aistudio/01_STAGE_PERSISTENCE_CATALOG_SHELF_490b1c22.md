# OsmoLab Atelier Refactor — Stage 1 of 3
## Persistence Foundation + Global Catalog + My Shelf / Workbench

### How to use this file
Give this file to the coding agent working on the **current `main` branch** of `Ali-MKH/OsmoLab-Atelier`.

Execute **only this stage**. Do not start Stage 2 or Stage 3.

### Context-budget rules
To avoid exhausting the AI Studio context/token limit:

1. Do **not** read or rewrite the entire repository.
2. Start only with the files listed under **Primary files to inspect**.
3. Use targeted searches for symbols before opening additional files.
4. When a file is large, inspect only the relevant ranges/functions.
5. Modify files directly in the repository. Do not paste complete rewritten source files into the chat.
6. Final response must be concise: changed files, migrations, tests/build result, and blockers only.
7. Do not regenerate the UI or rewrite unrelated features.
8. Preserve current Formula Lab, Wheel, Pyramid, Mentor, Evaluation, i18n, and PWA behavior unless a change is explicitly required below.

---

# Goal

Establish a reliable persistence and catalog foundation around this simple product model:

`Global Catalog -> My Shelf -> Current Workbench -> Formula`

Definitions:

- **Global Catalog**: shared reference dictionary of perfumery materials. It is not copied per user.
- **My Shelf**: materials the authenticated user owns or has access to. Persistent account-level data.
- **Current Workbench**: a lightweight subset of My Shelf that the user wants immediately available while composing. It is **not a separate inventory system** and tracks no quantity.
- **Formula**: may normally select from Workbench first, then the rest of My Shelf, with optional access to the entire Catalog.

Important UX rule:
The user must never need to understand database concepts. In the UI this should remain simple:
- Catalog action: `Add to My Shelf`
- My Shelf action: `Pin to Workbench` / `Remove from Workbench`
- Formula picker ordering: `Workbench` -> `My Shelf` -> optionally `Entire Catalog`
- Removing from Workbench must **not** remove from Shelf.
- Removing from Shelf should also clear its Workbench flag.
- No stock, quantity, depletion, lot, purchase, or production-batch concepts.

---

# Primary files to inspect

Inspect these first and only open other files when required:

- `src/db/schema.ts`
- `src/db/index.ts`
- `src/db/workspace-repo.ts`
- `src/db/drizzle.config.ts`
- `server.ts`
- `src/domain/types.ts`
- `src/domain/seed-data.ts`
- `src/App.tsx` — only material/workbench state and API integration areas
- `src/components/MaterialsAndInventoryView.tsx` — only catalog/shelf/workbench areas
- `src/components/FormulaLabView.tsx` — only ingredient-picker/workbench areas
- `.env.example`
- `package.json`
- `public/assets/aistudio/perfumery_app_schema_v1_1_11cad7b7.json`
- `public/assets/aistudio/perfumery_material_catalog_v1_1_3c081720.csv`
- `public/assets/aistudio/perfumery_regulatory_verified_v1_1_1013e75e.csv`
- `public/assets/aistudio/perfumery_starter_sets_v1_1_30be9321.csv`
- `public/assets/aistudio/LICENSE-DATA_perfumery_catalog_v1_1_37e32aeb.txt`

Do not load the 2 MB JSON catalog into chat unless a script genuinely needs it. Prefer the CSV for import.

---

# Required implementation

## 1. Remove silent database-success fallback

Introduce an explicit environment mode:

```text
PERSISTENCE_MODE=postgres
PERSISTENCE_MODE=memory
```

Rules:

- `memory` is allowed only when explicitly selected for local/demo use.
- In `postgres` mode, PostgreSQL errors must never silently fall back to in-memory storage.
- Production must default to or require `postgres`; it must not accidentally enter memory mode.
- Failed writes must return an appropriate non-2xx response.
- Failed account deletion must never return `{ deleted: true }`.
- Keep safe user-facing error messages while logging enough server-side context for diagnosis.
- Do not leak credentials or raw database errors to clients.

The existing in-memory repository may remain for explicit demo/local mode.

## 2. Make database writes atomic where Stage 1 touches them

Use PostgreSQL transactions for:
- first-time user/catalog/shelf initialization where multiple writes must stay consistent,
- Shelf mutations when more than one row/state is affected,
- account-data deletion.

Do not partially report success.

## 3. Convert materials from per-user copies to a shared catalog model

The current architecture copies `SEED_MATERIALS` into every user's `materials` rows. Replace this with shared reference data.

Preferred model:

### `materials`
Keep a single material identity table. It may contain both:
- global catalog materials,
- optional user-created custom materials.

Recommended fields include:

```text
id                       internal numeric PK is acceptable
catalog_key              stable external key such as mat_...
scope                    GLOBAL | USER
owner_uid                nullable; null for GLOBAL, authenticated uid for USER
display_name
material_kind
cas_number
inci_name
created_at
updated_at
```

Security invariant:
A user may read GLOBAL materials and their own USER materials, but never another user's custom material.

Do not use `user_uid` to duplicate the global catalog.

### `material_olfactory_profiles`
Move/reference olfactory descriptors separately from user-owned state.

At minimum persist the v1.1 pyramid metadata:

```text
material_id
primary_family
facets
odor_summary
role_top_heart_base
pyramid_usage
pyramid_primary_zone
pyramid_highlight_top
pyramid_highlight_heart
pyramid_highlight_base
pyramid_ui_code
pyramid_confidence
pyramid_basis
pyramid_note
olfactory_strength
```

Existing useful fields such as substantivity, intensity, diffusion, density, flash point, storage notes, educational notes, complements and contrasts may remain on a compatible reference profile structure if moving them all now would create unnecessary risk.

The critical requirement is that the runtime can consume the v1.1 pyramid fields rather than losing them.

## 4. Implement `user_shelf` as the user-owned relationship

Create a persistent `user_shelf` table.

Recommended minimum shape:

```text
user_uid
material_id
supplier_name
supplier_product_name
working_dilution_pct
personal_notes
is_on_workbench
pyramid_override_code
favorite
added_at
updated_at
```

Use a unique constraint on `(user_uid, material_id)`.

`is_on_workbench` belongs here, not on the global material.

`pyramid_override_code` is optional and must never overwrite the global catalog recommendation.

No quantity fields.

## 5. Import the v1.1 catalog into the runtime database

Move canonical data files out of public runtime assets into a stable repository location, for example:

```text
data/catalog/v1.1/
  materials.csv
  regulatory.csv
  starter-sets.csv
  schema.json
  LICENSE-DATA.md
```

Keep any public copy only if the app truly needs to serve it.

Create a deterministic import/seed script, for example:

```text
scripts/import-catalog-v1_1.ts
```

Requirements:

- Import all 815 catalog materials from the v1.1 CSV.
- Preserve `catalog_key` from the CSV `material_id`.
- Import the v1.1 olfactory/pyramid metadata.
- Import must be idempotent/upsert-safe.
- Do not duplicate the catalog for each user.
- Unknown regulatory values must remain unknown; do not treat blank/LOOKUP_REQUIRED as unrestricted.
- Keep the ScenTree CC BY-NC 4.0 data attribution separate from source-code licensing.
- Existing 18 educational materials/formulas must continue to resolve correctly. Create a stable mapping/backfill instead of relying on old per-user numeric IDs.

## 6. Replace local-only Workbench state with persistent Shelf state

Add authenticated API/repository operations such as:

```text
GET    /api/shelf
POST   /api/shelf/:materialId
PATCH  /api/shelf/:materialId
DELETE /api/shelf/:materialId
```

Exact route naming may differ, but semantics must be explicit.

Support:
- add to Shelf,
- remove from Shelf,
- pin/unpin Workbench,
- edit supplier,
- edit supplier product name,
- edit working dilution,
- edit personal notes,
- edit/remove pyramid override.

Update the UI so the existing Workbench experience remains simple and persistent.

Do not keep a separate React-only source of truth that is lost on refresh.

## 7. Preserve the simple formula-selection UX

In Formula Lab:

1. Workbench materials first.
2. Other My Shelf materials second.
3. Entire Catalog only as an explicit secondary group/toggle.

If a formula contains a material not on My Shelf:
- show `Not on My Shelf`,
- offer `Add to My Shelf`,
- show alternatives already on Shelf where useful.

Do not automatically add Catalog materials to Shelf merely because they are viewed.

## 8. Environment and migrations

- Add all required SQL variables and `PERSISTENCE_MODE` to `.env.example`.
- Generate/commit Drizzle migrations under the configured migration directory.
- Never depend on schema push alone for reproducibility.
- Add the catalog import command to `package.json`, for example `catalog:import`.

---

# Compatibility / migration rules

- Preserve existing user formulas, evaluations, memories and accords.
- Do not delete old material data before successful mapping/backfill.
- If needed, keep deprecated columns for one migration while reads move to the new structure.
- Prefer an expand -> backfill -> switch-read/write -> contract migration sequence.
- Existing formula item references must resolve to the new material identity.
- Existing user `personalNotes` should migrate into `user_shelf.personal_notes`.
- Existing `isOnWorkbench` should migrate into `user_shelf.is_on_workbench`.

---

# Acceptance criteria

Stage 1 is complete only when all of the following are true:

1. PostgreSQL mode never silently falls back to RAM after a DB failure.
2. Account deletion reports failure if DB deletion fails.
3. The global catalog is stored once, not copied for every user.
4. The v1.1 815-material dataset is importable by an idempotent script.
5. Pyramid v1.1 fields are persisted in the runtime data model.
6. My Shelf is persisted per user.
7. Workbench is a simple `is_on_workbench` state inside Shelf.
8. Add/remove Shelf and pin/unpin Workbench survive full page reload and server restart.
9. Personal shelf notes and working dilution survive reload.
10. Formula picker orders Workbench -> Shelf -> Catalog.
11. Existing formulas still open without broken material references.
12. Database migrations are committed.
13. `.env.example` documents the actual required runtime/database variables.
14. Typecheck, current unit tests, and production build pass.

---

# Tests to add or update

At minimum test:

- explicit memory mode works without PostgreSQL,
- postgres mode returns failure instead of RAM fallback,
- catalog import is idempotent,
- two users reference the same GLOBAL catalog material without duplicated material rows,
- user A cannot read/update user B Shelf metadata,
- Workbench pin requires the material to be on that user's Shelf,
- removing from Shelf removes/clears Workbench membership,
- custom USER material is visible only to its owner,
- existing formula material mapping survives migration.

---

# Do not do in Stage 1

Do **not** yet:
- redesign regulatory calculations,
- implement constituent-level EU allergen aggregation,
- normalize formula/accord JSON items,
- split all large React components,
- remove Firestore artifacts,
- introduce a full new design system,
- rewrite Formula Engine.

Those belong to later stages.

---

# Required final response from the coding agent

Return only:

1. `Completed`
2. Short architecture summary
3. Migration files created
4. Main files changed
5. Tests/build commands and results
6. Any blocker that prevents an acceptance criterion from being satisfied

Do not paste full source files.
Do not start Stage 2.
