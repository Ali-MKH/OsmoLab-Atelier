# OsmoLab — Perfumery Formulation, Olfactory Architecture & IFRA 51 Studio

OsmoLab is a full-stack perfumery formulation workbench, 815-material olfactory encyclopedia, and deterministic IFRA 51 / EU Cosmetics Regulation (EC 1223/2009 & 2023/1545) compliance studio.

---

## 1. Architecture Overview

```text
Firebase Auth (Google OAuth)
  -> Verified Firebase ID Token (verifyIdToken(token, true) with checkRevoked: true)
  -> Express API (Schema-validated bounded endpoints in server.ts)
  -> Drizzle ORM / PostgreSQL (Authoritative relational persistence)
```

- **Authentication**: Client-side Firebase Authentication issues an ID token sent via `Authorization: Bearer <idToken>`. The Express middleware (`src/middleware/auth.ts`) cryptographically verifies the token with `checkRevoked: true` and enforces `email_verified !== false`.
- **Single Persistence Engine**: All application state is persisted in PostgreSQL (`src/db/schema.ts`, `src/db/workspace-repo.ts`). Unused Firestore runtime code and legacy rules have been removed.
- **Modular Frontend**: Feature-oriented modules under `src/features/` (`catalog/`, `formula/`, `accords/`, `regulatory/`, `evaluation/`, `scent-memory/`, `mentor/`) backed by a typed API client (`src/api/client.ts`) and runtime boundary validators (`src/api/validation.ts`).

---

## 2. Persistence Modes (`postgres` vs `memory`)

OsmoLab supports two explicit persistence modes via the `PERSISTENCE_MODE` environment variable:

| Mode | Environment Setting | Behavior |
| :--- | :--- | :--- |
| **PostgreSQL (Production Default)** | `PERSISTENCE_MODE=postgres` | Connects to PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`). Fails fast on startup if `NODE_ENV=production` and PostgreSQL is unreachable—never silently falls back to volatile memory in production. |
| **In-Memory Store (Local / CI Test)** | `PERSISTENCE_MODE=memory` | Uses an isolated, deterministic in-memory relational store seeded with the canonical 815-material v1.1 catalog. Ideal for offline evaluation, unit tests, and GitHub Actions CI. |

Check runtime persistence health at any time via `GET /api/health`.

---

## 3. Canonical v1.1 Catalog Data & Import

Canonical perfumery data is stored as versioned, human-auditable CSV/JSON files in `data/catalog/v1.1/`:

- `data/catalog/v1.1/materials.csv` — **815** perfumery raw materials with v1.1 pyramid metadata (`pyramid_ui_code`, `pyramid_highlight_top/heart/base`, `pyramid_confidence`, `pyramid_basis`).
- `data/catalog/v1.1/regulatory.csv` — **34** structured IFRA 51st Amendment and EU 1223/2009 / 2023/1545 regulatory records.
- `data/catalog/v1.1/starter-sets.csv` — **66** starter organ kit mappings (`BEGINNER_20`, `ACCORD_BUILDER_40`, `CLASSIC_ATELIER_80`).
- `data/catalog/v1.1/schema.json` — JSON Schema contract for all canonical columns and enums.
- `data/catalog/v1.1/manifest.json` — Version `1.1.0` manifest with SHA-256 checksums, byte sizes, row counts, and license attribution.

To validate and import the canonical v1.1 catalog into PostgreSQL (or verify in-memory import):

```bash
npm run catalog:import
```

---

## 4. Perfumer Organ Hierarchy: Global Catalog → My Shelf → Current Workbench → Formula

OsmoLab separates shared encyclopedia data from personal studio data without complex warehouse/ERP stock tracking:

1. **Global Catalog (`Catalog`)**: Shared 815-material reference dictionary (`scope = 'GLOBAL'`) plus any user-created custom materials (`scope = 'USER'`).
2. **My Shelf (`user_shelf_items`)**: Materials the user owns, studies, or works with. Stores personal metadata (`supplierName`, `supplierProductName`, `workingDilutionPct`, `personalNotes`, and optional personal `pyramidOverrideCode`).
3. **Current Workbench (`isOnWorkbench = true`)**: A lightweight boolean filter on `My Shelf` representing the active subset of ingredients pinned to the perfumer's bench for the current study.
   - Pinning a material to `Current Workbench` automatically ensures it is on `My Shelf`.
   - Unpinning from `Current Workbench` keeps the material on `My Shelf`.
   - Removing from `My Shelf` clears `Current Workbench` membership.
4. **Formula Lab Ingredient Picker**: Lets the perfumer switch cleanly between `Current Workbench`, `My Shelf`, and `Entire Catalog` (gracefully defaulting to `My Shelf` when `Current Workbench` is empty).

---

## 5. Regulatory Status Definitions & Compliance Disclaimer

Every material and formula calculation distinguishes four explicit regulatory verification states:

| Status Code | Meaning |
| :--- | :--- |
| `VERIFIED_OFFICIAL` | Verified against an official IFRA 51st Amendment standard or EU Cosmetics Regulation Annex III entry with source citation. |
| `PARTIALLY_VERIFIED` | Quantitative limit recorded from reference documentation; confirm category-specific rules and supplier Certificate of Analysis (CoA). |
| `USER_ENTERED_UNVERIFIED` | Custom regulatory limit entered by a user (`USER_CUSTOM`); not verified against official IFRA/EU dossiers. |
| `LOOKUP_REQUIRED` | No quantitative safety limit is recorded in the local database. **Unlisted materials are never inferred as safe or compliant.** |

### Deterministic Finished-Product Math
- **Dilution Handling**: `neatMaterialGrams = lineItemGrams * (dilutionPercent / 100)`.
- **Accord Expansion**: Accords are recursively expanded into their constituent raw materials and aggregated by CAS number and IFRA restriction group before checking category limits.
- **Finished Consumer Product Exposure**: Evaluated against `finalProductConcentration` (e.g., 20% concentrate in ethanol for Category 4 Fine Fragrance) as well as relative concentrate %.

> **Important Compliance Notice**: OsmoLab is a formulation and educational software studio. Always verify commercial batches against the supplier's official Safety Data Sheet (SDS), Certificate of Analysis (CoA), and IFRA 51st Amendment Conformity Certificate prior to dermal compounding or commercial release.

---

## 6. Local Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Validate & import canonical v1.1 catalog
PERSISTENCE_MODE=memory npm run catalog:import

# 4. Start development server (Express API + Vite on port 3000)
PERSISTENCE_MODE=memory npm run dev
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the full-stack Express + Vite server on `http://localhost:3000` |
| `npm run catalog:import` | Validates and imports `data/catalog/v1.1/*.csv` |
| `npm run typecheck` | Runs strict TypeScript compiler checks (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint architectural & source code checks (`eslint .`) |
| `npm test` | Runs the Node.js unit & integration test suite (`src/domain/*.test.ts`) |
| `npm run build` | Builds the production frontend bundle (`dist/`) |

---

## 7. Testing & CI

Automated tests cover:
- Persistence mode fail-fast behavior and user isolation (`stage1-persistence-shelf.test.ts`)
- Formula math, dilution scaling, accord expansion, IFRA/EU compliance engine, and `LOOKUP_REQUIRED` truthfulness (`stage2-regulatory-formula.test.ts`, `formula-engine.test.ts`)
- Auth token verification & revocation policy (`checkRevoked: true`), runtime schema validation, standardized error contracts, bounded catalog queries, and v1.1 pyramid metadata (`stage3-api-ux-pyramid.test.ts`)

GitHub Actions CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run catalog:import`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` on every pull request and push to `main`.

---

## 8. Data Attribution & License

- **Olfactory Taxonomy & Material Classification Reference**: Adapted from **ScenTree — The Collaborative Perfumery Raw Materials Classification** under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** license.
- **Regulatory Reference Standards**: IFRA 51st Amendment Standards Library and European Cosmetics Regulation (EC) No 1223/2009 / Commission Regulation (EU) 2023/1545.
