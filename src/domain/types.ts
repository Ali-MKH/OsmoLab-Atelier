export type FormulaStatus =
  | 'Idea'
  | 'Draft'
  | 'Testing'
  | 'Aging'
  | 'Evaluation'
  | 'Revision'
  | 'Final'
  | 'Archived';

export type VolatilityTier = 'Top' | 'Top-Heart' | 'Heart' | 'Heart-Base' | 'Base';

export type MacroFamily = 'Floral' | 'Amber' | 'Woody' | 'Fresh';

export interface OlfactoryFamilyDef {
  id: string;
  name: string;
  macroFamily: MacroFamily;
  color: string;
  description: string;
  academicNotes?: string;
  keyMaterials?: string[];
  subFacets: string[];
}

export type MaterialScope = 'GLOBAL' | 'USER';

export type PyramidPrimaryZone = 'TOP' | 'HEART' | 'BASE' | 'ALL' | 'UNSPECIFIED';

export type PyramidUiCode =
  | 'T'
  | 'TH'
  | 'H'
  | 'HB'
  | 'B'
  | 'THB'
  | 'TB'
  | 'NA'
  | 'NONE';

export type PyramidConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface RawMaterial {
  id: number;
  catalogKey?: string;
  scope?: MaterialScope;
  ownerUid?: string | null;
  displayName?: string;
  name: string;
  aliases: string;
  casNumber: string;
  inciName: string;
  naturalOrSynthetic: 'Natural' | 'Synthetic' | 'Base';
  materialKind?: string;
  supplier: string;
  supplierProductCode: string;
  supplierProductName?: string;
  manufacturer: string;
  primaryFamily: string;
  facets: string[];
  odorSummary?: string;
  roleTopHeartBase?: string;
  pyramidUsage?: string;
  pyramidPrimaryZone?: PyramidPrimaryZone;
  pyramidHighlightTop?: boolean;
  pyramidHighlightHeart?: boolean;
  pyramidHighlightBase?: boolean;
  pyramidUiCode?: PyramidUiCode;
  pyramidConfidence?: PyramidConfidence;
  pyramidBasis?: string;
  pyramidNote?: string;
  olfactoryStrength?: string;
  intensity: number; // 1-10
  substantivityHours: number;
  diffusion: number; // 1-10
  volatility: VolatilityTier;
  descriptiveNotes: string;
  texture: string;
  temperatureImpression: string;
  personalNotes: string;
  purity: string;
  density: number;
  recommendedDilution: number; // e.g. 100 for neat, 10 for 10%
  workingDilutionPct?: number | null;
  storageInfo: string;
  shelfLifeMonths: number;
  flashPointCelsius: number | null;
  educationalObserve: string[];
  complements: string[];
  contrasts: string[];
  isSeedData?: boolean;
  isOnShelf?: boolean;
  isOnWorkbench?: boolean;
  pyramidOverrideCode?: PyramidUiCode | null;
  favorite?: boolean;
  costPerGram?: number;
  impactRating?: number; // 1-10
  alsoCalled?: string[];
  euCosmeticLimitPercent?: number | null;
  euCosmeticNote?: string;
  euAllergenDeclarable?: boolean;
  sourceSection?: string;
  catalogSource?: string;
  catalogSourceUrl?: string;
  sourceLicense?: string;
  sourceLicenseUrl?: string;
  starterPriority?: string;
}

export interface UserShelfItem {
  id: number;
  userUid: string;
  materialId: number;
  catalogKey?: string;
  supplierName: string;
  supplierProductName: string;
  workingDilutionPct: number | null;
  personalNotes: string;
  isOnWorkbench: boolean;
  pyramidOverrideCode: PyramidUiCode | null;
  favorite: boolean;
  addedAt: string;
  updatedAt: string;
}

export interface ShelfMutationPayload {
  supplierName?: string;
  supplierProductName?: string;
  workingDilutionPct?: number | null;
  personalNotes?: string;
  isOnWorkbench?: boolean;
  pyramidOverrideCode?: PyramidUiCode | null;
  favorite?: boolean;
}

export type RegulatoryAuthority = 'IFRA' | 'EU_COSMETICS' | 'SUPPLIER' | 'USER';

export type RegulatoryRuleType =
  | 'MAX_USE'
  | 'PROHIBITION'
  | 'SPECIFICATION'
  | 'LABEL_THRESHOLD'
  | 'CONSTITUENT_CONTRIBUTION'
  | 'INFORMATION';

export type RegulatoryVerificationStatus =
  | 'VERIFIED_OFFICIAL'
  | 'PARTIALLY_VERIFIED'
  | 'LOOKUP_REQUIRED'
  | 'USER_ENTERED_UNVERIFIED'
  | 'DEMO';

export type ComplianceState = 'COMPLIANT' | 'NON_COMPLIANT' | 'INDETERMINATE';

export type ProductExposureType = 'LEAVE_ON' | 'RINSE_OFF' | 'NON_SKIN' | 'AMBIGUOUS';

export interface MaterialRegulatoryRecord {
  id: number;
  materialId: number;
  userUid?: string | null;
  jurisdiction: string; // 'GLOBAL' | 'EU' | 'SUPPLIER' | 'USER'
  authority: RegulatoryAuthority;
  ruleType: RegulatoryRuleType;
  status: string;
  standardOrAnnex: string;
  referenceNumber: string;
  productCategory: string | null; // e.g. 'Cat 4', 'Cat 5A', or null for non-category rules
  maxFinishedProductPct: number | null;
  maxReadyForUsePct: number | null;
  labelThresholdLeaveOnPct: number | null;
  labelThresholdRinseOffPct: number | null;
  conditionText: string;
  summary: string;
  sourceUrl: string;
  sourceDocument: string;
  sourceVersion: string;
  verifiedAt: string | null;
  verificationStatus: RegulatoryVerificationStatus;
}

export interface MaterialConstituent {
  id: number;
  materialId: number;
  constituentName: string;
  constituentCas: string;
  typicalPct: number | null; // null if constituent is known to be present but % is missing
  minPct: number | null;
  maxPct: number | null;
  labelThresholdLeaveOnPct?: number | null;
  labelThresholdRinseOffPct?: number | null;
  riskNote?: string;
  sourceUrl: string;
  sourceDocument: string;
  verificationStatus: RegulatoryVerificationStatus;
}

export interface IFRACategoryLimit {
  category: string;
  categoryName: string;
  maxAllowedPercent: number | null; // null = not permitted or unassigned
  description: string;
  verificationStatus?: RegulatoryVerificationStatus;
}

export interface AllergenConstituent {
  name: string;
  casNumber: string;
  typicalPercent: number | null; // e.g. 38% limonene in bergamot; null if missing
  euThresholdPercent: number; // e.g. 0.001 for leave-on, 0.01 for rinse-off
  euThresholdRinseOffPercent?: number; // e.g. 0.01 for rinse-off
  riskNote: string;
  verificationStatus?: RegulatoryVerificationStatus;
}

export interface PuritySpecification {
  parameter: string;
  standardLimit: string;
  testMethod: string;
  complianceRequirement: string;
}

export interface MaterialRegulatoryLimit {
  id: number;
  materialId: number;
  ifraCategory: string;
  maxAllowedPercent: number | null; // null means unknown / not provided
  allergens: string;
  restrictions: string;
  sourceDocument: string;
  documentVersion: string;
  effectiveDate: string;
  isDemoData: boolean;
  verificationStatus?: RegulatoryVerificationStatus;
  ifraStandardStatus?: string;
  ifraStandardType?: string;
  euCosmeticsStatus?: string;
  euAnnex?: string;
  euReferenceNo?: string;
  euLabelThresholdLeaveOnPct?: number | null;
  euLabelThresholdRinseOffPct?: number | null;
  regulatorySources?: string;
  lastVerifiedDate?: string;
  // Enhanced Regulatory Compliance Detail
  amendmentStatus?: string;
  restrictionType?: 'RESTRICTION' | 'SPECIFICATION' | 'PROHIBITION' | 'NOT_RESTRICTED';
  primaryHazard?: string;
  casNumber?: string;
  ecNumber?: string;
  categoryLimitsTable?: IFRACategoryLimit[];
  allergenBreakdown?: AllergenConstituent[];
  puritySpecifications?: PuritySpecification[];
  euCosmeticLimitPercent?: number | null;
  euRegulationReference?: string;
  euAllergenDeclarable?: boolean;
  regulatoryRecords?: MaterialRegulatoryRecord[];
  constituents?: MaterialConstituent[];
}

export interface ScentMemoryRecord {
  id: number;
  materialId: number;
  myPerception: string[];
  associatedMemories: string[];
  emotions: string[];
  mentalImages: string;
  places: string;
  colors: string;
  textures: string;
  temperature: string;
  strengthScore: number;
  familiarityScore: number;
  blindConfidenceScore: number;
  recognitionTrials: number;
  recognitionCorrect: number;
  lastReviewedAt: string;
}

export interface AccordItem {
  id?: number;
  lineOrder?: number;
  materialId: number;
  materialName: string;
  percentage: number;
  dilutionPercent: number;
  notes?: string;
}

export interface AccordVersionSnapshot {
  id?: number;
  accordId?: number;
  versionId: string;
  versionLabel: string;
  status?: 'Draft' | 'Committed';
  createdAt: string;
  versionNotes: string;
  items: AccordItem[];
}

export interface AccordDefinition {
  id: number;
  name: string;
  category: string;
  description: string;
  objective: string;
  usageSuggestions: string;
  notes: string;
  isEducational: boolean;
  items: AccordItem[];
  olfactoryProfile: Record<string, number>;
  activeVersionId?: number;
  activeVersionLabel?: string;
  versions?: AccordVersionSnapshot[];
}

export interface NormalizedFormulaVersionItem {
  id: number;
  formulaVersionId: number;
  lineOrder: number;
  itemType: 'MATERIAL' | 'ACCORD';
  materialId: number | null;
  accordId?: number | null;
  accordVersionId: number | null;
  name: string;
  percentage: number;
  quantityGrams: number;
  dilutionPct: number;
  solvent: string;
  activeMaterialPct: number;
  supplier: string;
  costPerGram: number;
  notes: string;
  createdAt: string;
}

export interface FormulaLineItem {
  id: string;
  lineOrder?: number;
  type: 'material' | 'accord';
  itemType?: 'MATERIAL' | 'ACCORD';
  materialId?: number;
  accordId?: number;
  accordVersionId?: number | null;
  accordVersionLabel?: string;
  parentAccordId?: number; // only if referencing another accord
  name: string;
  quantityGrams: number;
  percentage: number;
  dilutionPercent: number; // 100 = neat, 10 = 10% in solvent
  solvent: string;
  activeMaterialPercent: number;
  supplier: string;
  costPerGram: number;
  notes: string;
}

export interface FormulaVersion {
  id: number;
  formulaId: number;
  parentVersionId: number | null;
  versionLabel: string;
  status: 'Draft' | 'Committed';
  versionNotes: string;
  maturationDays: number;
  items: FormulaLineItem[];
  normalizedItems?: NormalizedFormulaVersionItem[];
  createdAt: string;
}

export interface Formula {
  id: number;
  projectId: number | null;
  projectName: string;
  name: string;
  status: FormulaStatus;
  description: string;
  intendedProduct: string;
  ifraCategory: string;
  finalProductConcentration: number; // e.g., 20% in alcohol for EDP
  targetBrief: string;
  targetFamilies: string[];
  targetFacets: Record<string, number>; // facet -> 0..10
  targetIntensity: number;
  targetTexture: string;
  targetAtmosphere: string;
  targetTemperature: string;
  targetColor: string;
  targetMood: string;
  targetDiffusion: number;
  targetEvolution: string;
  targetDrydown: string;
  materialsToAvoid: string[];
  isFavorite: boolean;
  tags: string[];
  activeVersionLabel: string;
  versions: FormulaVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentEntry {
  id: number;
  formulaId: number;
  formulaVersionId?: number | null;
  formulaVersionLabel: string;
  stageLabel: string; // e.g. 'Day 0', '15 min', '2 h', '24 h', 'Day 7', 'Day 30'
  observation: string;
  recordedAt: string;
}

export interface SensoryEvaluation {
  id: number;
  formulaId: number;
  formulaVersionId?: number | null;
  formulaVersionLabel: string;
  checkpoint: string;
  overallScore: number;
  scores: Record<string, number>; // opening, heart, drydown, diffusion, etc.
  evaluatedFacets: Record<string, number>; // facet -> 0..10
  openingNotes: string;
  heartNotes: string;
  drydownNotes: string;
  voiceTranscript: string;
  voiceDurationSeconds: number;
  createdAt: string;
}

export interface MaterialUsageReview {
  id: number;
  materialId: number;
  formulaId: number;
  formulaVersionId?: number | null;
  formulaName: string;
  versionLabel: string;
  percentageUsed: number;
  effectivenessScore: number;
  observation: string;
  createdAt: string;
}

export type MentorCategory =
  | 'Olfactory'
  | 'Structural'
  | 'Experimental'
  | 'Stability'
  | 'Safety / Regulatory';

export type MentorConfidence =
  | 'High confidence'
  | 'Moderate confidence'
  | 'Experimental hypothesis';

export interface MentorSuggestion {
  id: string;
  title: string;
  category: MentorCategory;
  confidence: MentorConfidence;
  summary: string;
  whySuggesting: string[];
  proposedChanges: Array<{
    materialName: string;
    fromPercent: number;
    toPercent: number;
    deltaPercent: number;
  }>;
}

export interface ControlledTrialPlan {
  trialCode: string; // e.g. 'A — Control', 'B — Softer drydown', 'C — More diffusion'
  branchVersionLabel: string;
  batchSizeGrams: number;
  objective: string;
  modifications: Array<{
    materialName: string;
    deltaPercent: number;
  }>;
}
