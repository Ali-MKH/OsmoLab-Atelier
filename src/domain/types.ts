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

export interface RawMaterial {
  id: number;
  name: string;
  aliases: string;
  casNumber: string;
  inciName: string;
  naturalOrSynthetic: 'Natural' | 'Synthetic' | 'Base';
  supplier: string;
  supplierProductCode: string;
  manufacturer: string;
  primaryFamily: string;
  facets: string[];
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
  storageInfo: string;
  shelfLifeMonths: number;
  flashPointCelsius: number | null;
  educationalObserve: string[];
  complements: string[];
  contrasts: string[];
  isSeedData?: boolean;
  isOnWorkbench?: boolean;
  costPerGram?: number;
  impactRating?: number; // 1-10
  alsoCalled?: string[];
  euCosmeticLimitPercent?: number | null;
  euCosmeticNote?: string;
  euAllergenDeclarable?: boolean;
}

export interface IFRACategoryLimit {
  category: string;
  categoryName: string;
  maxAllowedPercent: number | null; // null = not permitted or unassigned
  description: string;
}

export interface AllergenConstituent {
  name: string;
  casNumber: string;
  typicalPercent: number; // e.g. 38% limonene in bergamot
  euThresholdPercent: number; // e.g. 0.001 for leave-on, 0.01 for rinse-off
  riskNote: string;
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
  materialId: number;
  materialName: string;
  percentage: number;
  dilutionPercent: number;
  notes?: string;
}

export interface AccordVersionSnapshot {
  versionId: string;
  versionLabel: string;
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
  activeVersionLabel?: string;
  versions?: AccordVersionSnapshot[];
}

export interface FormulaLineItem {
  id: string;
  type: 'material' | 'accord';
  materialId?: number;
  accordId?: number;
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
  formulaVersionLabel: string;
  stageLabel: string; // e.g. 'Day 0', '15 min', '2 h', '24 h', 'Day 7', 'Day 30'
  observation: string;
  recordedAt: string;
}

export interface SensoryEvaluation {
  id: number;
  formulaId: number;
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
