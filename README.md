# OsmoLab — Perfumery Formulation & Olfactory Platform

A production-ready, cross-platform perfumery formulation laboratory, raw material encyclopedia, lot-based inventory manager, version-controlled formula engine, interactive olfactory wheel, scent-memory trainer, physical production batch calculator, IFRA safety evaluator, and context-aware AI olfactory mentor.

---

## 1. System & Domain Architecture

### Layered Clean Architecture
- **Domain Engine Layer (`/src/domain/`)**:
  - `formula-engine.ts`: Micro-unit (`10^6`) integer-scaled decimal math engine. Calculates 100% weight normalization, arbitrary batch scaling (`10g` to `1kg`), active material vs. carrier solvent weights for dilutions (e.g., `Oakmoss Absolute 10% in DPG`), recursive nested accord expansion, circular dependency detection, and line-by-line version diffing.
  - `safety-engine.ts`: Evaluates IFRA Category 4 (Fine Fragrance) limits strictly against stored regulatory records. Never fabricates missing data—returns `"Safety information unavailable. Manual verification required."` whenever a material lacks a stored regulatory record.
  - `inventory-engine.ts`: Evaluates real lot-based inventory availability against scaled formula batches, flagging shortages before physical weighing (e.g., catching the 5.600g shortage on a 500g batch of `Forest Study V5` for `Oakmoss Absolute 10%`), and computes physical bench weighing deviations (`±0.001g`).
- **Persistence & API Layer (`/server.ts`, `/src/db/`)**:
  - Express + Vite full-stack server with Drizzle ORM connected to Cloud SQL for PostgreSQL.
  - Row-level user isolation (`user_uid`) across 16 normalized PostgreSQL tables (`users`, `suppliers`, `materials`, `material_regulatory_limits`, `scent_memories`, `inventory_lots`, `inventory_movements`, `accords`, `projects`, `formulas`, `formula_versions`, `batches`, `experiments`, `evaluations`, `material_usage_reviews`, `audit_logs`).
  - Automatic educational starter seeding on first workspace initialization.
- **Presentation Layer (`/src/components/`, `/src/App.tsx`)**:
  - **Botanical Atelier & Precision Apothecary** aesthetic (`#F6F3EC` Alabaster Parchment, `#1C1917` Deep Charcoal Ink, `#B45309` Warm Amber Gold, `Cormorant Garamond` display typography, `Plus Jakarta Sans` UI body, and `JetBrains Mono` with `font-variant-numeric: tabular-nums` for aligned decimal columns).

---

## 2. Database Schema & Migrations

Defined in `/src/db/schema.ts` and managed via `/src/db/drizzle.config.ts`:
- `users`: Authenticated user profiles (`uid`, `email`, `display_name`).
- `suppliers`: Raw material vendors, origin regions, and reliability ratings.
- `materials`: Complete raw material catalog (`cas_number`, `inci_name`, `fema_number`, `note_role`, `primary_family`, `secondary_families`, `vapor_pressure`, `substantivity_hours`, `tenacity_score`, `impact_score`, `recommended_usage_min/max`, `is_dilution`, `stock_concentration_pct`, `solvent_material_id`).
- `material_regulatory_limits`: Stored IFRA Category 4 limits, restriction types (`RESTRICTION`, `SPECIFICATION`, `PROHIBITION`), and allergen/phototoxicity flags.
- `inventory_lots` & `inventory_movements`: Lot-tracked stock weights, purity percentages, dilution percentages, storage locations, expiry dates, and immutable movement ledgers.
- `accords`: Reusable sub-formulas with JSONB line items that expand recursively inside main formulas.
- `projects`, `formulas`, & `formula_versions`: Immutable version snapshots (`V1`, `V4`, `V5`, `V5A`) with full parent lineage, concentration types (`EDT`, `EDP`, `Extrait`), and maturation targets.
- `batches`, `experiments`, `evaluations`, `scent_memories`, `material_usage_reviews`, & `audit_logs`: Full laboratory traceability from trial hypothesis to blind strip evaluation and audit logging.

---

## 3. Setup & Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Copy `.env.example` to `.env` and ensure `GEMINI_API_KEY` and Cloud SQL connection environment variables are configured.
3. **Run Unit Tests**:
   ```bash
   npx --yes tsx --test src/domain/engines.test.ts
   ```
4. **Start Full-Stack Server**:
   ```bash
   npm run dev
   ```
   The Express + Vite server listens on `http://localhost:3000`.

---

## 4. Security Notes

- **Row-Level Isolation**: Every query and mutation in `WorkspaceRepository` scopes data by the verified `userUid`.
- **No Fabricated Safety Claims**: Both the deterministic `evaluateFormulaSafety` engine and the `/api/mentor/analyze` AI system prompt strictly prohibit inventing IFRA percentages, CAS numbers, or toxicology values when database records are absent.
- **Immutable Snapshots**: Formula versions (`V1`, `V4`, `V5`) are locked once snapshotted; edits create new versions or experimental branches (`V5A`) with recorded audit logs.

---

## 5. Google Play / PWA Release-Readiness Checklist

- [x] **Web App Manifest (`/manifest.webmanifest`)**: Configured with `standalone` display, `#F6F3EC` theme color, and 192x192 / 512x512 maskable icons.
- [x] **Service Worker (`vite-plugin-pwa`)**: Precaches static application shell and assets with `autoUpdate` registration.
- [x] **Responsive Adaptive Shell**: Desktop 15-section rail + 3-column workbench, tablet collapsible rail, and mobile bottom navigation bar (`390x844` verified).
- [x] **Target SDK & TWA Readiness**: Ready for Trusted Web Activity (TWA / Bubblewrap) packaging targeting Android API 34+ with hardware-accelerated SVG olfactory wheel and offline local workspace fallback.
