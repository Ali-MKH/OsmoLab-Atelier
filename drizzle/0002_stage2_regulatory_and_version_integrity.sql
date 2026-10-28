-- Stage 2 Migration: Regulatory Evidence Model, Constituents & Formula/Accord Version Normalization
-- Idempotent expand-and-backfill migration for PostgreSQL

-- 1. Create material_regulatory_records table
CREATE TABLE IF NOT EXISTS "material_regulatory_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_uid" text,
  "material_id" integer NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
  "jurisdiction" text DEFAULT 'GLOBAL' NOT NULL,
  "authority" text DEFAULT 'IFRA' NOT NULL,
  "rule_type" text DEFAULT 'INFORMATION' NOT NULL,
  "status" text DEFAULT 'LOOKUP_REQUIRED' NOT NULL,
  "standard_or_annex" text DEFAULT '' NOT NULL,
  "reference_number" text DEFAULT '' NOT NULL,
  "product_category" text,
  "max_finished_product_pct" double precision,
  "max_ready_for_use_pct" double precision,
  "label_threshold_leave_on_pct" double precision,
  "label_threshold_rinse_off_pct" double precision,
  "condition_text" text DEFAULT '' NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "source_url" text DEFAULT '' NOT NULL,
  "source_document" text DEFAULT '' NOT NULL,
  "source_version" text DEFAULT '' NOT NULL,
  "verified_at" text,
  "verification_status" text DEFAULT 'LOOKUP_REQUIRED' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "material_regulatory_records_material_id_idx"
  ON "material_regulatory_records" ("material_id");
CREATE INDEX IF NOT EXISTS "material_regulatory_records_authority_idx"
  ON "material_regulatory_records" ("material_id", "authority");

-- 2. Create material_constituents table
CREATE TABLE IF NOT EXISTS "material_constituents" (
  "id" serial PRIMARY KEY NOT NULL,
  "material_id" integer NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
  "constituent_name" text NOT NULL,
  "constituent_cas" text DEFAULT '' NOT NULL,
  "typical_pct" double precision,
  "min_pct" double precision,
  "max_pct" double precision,
  "label_threshold_leave_on_pct" double precision DEFAULT 0.001,
  "label_threshold_rinse_off_pct" double precision DEFAULT 0.01,
  "risk_note" text DEFAULT '' NOT NULL,
  "source_url" text DEFAULT '' NOT NULL,
  "source_document" text DEFAULT '' NOT NULL,
  "verification_status" text DEFAULT 'DEMO' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "material_constituents_material_id_idx"
  ON "material_constituents" ("material_id");
CREATE INDEX IF NOT EXISTS "material_constituents_cas_idx"
  ON "material_constituents" ("constituent_cas");

-- 3. Add active_version_label to accords and create accord_versions & accord_version_items
ALTER TABLE "accords" ADD COLUMN IF NOT EXISTS "active_version_label" text DEFAULT 'V1' NOT NULL;

CREATE TABLE IF NOT EXISTS "accord_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_uid" text NOT NULL,
  "accord_id" integer NOT NULL REFERENCES "accords"("id") ON DELETE CASCADE,
  "version_label" text NOT NULL,
  "status" text DEFAULT 'Committed' NOT NULL,
  "version_notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "accord_versions_accord_id_version_label_idx"
  ON "accord_versions" ("accord_id", "version_label");
CREATE INDEX IF NOT EXISTS "accord_versions_accord_id_idx"
  ON "accord_versions" ("accord_id");

CREATE TABLE IF NOT EXISTS "accord_version_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "accord_version_id" integer NOT NULL REFERENCES "accord_versions"("id") ON DELETE CASCADE,
  "line_order" integer DEFAULT 0 NOT NULL,
  "material_id" integer NOT NULL REFERENCES "materials"("id") ON DELETE RESTRICT,
  "material_name" text DEFAULT '' NOT NULL,
  "percentage" double precision NOT NULL,
  "dilution_pct" double precision DEFAULT 100 NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "accord_version_items_accord_version_id_idx"
  ON "accord_version_items" ("accord_version_id");
CREATE INDEX IF NOT EXISTS "accord_version_items_material_id_idx"
  ON "accord_version_items" ("material_id");

-- 4. Add uniqueness and parent FK on formula_versions, and create formula_version_items
CREATE UNIQUE INDEX IF NOT EXISTS "formula_versions_formula_id_version_label_idx"
  ON "formula_versions" ("formula_id", "version_label");
CREATE INDEX IF NOT EXISTS "formula_versions_formula_id_idx"
  ON "formula_versions" ("formula_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formula_versions_parent_version_id_fkey'
  ) THEN
    ALTER TABLE "formula_versions"
      ADD CONSTRAINT "formula_versions_parent_version_id_fkey"
      FOREIGN KEY ("parent_version_id") REFERENCES "formula_versions"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "formula_version_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "formula_version_id" integer NOT NULL REFERENCES "formula_versions"("id") ON DELETE CASCADE,
  "line_order" integer DEFAULT 0 NOT NULL,
  "item_type" text DEFAULT 'MATERIAL' NOT NULL,
  "material_id" integer REFERENCES "materials"("id") ON DELETE RESTRICT,
  "accord_id" integer REFERENCES "accords"("id") ON DELETE RESTRICT,
  "accord_version_id" integer REFERENCES "accord_versions"("id") ON DELETE RESTRICT,
  "name" text DEFAULT '' NOT NULL,
  "percentage" double precision NOT NULL,
  "quantity_grams" double precision NOT NULL,
  "dilution_pct" double precision DEFAULT 100 NOT NULL,
  "solvent" text DEFAULT 'Neat' NOT NULL,
  "active_material_pct" double precision DEFAULT 0 NOT NULL,
  "supplier" text DEFAULT '' NOT NULL,
  "cost_per_gram" double precision DEFAULT 0.35 NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "formula_version_items_formula_version_id_idx"
  ON "formula_version_items" ("formula_version_id");
CREATE INDEX IF NOT EXISTS "formula_version_items_material_id_idx"
  ON "formula_version_items" ("material_id");
CREATE INDEX IF NOT EXISTS "formula_version_items_accord_version_id_idx"
  ON "formula_version_items" ("accord_version_id");

-- 5. Add formula_version_id FKs to experiments, evaluations, and material_usage_reviews
ALTER TABLE "experiments"
  ADD COLUMN IF NOT EXISTS "formula_version_id" integer REFERENCES "formula_versions"("id") ON DELETE CASCADE;
ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "formula_version_id" integer REFERENCES "formula_versions"("id") ON DELETE CASCADE;
ALTER TABLE "material_usage_reviews"
  ADD COLUMN IF NOT EXISTS "formula_version_id" integer REFERENCES "formula_versions"("id") ON DELETE CASCADE;

-- 6. Backfill material_regulatory_records from material_regulatory_limits (IFRA & EU_COSMETICS records)
INSERT INTO "material_regulatory_records" (
  "user_uid",
  "material_id",
  "jurisdiction",
  "authority",
  "rule_type",
  "status",
  "standard_or_annex",
  "reference_number",
  "product_category",
  "max_finished_product_pct",
  "summary",
  "source_url",
  "source_document",
  "source_version",
  "verified_at",
  "verification_status"
)
SELECT
  mrl."user_uid",
  mrl."material_id",
  'GLOBAL',
  'IFRA',
  CASE
    WHEN mrl."ifra_standard_type" = 'PROHIBITION' THEN 'PROHIBITION'
    WHEN mrl."ifra_standard_type" = 'SPECIFICATION' THEN 'SPECIFICATION'
    WHEN mrl."max_allowed_percent" IS NOT NULL THEN 'MAX_USE'
    ELSE 'INFORMATION'
  END,
  COALESCE(NULLIF(mrl."ifra_standard_status", ''), 'LOOKUP_REQUIRED'),
  COALESCE(NULLIF(mrl."ifra_baseline", ''), 'IFRA_51'),
  COALESCE(mrl."ifra_amendment", ''),
  'Cat 4',
  mrl."max_allowed_percent",
  COALESCE(NULLIF(mrl."ifra_summary", ''), mrl."restrictions", ''),
  COALESCE(mrl."regulatory_sources", ''),
  COALESCE(mrl."source_document", ''),
  COALESCE(mrl."document_version", ''),
  NULLIF(mrl."last_verified_date", ''),
  CASE
    WHEN mrl."regulatory_data_status" = 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES' THEN 'PARTIALLY_VERIFIED'
    WHEN mrl."user_uid" IS NOT NULL THEN 'USER_ENTERED_UNVERIFIED'
    WHEN mrl."is_demo_data" = TRUE THEN 'DEMO'
    ELSE 'LOOKUP_REQUIRED'
  END
FROM "material_regulatory_limits" mrl
WHERE NOT EXISTS (
  SELECT 1 FROM "material_regulatory_records" mrr
  WHERE mrr."material_id" = mrl."material_id" AND mrr."authority" = 'IFRA'
);

INSERT INTO "material_regulatory_records" (
  "user_uid",
  "material_id",
  "jurisdiction",
  "authority",
  "rule_type",
  "status",
  "standard_or_annex",
  "reference_number",
  "product_category",
  "max_ready_for_use_pct",
  "label_threshold_leave_on_pct",
  "label_threshold_rinse_off_pct",
  "summary",
  "source_url",
  "source_document",
  "source_version",
  "verified_at",
  "verification_status"
)
SELECT
  mrl."user_uid",
  mrl."material_id",
  'EU',
  'EU_COSMETICS',
  CASE
    WHEN mrl."eu_cosmetics_status" = 'PROHIBITED' OR mrl."eu_annex" = 'II' THEN 'PROHIBITION'
    WHEN mrl."eu_max_ready_for_use_pct" IS NOT NULL THEN 'MAX_USE'
    WHEN mrl."eu_label_threshold_leave_on_pct" IS NOT NULL THEN 'LABEL_THRESHOLD'
    ELSE 'INFORMATION'
  END,
  COALESCE(NULLIF(mrl."eu_cosmetics_status", ''), 'LOOKUP_REQUIRED'),
  CASE
    WHEN mrl."eu_annex" <> '' THEN 'ANNEX_' || mrl."eu_annex"
    ELSE 'EU_1223_2009'
  END,
  COALESCE(mrl."eu_reference_no", ''),
  NULL,
  mrl."eu_max_ready_for_use_pct",
  mrl."eu_label_threshold_leave_on_pct",
  mrl."eu_label_threshold_rinse_off_pct",
  COALESCE(mrl."eu_summary", ''),
  COALESCE(mrl."regulatory_sources", ''),
  COALESCE(mrl."source_document", ''),
  'EC 1223/2009 / 2023/1545',
  NULLIF(mrl."last_verified_date", ''),
  CASE
    WHEN mrl."regulatory_data_status" = 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES' THEN 'PARTIALLY_VERIFIED'
    WHEN mrl."user_uid" IS NOT NULL THEN 'USER_ENTERED_UNVERIFIED'
    WHEN mrl."is_demo_data" = TRUE THEN 'DEMO'
    ELSE 'LOOKUP_REQUIRED'
  END
FROM "material_regulatory_limits" mrl
WHERE NOT EXISTS (
  SELECT 1 FROM "material_regulatory_records" mrr
  WHERE mrr."material_id" = mrl."material_id" AND mrr."authority" = 'EU_COSMETICS'
);

-- 7. Backfill accord_versions from accords where missing
INSERT INTO "accord_versions" ("user_uid", "accord_id", "version_label", "status", "version_notes")
SELECT
  a."user_uid",
  a."id",
  COALESCE(NULLIF(a."active_version_label", ''), 'V1'),
  'Committed',
  COALESCE(a."notes", 'Initial accord version')
FROM "accords" a
WHERE NOT EXISTS (
  SELECT 1 FROM "accord_versions" av WHERE av."accord_id" = a."id"
);

-- 8. Backfill formula_version_id on experiments, evaluations, and material_usage_reviews
UPDATE "experiments" e
SET "formula_version_id" = fv."id"
FROM "formula_versions" fv
WHERE e."formula_id" = fv."formula_id"
  AND e."formula_version_label" = fv."version_label"
  AND e."formula_version_id" IS NULL;

UPDATE "evaluations" ev
SET "formula_version_id" = fv."id"
FROM "formula_versions" fv
WHERE ev."formula_id" = fv."formula_id"
  AND ev."formula_version_label" = fv."version_label"
  AND ev."formula_version_id" IS NULL;

UPDATE "material_usage_reviews" mur
SET "formula_version_id" = fv."id"
FROM "formula_versions" fv
WHERE mur."formula_id" = fv."formula_id"
  AND mur."version_label" = fv."version_label"
  AND mur."formula_version_id" IS NULL;
