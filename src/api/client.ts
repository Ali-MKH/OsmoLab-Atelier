import {
  AccordDefinition,
  ExperimentEntry,
  Formula,
  FormulaLineItem,
  FormulaVersion,
  MaterialRegulatoryLimit,
  RawMaterial,
  ScentMemoryRecord,
  SensoryEvaluation,
  UserShelfItem,
} from '../domain/types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface CatalogQueryOptions {
  q?: string;
  family?: string;
  origin?: string;
  pyramidCode?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface CatalogListResponse {
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface BootstrapResponse {
  userId: string;
  persistenceMode: 'postgres' | 'memory';
  settings: {
    theme: string;
    activeCurrency: string;
    educationalPrompts: boolean;
    safetyEnabled: boolean;
  };
  counts: {
    catalog: number;
    shelf: number;
    workbench: number;
    formulas: number;
    accords: number;
    evaluations: number;
    experiments: number;
    scentMemories: number;
  };
  activeFormulaId: number | null;
}

export async function fetchHealthDataApi(): Promise<{
  persistenceMode: 'postgres' | 'memory';
  databaseReady: boolean;
  catalogReady: boolean;
  catalogCount: number;
  catalogVersion: string;
}> {
  const res = await fetch('/api/health/data');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchCatalogApi(
  options: CatalogQueryOptions = {},
  headers: Record<string, string> = {}
): Promise<CatalogListResponse> {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.family && options.family !== 'All') params.set('family', options.family);
  if (options.origin && options.origin !== 'All') params.set('origin', options.origin);
  if (options.pyramidCode && options.pyramidCode !== 'All') {
    params.set('pyramidCode', options.pyramidCode);
  }
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));

  const qs = params.toString();
  const res = await fetch(`/api/catalog${qs ? `?${qs}` : ''}`, {
    headers,
    signal: options.signal,
  });
  if (!res.ok) {
    let errBody: { error?: string; message?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(
      errBody.message || errBody.error || `Failed to fetch catalog: ${res.status}`
    );
  }
  return res.json();
}

export async function fetchCatalogMaterialDetailApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<{
  material: RawMaterial;
  regulatoryLimit: MaterialRegulatoryLimit | null;
}> {
  const res = await fetch(`/api/catalog/${materialId}`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch material ${materialId}: ${res.status}`);
  }
  return res.json();
}

export async function fetchMaterialRegulatoryDossierApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<{
  materialId: number;
  materialName: string;
  casNumber: string;
  inciName: string;
  ifra: {
    status: string;
    amendmentNumber: number;
    category4LimitPct: number | null;
    standardName: string | null;
    restrictionType: string | null;
    categoryLimitsTable: unknown[];
  };
  euCosmetics: {
    status: string;
    annexNumber: string | null;
    entryNumber: string | null;
    maxConcentrationPct: number | null;
    conditionsText: string | null;
    allergenDeclarable: boolean;
    leaveOnThresholdPct: number;
    rinseOffThresholdPct: number;
  };
  provenance: {
    verificationStatus: string;
    sourceDocument: string;
    sourceUrl: string;
    notes: string;
    lastVerifiedAt: string | null;
  };
  regLimit: MaterialRegulatoryLimit | null;
}> {
  const res = await fetch(`/api/catalog/${materialId}/regulatory`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch regulatory dossier for ${materialId}: ${res.status}`);
  }
  return res.json();
}

export async function fetchBootstrapApi(
  headers: Record<string, string> = {}
): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap', { headers });
  if (!res.ok) {
    throw new Error(`Bootstrap failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchUserShelfApi(
  headers: Record<string, string> = {},
  workbenchOnly = false
): Promise<{
  userShelf: UserShelfItem[];
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  total: number;
}> {
  const res = await fetch(
    `/api/shelf${workbenchOnly ? '?workbenchOnly=true' : ''}`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch shelf: ${res.status}`);
  }
  return res.json();
}

export async function upsertShelfItemApi(
  materialId: number,
  payload: {
    supplierName?: string | null;
    supplierProductName?: string | null;
    workingDilutionPct?: number | null;
    solvent?: string | null;
    personalNotes?: string | null;
    isOnWorkbench?: boolean;
    pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
    favorite?: boolean;
  },
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; shelfItem: UserShelfItem | null }> {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert shelf item ${materialId}: ${res.status}`);
  }
  return res.json();
}

export async function removeShelfItemApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; materialId: number }> {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to remove shelf item ${materialId}: ${res.status}`);
  }
  return res.json();
}

export async function loadStarterOrganApi(
  headers: Record<string, string> = {}
): Promise<{
  ok: boolean;
  addedCount: number;
  userShelf: UserShelfItem[];
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  total: number;
}> {
  const res = await fetch('/api/shelf/starter-organ', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  if (!res.ok) {
    throw new Error(`Failed to load starter organ: ${res.status}`);
  }
  return res.json();
}

export async function fetchFormulasApi(
  headers: Record<string, string> = {}
): Promise<{ formulas: Formula[]; total: number }> {
  const res = await fetch('/api/formulas', { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch formulas: ${res.status}`);
  }
  return res.json();
}

export async function fetchFormulaDetailApi(
  formulaId: number,
  headers: Record<string, string> = {}
): Promise<{
  formula: Formula;
  versions: FormulaVersion[];
  evaluations: SensoryEvaluation[];
  experiments: ExperimentEntry[];
}> {
  const res = await fetch(`/api/formulas/${formulaId}`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch formula ${formulaId}: ${res.status}`);
  }
  return res.json();
}

export async function saveFormulaVersionApi(
  formulaPayload: Partial<Formula> & { id?: number; name: string },
  versionPayload: {
    versionLabel: string;
    parentVersionId?: number | null;
    status: 'Draft' | 'Committed';
    versionNotes: string;
    maturationDays: number;
    items: FormulaLineItem[];
  },
  headers: Record<string, string> = {}
): Promise<{
  formulaId: number;
  formulaVersionId: number;
  formula: Formula;
  version: FormulaVersion;
}> {
  const res = await fetch('/api/formulas/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ formula: formulaPayload, version: versionPayload }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save formula version: ${res.status}`);
  }
  return res.json();
}

export async function fetchAccordsApi(
  headers: Record<string, string> = {}
): Promise<{ accords: AccordDefinition[]; total: number }> {
  const res = await fetch('/api/accords', { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch accords: ${res.status}`);
  }
  return res.json();
}

export async function createMaterialApi(
  payload: Omit<RawMaterial, 'id'> & {
    maxAllowedPercent?: number | null;
    ifraSource?: string;
  },
  headers: Record<string, string> = {}
): Promise<{
  materialId: number;
  material: RawMaterial;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  shelfItem: UserShelfItem | null;
}> {
  const res = await fetch('/api/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create material: ${res.status}`);
  }
  return res.json();
}

export async function createAccordApi(
  payload: Omit<AccordDefinition, 'id'>,
  headers: Record<string, string> = {}
): Promise<{ accordId: number; accord: AccordDefinition }> {
  const res = await fetch('/api/accords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create accord: ${res.status}`);
  }
  return res.json();
}

export async function addExperimentApi(
  payload: Omit<ExperimentEntry, 'id'>,
  headers: Record<string, string> = {}
): Promise<{ experiment: ExperimentEntry }> {
  const res = await fetch('/api/experiments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to add experiment: ${res.status}`);
  }
  return res.json();
}

export async function addEvaluationApi(
  payload: Omit<SensoryEvaluation, 'id' | 'createdAt'>,
  headers: Record<string, string> = {}
): Promise<{ evaluation: SensoryEvaluation }> {
  const res = await fetch('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to add evaluation: ${res.status}`);
  }
  return res.json();
}

export async function upsertScentMemoryApi(
  payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>,
  headers: Record<string, string> = {}
): Promise<{ scentMemory: ScentMemoryRecord }> {
  const res = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to save scent memory: ${res.status}`);
  }
  return res.json();
}
