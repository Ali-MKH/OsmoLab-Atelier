CREATE TABLE "accords" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Green' NOT NULL,
	"description" text DEFAULT '',
	"objective" text DEFAULT '',
	"usage_suggestions" text DEFAULT '',
	"notes" text DEFAULT '',
	"is_educational" boolean DEFAULT false,
	"items_json" text DEFAULT '[]' NOT NULL,
	"olfactory_profile_json" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text DEFAULT '',
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"formula_id" integer NOT NULL,
	"formula_version_label" text NOT NULL,
	"checkpoint" text DEFAULT '24 hours' NOT NULL,
	"overall_score" double precision DEFAULT 8,
	"scores_json" text DEFAULT '{}' NOT NULL,
	"evaluated_facets_json" text DEFAULT '{}' NOT NULL,
	"opening_notes" text DEFAULT '',
	"heart_notes" text DEFAULT '',
	"drydown_notes" text DEFAULT '',
	"voice_transcript" text DEFAULT '',
	"voice_duration_seconds" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"formula_id" integer NOT NULL,
	"formula_version_label" text NOT NULL,
	"stage_label" text NOT NULL,
	"observation" text NOT NULL,
	"recorded_at" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "formula_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"formula_id" integer NOT NULL,
	"parent_version_id" integer,
	"version_label" text NOT NULL,
	"status" text DEFAULT 'Committed' NOT NULL,
	"version_notes" text DEFAULT '',
	"maturation_days" integer DEFAULT 14,
	"items_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "formulas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"project_id" integer,
	"project_name" text DEFAULT 'Personal Study',
	"name" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"description" text DEFAULT '',
	"intended_product" text DEFAULT 'Eau de Parfum (20% conc.)',
	"ifra_category" text DEFAULT 'Category 4 (Fine Fragrance)',
	"final_product_concentration" double precision DEFAULT 20,
	"target_brief" text DEFAULT '',
	"target_families" text DEFAULT '',
	"target_facets_json" text DEFAULT '{}',
	"target_intensity" integer DEFAULT 7,
	"target_texture" text DEFAULT '',
	"target_atmosphere" text DEFAULT '',
	"target_temperature" text DEFAULT 'Cool',
	"target_color" text DEFAULT '#2E6F40',
	"target_mood" text DEFAULT '',
	"target_diffusion" integer DEFAULT 7,
	"target_evolution" text DEFAULT '',
	"target_drydown" text DEFAULT '',
	"materials_to_avoid" text DEFAULT '',
	"is_favorite" boolean DEFAULT false,
	"tags" text DEFAULT '',
	"active_version_label" text DEFAULT 'V1',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_olfactory_profiles" (
	"material_id" integer PRIMARY KEY NOT NULL,
	"primary_family" text DEFAULT 'Woody' NOT NULL,
	"facets" text DEFAULT '',
	"odor_summary" text DEFAULT '',
	"role_top_heart_base" text DEFAULT '',
	"pyramid_usage" text DEFAULT 'UNSPECIFIED' NOT NULL,
	"pyramid_primary_zone" text DEFAULT 'UNSPECIFIED' NOT NULL,
	"pyramid_highlight_top" boolean DEFAULT false NOT NULL,
	"pyramid_highlight_heart" boolean DEFAULT false NOT NULL,
	"pyramid_highlight_base" boolean DEFAULT false NOT NULL,
	"pyramid_ui_code" text DEFAULT 'NA' NOT NULL,
	"pyramid_confidence" text DEFAULT 'UNKNOWN' NOT NULL,
	"pyramid_basis" text DEFAULT 'UNSPECIFIED' NOT NULL,
	"pyramid_note" text DEFAULT '',
	"olfactory_strength" text DEFAULT 'MEDIUM' NOT NULL,
	"intensity" integer DEFAULT 7,
	"substantivity_hours" integer DEFAULT 24,
	"diffusion" integer DEFAULT 7,
	"volatility" text DEFAULT 'Heart' NOT NULL,
	"descriptive_notes" text DEFAULT '',
	"texture" text DEFAULT '',
	"temperature_impression" text DEFAULT 'Neutral',
	"educational_observe" text DEFAULT '',
	"complements" text DEFAULT '',
	"contrasts" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "material_regulatory_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text,
	"material_id" integer NOT NULL,
	"ifra_category" text DEFAULT 'Category 4 (Fine Fragrance)' NOT NULL,
	"max_allowed_percent" double precision,
	"allergens" text DEFAULT 'Unknown / Not Provided',
	"restrictions" text DEFAULT '',
	"source_document" text DEFAULT 'Unknown / Not Provided',
	"document_version" text DEFAULT 'Unknown / Not Provided',
	"effective_date" text DEFAULT 'Unknown / Not Provided',
	"ifra_baseline" text DEFAULT 'IFRA_51',
	"ifra_standard_status" text DEFAULT 'LOOKUP_REQUIRED',
	"ifra_standard_type" text DEFAULT 'LOOKUP_REQUIRED',
	"ifra_amendment" text DEFAULT '',
	"ifra_cat4_max_pct" double precision,
	"ifra_summary" text DEFAULT '',
	"eu_cosmetics_status" text DEFAULT 'LOOKUP_REQUIRED',
	"eu_annex" text DEFAULT '',
	"eu_reference_no" text DEFAULT '',
	"eu_max_ready_for_use_pct" double precision,
	"eu_label_threshold_leave_on_pct" double precision,
	"eu_label_threshold_rinse_off_pct" double precision,
	"eu_summary" text DEFAULT '',
	"regulatory_data_status" text DEFAULT 'UNVERIFIED_REQUIRES_LOOKUP',
	"regulatory_disclaimer" text DEFAULT '',
	"regulatory_sources" text DEFAULT '',
	"last_verified_date" text DEFAULT '',
	"is_demo_data" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_usage_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"material_id" integer NOT NULL,
	"formula_id" integer NOT NULL,
	"formula_name" text NOT NULL,
	"version_label" text NOT NULL,
	"percentage_used" double precision NOT NULL,
	"effectiveness_score" integer DEFAULT 8 NOT NULL,
	"observation" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalog_key" text,
	"scope" text DEFAULT 'GLOBAL' NOT NULL,
	"owner_uid" text,
	"user_uid" text,
	"display_name" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"aliases" text DEFAULT '',
	"cas_number" text DEFAULT 'Unknown / Not Provided',
	"inci_name" text DEFAULT 'Unknown / Not Provided',
	"natural_or_synthetic" text DEFAULT 'Synthetic' NOT NULL,
	"material_kind" text DEFAULT 'SYNTHETIC' NOT NULL,
	"source_section" text DEFAULT '',
	"catalog_source" text DEFAULT '',
	"catalog_source_url" text DEFAULT '',
	"source_license" text DEFAULT '',
	"source_license_url" text DEFAULT '',
	"starter_priority" text DEFAULT 'OPTIONAL',
	"my_shelf_default" boolean DEFAULT false NOT NULL,
	"shelf_status_default" text DEFAULT 'NOT_ON_SHELF' NOT NULL,
	"supplier" text DEFAULT '',
	"supplier_product_code" text DEFAULT '',
	"manufacturer" text DEFAULT '',
	"primary_family" text DEFAULT 'Woody' NOT NULL,
	"facets" text DEFAULT '',
	"intensity" integer DEFAULT 7,
	"substantivity_hours" integer DEFAULT 24,
	"diffusion" integer DEFAULT 7,
	"volatility" text DEFAULT 'Heart' NOT NULL,
	"descriptive_notes" text DEFAULT '',
	"texture" text DEFAULT '',
	"temperature_impression" text DEFAULT 'Neutral',
	"personal_notes" text DEFAULT '',
	"purity" text DEFAULT 'Unknown / Not Provided',
	"density" double precision DEFAULT 1,
	"recommended_dilution" double precision DEFAULT 100,
	"storage_info" text DEFAULT 'Cool, dark place (15-20°C)',
	"shelf_life_months" integer DEFAULT 24,
	"flash_point_celsius" double precision,
	"educational_observe" text DEFAULT '',
	"complements" text DEFAULT '',
	"contrasts" text DEFAULT '',
	"is_seed_data" boolean DEFAULT false,
	"is_on_workbench" boolean DEFAULT true NOT NULL,
	"cost_per_gram" double precision DEFAULT 0.35 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "materials_catalog_key_unique" UNIQUE("catalog_key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"status" text DEFAULT 'Active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scent_memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"material_id" integer NOT NULL,
	"my_perception" text DEFAULT '',
	"associated_memories" text DEFAULT '',
	"emotions" text DEFAULT '',
	"mental_images" text DEFAULT '',
	"places" text DEFAULT '',
	"colors" text DEFAULT '',
	"textures" text DEFAULT '',
	"temperature" text DEFAULT '',
	"strength_score" integer DEFAULT 7,
	"familiarity_score" integer DEFAULT 5,
	"blind_confidence_score" integer DEFAULT 5,
	"recognition_trials" integer DEFAULT 0,
	"recognition_correct" integer DEFAULT 0,
	"last_reviewed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"name" text NOT NULL,
	"country" text DEFAULT '',
	"website" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_shelf" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"material_id" integer NOT NULL,
	"supplier_name" text DEFAULT '' NOT NULL,
	"supplier_product_name" text DEFAULT '' NOT NULL,
	"working_dilution_pct" double precision,
	"personal_notes" text DEFAULT '' NOT NULL,
	"is_on_workbench" boolean DEFAULT false NOT NULL,
	"pyramid_override_code" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT 'Perfumer',
	"experience_level" text DEFAULT 'Apprentice Perfumer',
	"preferred_unit" text DEFAULT 'grams',
	"educational_prompts" boolean DEFAULT true,
	"safety_enabled" boolean DEFAULT true,
	"theme" text DEFAULT 'dark',
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_formula_id_formulas_id_fk" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_formula_id_formulas_id_fk" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_formula_id_formulas_id_fk" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_olfactory_profiles" ADD CONSTRAINT "material_olfactory_profiles_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_regulatory_limits" ADD CONSTRAINT "material_regulatory_limits_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_reviews" ADD CONSTRAINT "material_usage_reviews_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_reviews" ADD CONSTRAINT "material_usage_reviews_formula_id_formulas_id_fk" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scent_memories" ADD CONSTRAINT "scent_memories_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_shelf" ADD CONSTRAINT "user_shelf_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_shelf_user_uid_material_id_idx" ON "user_shelf" USING btree ("user_uid","material_id");