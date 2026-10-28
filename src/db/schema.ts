import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  type AnyPgColumn,
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
  catalogKey: text('catalog_key').unique(),
  scope: text('scope').notNull().default('GLOBAL'), // 'GLOBAL' | 'USER'
  ownerUid: text('owner_uid'), // null for GLOBAL, user UID for USER
  userUid: text('user_uid'), // Legacy nullable compatibility column
  displayName: text('display_name').notNull().default(''),
  name: text('name').notNull(),
  aliases: text('aliases').default(''),
  casNumber: text('cas_number').default('Unknown / Not Provided'),
  inciName: text('inci_name').default('Unknown / Not Provided'),
  naturalOrSynthetic: text('natural_or_synthetic').notNull().default('Synthetic'),
  materialKind: text('material_kind').notNull().default('SYNTHETIC'),
  sourceSection: text('source_section').default(''),
  catalogSource: text('catalog_source').default(''),
  catalogSourceUrl: text('catalog_source_url').default(''),
  sourceLicense: text('source_license').default(''),
  sourceLicenseUrl: text('source_license_url').default(''),
  starterPriority: text('starter_priority').default('OPTIONAL'),
  myShelfDefault: boolean('my_shelf_default').notNull().default(false),
  shelfStatusDefault: text('shelf_status_default').notNull().default('NOT_ON_SHELF'),
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

export const materialOlfactoryProfiles = pgTable('material_olfactory_profiles', {
  materialId: integer('material_id')
    .primaryKey()
    .references(() => materials.id, { onDelete: 'cascade' }),
  primaryFamily: text('primary_family').notNull().default('Woody'),
  facets: text('facets').default(''),
  odorSummary: text('odor_summary').default(''),
  roleTopHeartBase: text('role_top_heart_base').default(''),
  pyramidUsage: text('pyramid_usage').notNull().default('UNSPECIFIED'),
  pyramidPrimaryZone: text('pyramid_primary_zone').notNull().default('UNSPECIFIED'),
  pyramidHighlightTop: boolean('pyramid_highlight_top').notNull().default(false),
  pyramidHighlightHeart: boolean('pyramid_highlight_heart').notNull().default(false),
  pyramidHighlightBase: boolean('pyramid_highlight_base').notNull().default(false),
  pyramidUiCode: text('pyramid_ui_code').notNull().default('NA'),
  pyramidConfidence: text('pyramid_confidence').notNull().default('UNKNOWN'),
  pyramidBasis: text('pyramid_basis').notNull().default('UNSPECIFIED'),
  pyramidNote: text('pyramid_note').default(''),
  olfactoryStrength: text('olfactory_strength').notNull().default('MEDIUM'),
  intensity: integer('intensity').default(7),
  substantivityHours: integer('substantivity_hours').default(24),
  diffusion: integer('diffusion').default(7),
  volatility: text('volatility').notNull().default('Heart'),
  descriptiveNotes: text('descriptive_notes').default(''),
  texture: text('texture').default(''),
  temperatureImpression: text('temperature_impression').default('Neutral'),
  educationalObserve: text('educational_observe').default(''),
  complements: text('complements').default(''),
  contrasts: text('contrasts').default(''),
});

export const userShelf = pgTable(
  'user_shelf',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    materialId: integer('material_id')
      .references(() => materials.id, { onDelete: 'cascade' })
      .notNull(),
    supplierName: text('supplier_name').notNull().default(''),
    supplierProductName: text('supplier_product_name').notNull().default(''),
    workingDilutionPct: doublePrecision('working_dilution_pct'),
    personalNotes: text('personal_notes').notNull().default(''),
    isOnWorkbench: boolean('is_on_workbench').notNull().default(false),
    pyramidOverrideCode: text('pyramid_override_code'),
    favorite: boolean('favorite').notNull().default(false),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userMaterialUniqueIdx: uniqueIndex('user_shelf_user_uid_material_id_idx').on(
      table.userUid,
      table.materialId
    ),
  })
);

export const materialRegulatoryLimits = pgTable('material_regulatory_limits', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid'), // Nullable for shared GLOBAL regulatory baselines
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
  ifraBaseline: text('ifra_baseline').default('IFRA_51'),
  ifraStandardStatus: text('ifra_standard_status').default('LOOKUP_REQUIRED'),
  ifraStandardType: text('ifra_standard_type').default('LOOKUP_REQUIRED'),
  ifraAmendment: text('ifra_amendment').default(''),
  ifraCat4MaxPct: doublePrecision('ifra_cat4_max_pct'),
  ifraSummary: text('ifra_summary').default(''),
  euCosmeticsStatus: text('eu_cosmetics_status').default('LOOKUP_REQUIRED'),
  euAnnex: text('eu_annex').default(''),
  euReferenceNo: text('eu_reference_no').default(''),
  euMaxReadyForUsePct: doublePrecision('eu_max_ready_for_use_pct'),
  euLabelThresholdLeaveOnPct: doublePrecision('eu_label_threshold_leave_on_pct'),
  euLabelThresholdRinseOffPct: doublePrecision('eu_label_threshold_rinse_off_pct'),
  euSummary: text('eu_summary').default(''),
  regulatoryDataStatus: text('regulatory_data_status').default('UNVERIFIED_REQUIRES_LOOKUP'),
  regulatoryDisclaimer: text('regulatory_disclaimer').default(''),
  regulatorySources: text('regulatory_sources').default(''),
  lastVerifiedDate: text('last_verified_date').default(''),
  isDemoData: boolean('is_demo_data').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materialRegulatoryRecords = pgTable(
  'material_regulatory_records',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid'), // Nullable for shared GLOBAL records, user UID for USER overrides
    materialId: integer('material_id')
      .references(() => materials.id, { onDelete: 'cascade' })
      .notNull(),
    jurisdiction: text('jurisdiction').notNull().default('GLOBAL'), // 'GLOBAL' | 'EU' | 'SUPPLIER' | 'USER'
    authority: text('authority').notNull().default('IFRA'), // 'IFRA' | 'EU_COSMETICS' | 'SUPPLIER' | 'USER'
    ruleType: text('rule_type').notNull().default('INFORMATION'), // 'MAX_USE' | 'PROHIBITION' | 'SPECIFICATION' | 'LABEL_THRESHOLD' | 'CONSTITUENT_CONTRIBUTION' | 'INFORMATION'
    status: text('status').notNull().default('LOOKUP_REQUIRED'),
    standardOrAnnex: text('standard_or_annex').notNull().default(''),
    referenceNumber: text('reference_number').notNull().default(''),
    productCategory: text('product_category'), // e.g. 'Cat 4', 'Cat 5A', or null
    maxFinishedProductPct: doublePrecision('max_finished_product_pct'),
    maxReadyForUsePct: doublePrecision('max_ready_for_use_pct'),
    labelThresholdLeaveOnPct: doublePrecision('label_threshold_leave_on_pct'),
    labelThresholdRinseOffPct: doublePrecision('label_threshold_rinse_off_pct'),
    conditionText: text('condition_text').notNull().default(''),
    summary: text('summary').notNull().default(''),
    sourceUrl: text('source_url').notNull().default(''),
    sourceDocument: text('source_document').notNull().default(''),
    sourceVersion: text('source_version').notNull().default(''),
    verifiedAt: text('verified_at'),
    verificationStatus: text('verification_status')
      .notNull()
      .default('LOOKUP_REQUIRED'), // 'VERIFIED_OFFICIAL' | 'PARTIALLY_VERIFIED' | 'LOOKUP_REQUIRED' | 'USER_ENTERED_UNVERIFIED' | 'DEMO'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    materialIdx: index('material_regulatory_records_material_id_idx').on(table.materialId),
    authorityIdx: index('material_regulatory_records_authority_idx').on(
      table.materialId,
      table.authority
    ),
  })
);

export const materialConstituents = pgTable(
  'material_constituents',
  {
    id: serial('id').primaryKey(),
    materialId: integer('material_id')
      .references(() => materials.id, { onDelete: 'cascade' })
      .notNull(),
    constituentName: text('constituent_name').notNull(),
    constituentCas: text('constituent_cas').notNull().default(''),
    typicalPct: doublePrecision('typical_pct'), // nullable if constituent is known but % is missing
    minPct: doublePrecision('min_pct'),
    maxPct: doublePrecision('max_pct'),
    labelThresholdLeaveOnPct: doublePrecision('label_threshold_leave_on_pct').default(0.001),
    labelThresholdRinseOffPct: doublePrecision('label_threshold_rinse_off_pct').default(0.01),
    riskNote: text('risk_note').notNull().default(''),
    sourceUrl: text('source_url').notNull().default(''),
    sourceDocument: text('source_document').notNull().default(''),
    verificationStatus: text('verification_status')
      .notNull()
      .default('DEMO'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    materialIdx: index('material_constituents_material_id_idx').on(table.materialId),
    casIdx: index('material_constituents_cas_idx').on(table.constituentCas),
  })
);

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
  activeVersionLabel: text('active_version_label').notNull().default('V1'),
  itemsJson: text('items_json').notNull().default('[]'),
  olfactoryProfileJson: text('olfactory_profile_json').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accordVersions = pgTable(
  'accord_versions',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    accordId: integer('accord_id')
      .references(() => accords.id, { onDelete: 'cascade' })
      .notNull(),
    versionLabel: text('version_label').notNull(),
    status: text('status').notNull().default('Committed'), // 'Draft' | 'Committed'
    versionNotes: text('version_notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    accordVersionUniqueIdx: uniqueIndex('accord_versions_accord_id_version_label_idx').on(
      table.accordId,
      table.versionLabel
    ),
    accordIdx: index('accord_versions_accord_id_idx').on(table.accordId),
  })
);

export const accordVersionItems = pgTable(
  'accord_version_items',
  {
    id: serial('id').primaryKey(),
    accordVersionId: integer('accord_version_id')
      .references(() => accordVersions.id, { onDelete: 'cascade' })
      .notNull(),
    lineOrder: integer('line_order').notNull().default(0),
    materialId: integer('material_id')
      .references(() => materials.id, { onDelete: 'restrict' })
      .notNull(),
    materialName: text('material_name').notNull().default(''),
    percentage: doublePrecision('percentage').notNull(),
    dilutionPct: doublePrecision('dilution_pct').notNull().default(100),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    accordVersionIdx: index('accord_version_items_accord_version_id_idx').on(
      table.accordVersionId
    ),
    materialIdx: index('accord_version_items_material_id_idx').on(table.materialId),
  })
);

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

export const formulaVersions = pgTable(
  'formula_versions',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    formulaId: integer('formula_id')
      .references(() => formulas.id, { onDelete: 'cascade' })
      .notNull(),
    parentVersionId: integer('parent_version_id').references(
      (): AnyPgColumn => formulaVersions.id,
      { onDelete: 'set null' }
    ),
    versionLabel: text('version_label').notNull(),
    status: text('status').notNull().default('Committed'), // 'Draft' | 'Committed'
    versionNotes: text('version_notes').default(''),
    maturationDays: integer('maturation_days').default(14),
    itemsJson: text('items_json').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    formulaVersionUniqueIdx: uniqueIndex('formula_versions_formula_id_version_label_idx').on(
      table.formulaId,
      table.versionLabel
    ),
    formulaIdx: index('formula_versions_formula_id_idx').on(table.formulaId),
  })
);

export const formulaVersionItems = pgTable(
  'formula_version_items',
  {
    id: serial('id').primaryKey(),
    formulaVersionId: integer('formula_version_id')
      .references(() => formulaVersions.id, { onDelete: 'cascade' })
      .notNull(),
    lineOrder: integer('line_order').notNull().default(0),
    itemType: text('item_type').notNull().default('MATERIAL'), // 'MATERIAL' | 'ACCORD'
    materialId: integer('material_id').references(() => materials.id, {
      onDelete: 'restrict',
    }),
    accordId: integer('accord_id').references(() => accords.id, {
      onDelete: 'restrict',
    }),
    accordVersionId: integer('accord_version_id').references(() => accordVersions.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull().default(''),
    percentage: doublePrecision('percentage').notNull(),
    quantityGrams: doublePrecision('quantity_grams').notNull(),
    dilutionPct: doublePrecision('dilution_pct').notNull().default(100),
    solvent: text('solvent').notNull().default('Neat'),
    activeMaterialPct: doublePrecision('active_material_pct').notNull().default(0),
    supplier: text('supplier').notNull().default(''),
    costPerGram: doublePrecision('cost_per_gram').notNull().default(0.35),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    formulaVersionIdx: index('formula_version_items_formula_version_id_idx').on(
      table.formulaVersionId
    ),
    materialIdx: index('formula_version_items_material_id_idx').on(table.materialId),
    accordVersionIdx: index('formula_version_items_accord_version_id_idx').on(
      table.accordVersionId
    ),
  })
);

export const experiments = pgTable('experiments', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  formulaId: integer('formula_id')
    .references(() => formulas.id, { onDelete: 'cascade' })
    .notNull(),
  formulaVersionId: integer('formula_version_id').references(() => formulaVersions.id, {
    onDelete: 'cascade',
  }),
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
  formulaVersionId: integer('formula_version_id').references(() => formulaVersions.id, {
    onDelete: 'cascade',
  }),
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
  formulaVersionId: integer('formula_version_id').references(() => formulaVersions.id, {
    onDelete: 'cascade',
  }),
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
