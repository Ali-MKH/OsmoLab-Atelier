import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('Perfumer'),
  experienceLevel: text('experience_level').default('Apprentice Perfumer'),
  preferredUnit: text('preferred_unit').default('grams'),
  educationalPrompts: boolean('educational_prompts').default(true),
  safetyEnabled: boolean('safety_enabled').default(true),
  theme: text('theme').default('dark'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  country: text('country').default(''),
  website: text('website').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  aliases: text('aliases').default(''),
  casNumber: text('cas_number').default('Unknown / Not Provided'),
  inciName: text('inci_name').default('Unknown / Not Provided'),
  naturalOrSynthetic: text('natural_or_synthetic').notNull().default('Synthetic'),
  supplier: text('supplier').default(''),
  supplierProductCode: text('supplier_product_code').default(''),
  manufacturer: text('manufacturer').default(''),
  primaryFamily: text('primary_family').notNull().default('Woody'),
  facets: text('facets').default(''),
  intensity: integer('intensity').default(7),
  substantivityHours: integer('substantivity_hours').default(24),
  diffusion: integer('diffusion').default(7),
  volatility: text('volatility').notNull().default('Heart'),
  descriptiveNotes: text('descriptive_notes').default(''),
  texture: text('texture').default(''),
  temperatureImpression: text('temperature_impression').default('Neutral'),
  personalNotes: text('personal_notes').default(''),
  purity: text('purity').default('Unknown / Not Provided'),
  density: doublePrecision('density').default(1.0),
  recommendedDilution: doublePrecision('recommended_dilution').default(100),
  storageInfo: text('storage_info').default('Cool, dark place (15-20°C)'),
  shelfLifeMonths: integer('shelf_life_months').default(24),
  flashPointCelsius: doublePrecision('flash_point_celsius'),
  educationalObserve: text('educational_observe').default(''),
  complements: text('complements').default(''),
  contrasts: text('contrasts').default(''),
  isSeedData: boolean('is_seed_data').default(false),
  isOnWorkbench: boolean('is_on_workbench').notNull().default(true),
  costPerGram: doublePrecision('cost_per_gram').notNull().default(0.35),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const materialRegulatoryLimits = pgTable('material_regulatory_limits', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  materialId: integer('material_id')
    .references(() => materials.id, { onDelete: 'cascade' })
    .notNull(),
  ifraCategory: text('ifra_category').notNull().default('Category 4 (Fine Fragrance)'),
  maxAllowedPercent: doublePrecision('max_allowed_percent'),
  allergens: text('allergens').default('Unknown / Not Provided'),
  restrictions: text('restrictions').default(''),
  sourceDocument: text('source_document').default('Unknown / Not Provided'),
  documentVersion: text('document_version').default('Unknown / Not Provided'),
  effectiveDate: text('effective_date').default('Unknown / Not Provided'),
  isDemoData: boolean('is_demo_data').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const scentMemories = pgTable('scent_memories', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  materialId: integer('material_id')
    .references(() => materials.id, { onDelete: 'cascade' })
    .notNull(),
  myPerception: text('my_perception').default(''),
  associatedMemories: text('associated_memories').default(''),
  emotions: text('emotions').default(''),
  mentalImages: text('mental_images').default(''),
  places: text('places').default(''),
  colors: text('colors').default(''),
  textures: text('textures').default(''),
  temperature: text('temperature').default(''),
  strengthScore: integer('strength_score').default(7),
  familiarityScore: integer('familiarity_score').default(5),
  blindConfidenceScore: integer('blind_confidence_score').default(5),
  recognitionTrials: integer('recognition_trials').default(0),
  recognitionCorrect: integer('recognition_correct').default(0),
  lastReviewedAt: timestamp('last_reviewed_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accords = pgTable('accords', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Green'),
  description: text('description').default(''),
  objective: text('objective').default(''),
  usageSuggestions: text('usage_suggestions').default(''),
  notes: text('notes').default(''),
  isEducational: boolean('is_educational').default(false),
  itemsJson: text('items_json').notNull().default('[]'),
  olfactoryProfileJson: text('olfactory_profile_json').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const formulas = pgTable('formulas', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  projectId: integer('project_id'),
  projectName: text('project_name').default('Personal Study'),
  name: text('name').notNull(),
  status: text('status').notNull().default('Draft'),
  description: text('description').default(''),
  intendedProduct: text('intended_product').default('Eau de Parfum (20% conc.)'),
  ifraCategory: text('ifra_category').default('Category 4 (Fine Fragrance)'),
  finalProductConcentration: doublePrecision('final_product_concentration').default(20),
  targetBrief: text('target_brief').default(''),
  targetFamilies: text('target_families').default(''),
  targetFacetsJson: text('target_facets_json').default('{}'),
  targetIntensity: integer('target_intensity').default(7),
  targetTexture: text('target_texture').default(''),
  targetAtmosphere: text('target_atmosphere').default(''),
  targetTemperature: text('target_temperature').default('Cool'),
  targetColor: text('target_color').default('#2E6F40'),
  targetMood: text('target_mood').default(''),
  targetDiffusion: integer('target_diffusion').default(7),
  targetEvolution: text('target_evolution').default(''),
  targetDrydown: text('target_drydown').default(''),
  materialsToAvoid: text('materials_to_avoid').default(''),
  isFavorite: boolean('is_favorite').default(false),
  tags: text('tags').default(''),
  activeVersionLabel: text('active_version_label').default('V1'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const formulaVersions = pgTable('formula_versions', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  formulaId: integer('formula_id')
    .references(() => formulas.id, { onDelete: 'cascade' })
    .notNull(),
  parentVersionId: integer('parent_version_id'),
  versionLabel: text('version_label').notNull(),
  status: text('status').notNull().default('Committed'), // 'Draft' | 'Committed'
  versionNotes: text('version_notes').default(''),
  maturationDays: integer('maturation_days').default(14),
  itemsJson: text('items_json').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const experiments = pgTable('experiments', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  formulaId: integer('formula_id')
    .references(() => formulas.id, { onDelete: 'cascade' })
    .notNull(),
  formulaVersionLabel: text('formula_version_label').notNull(),
  stageLabel: text('stage_label').notNull(), // e.g., 'Day 0', '15 min', '2 h', '24 h', 'Day 7', 'Day 30'
  observation: text('observation').notNull(),
  recordedAt: text('recorded_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const evaluations = pgTable('evaluations', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  formulaId: integer('formula_id')
    .references(() => formulas.id, { onDelete: 'cascade' })
    .notNull(),
  formulaVersionLabel: text('formula_version_label').notNull(),
  checkpoint: text('checkpoint').notNull().default('24 hours'),
  overallScore: doublePrecision('overall_score').default(8.0),
  scoresJson: text('scores_json').notNull().default('{}'),
  evaluatedFacetsJson: text('evaluated_facets_json').notNull().default('{}'),
  openingNotes: text('opening_notes').default(''),
  heartNotes: text('heart_notes').default(''),
  drydownNotes: text('drydown_notes').default(''),
  voiceTranscript: text('voice_transcript').default(''),
  voiceDurationSeconds: integer('voice_duration_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materialUsageReviews = pgTable('material_usage_reviews', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  materialId: integer('material_id')
    .references(() => materials.id, { onDelete: 'cascade' })
    .notNull(),
  formulaId: integer('formula_id')
    .references(() => formulas.id, { onDelete: 'cascade' })
    .notNull(),
  formulaName: text('formula_name').notNull(),
  versionLabel: text('version_label').notNull(),
  percentageUsed: doublePrecision('percentage_used').notNull(),
  effectivenessScore: integer('effectiveness_score').notNull().default(8),
  observation: text('observation').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default(''),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
