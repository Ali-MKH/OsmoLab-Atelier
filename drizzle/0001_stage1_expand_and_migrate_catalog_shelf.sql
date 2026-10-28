-- Stage 1 Expand-and-Migrate SQL for Global Catalog + Material Olfactory Profiles + User Shelf
-- Safe to run against both fresh and existing databases without dropping tables or losing user formulas/accords.

ALTER TABLE "materials" ALTER COLUMN "user_uid" DROP NOT NULL;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "catalog_key" text UNIQUE;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "owner_uid" text;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "display_name" text NOT NULL DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "material_kind" text NOT NULL DEFAULT 'SYNTHETIC';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "source_section" text DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "catalog_source" text DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "catalog_source_url" text DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "source_license" text DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "source_license_url" text DEFAULT '';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "starter_priority" text DEFAULT 'OPTIONAL';
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "my_shelf_default" boolean NOT NULL DEFAULT false;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "shelf_status_default" text NOT NULL DEFAULT 'NOT_ON_SHELF';

CREATE TABLE IF NOT EXISTS "material_olfactory_profiles" (
  "material_id" integer PRIMARY KEY REFERENCES "materials"("id") ON DELETE CASCADE,
  "primary_family" text NOT NULL DEFAULT 'Woody',
  "facets" text DEFAULT '',
  "odor_summary" text DEFAULT '',
  "role_top_heart_base" text DEFAULT '',
  "pyramid_usage" text NOT NULL DEFAULT 'UNSPECIFIED',
  "pyramid_primary_zone" text NOT NULL DEFAULT 'UNSPECIFIED',
  "pyramid_highlight_top" boolean NOT NULL DEFAULT false,
  "pyramid_highlight_heart" boolean NOT NULL DEFAULT false,
  "pyramid_highlight_base" boolean NOT NULL DEFAULT false,
  "pyramid_ui_code" text NOT NULL DEFAULT 'NA',
  "pyramid_confidence" text NOT NULL DEFAULT 'UNKNOWN',
  "pyramid_basis" text NOT NULL DEFAULT 'UNSPECIFIED',
  "pyramid_note" text DEFAULT '',
  "olfactory_strength" text NOT NULL DEFAULT 'MEDIUM',
  "intensity" integer DEFAULT 7,
  "substantivity_hours" integer DEFAULT 24,
  "diffusion" integer DEFAULT 7,
  "volatility" text NOT NULL DEFAULT 'Heart',
  "descriptive_notes" text DEFAULT '',
  "texture" text DEFAULT '',
  "temperature_impression" text DEFAULT 'Neutral',
  "educational_observe" text DEFAULT '',
  "complements" text DEFAULT '',
  "contrasts" text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "user_shelf" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_uid" text NOT NULL,
  "material_id" integer NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
  "supplier_name" text NOT NULL DEFAULT '',
  "supplier_product_name" text NOT NULL DEFAULT '',
  "working_dilution_pct" double precision,
  "personal_notes" text NOT NULL DEFAULT '',
  "is_on_workbench" boolean NOT NULL DEFAULT false,
  "pyramid_override_code" text,
  "favorite" boolean NOT NULL DEFAULT false,
  "added_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_shelf_user_uid_material_id_idx"
  ON "user_shelf" ("user_uid", "material_id");

ALTER TABLE "material_regulatory_limits" ALTER COLUMN "user_uid" DROP NOT NULL;
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_baseline" text DEFAULT 'IFRA_51';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_standard_status" text DEFAULT 'LOOKUP_REQUIRED';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_standard_type" text DEFAULT 'LOOKUP_REQUIRED';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_amendment" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_cat4_max_pct" double precision;
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "ifra_summary" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_cosmetics_status" text DEFAULT 'LOOKUP_REQUIRED';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_annex" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_reference_no" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_max_ready_for_use_pct" double precision;
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_label_threshold_leave_on_pct" double precision;
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_label_threshold_rinse_off_pct" double precision;
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "eu_summary" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "regulatory_data_status" text DEFAULT 'UNVERIFIED_REQUIRES_LOOKUP';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "regulatory_disclaimer" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "regulatory_sources" text DEFAULT '';
ALTER TABLE "material_regulatory_limits" ADD COLUMN IF NOT EXISTS "last_verified_date" text DEFAULT '';
