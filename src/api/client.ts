import type {
  AccordDefinition,
  ExperimentEntry,
  Formula,
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
  MaterialUsageReview,
  PyramidUiCode,
  RawMaterial,
  RegulatoryAuthority,
  RegulatoryRuleType,
  RegulatoryVerificationStatus,
  ScentMemoryRecord,
  SensoryEvaluation,
  ShelfMutationPayload,
  UserShelfItem,
} from '../domain/types';

export interface MaterialRegulatoryDossier {
  materialId: number;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface StandardizedClientError extends Error {
  statusCode: number;
  code: string;
  details: Array<{ field: string; message: string; code: string }>;
}

export interface BootstrapResponse {
  status: string;
  persistenceMode: 'postgres' | 'memory';
  databaseReady: boolean;
  catalogReady: boolean;
  catalogCount: number;
  catalogVersion: string;
  user: { uid: string; email: string } | null;
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
}

export interface CatalogQueryParams {
  q?: string;
  search?: string;
  family?: string;
  origin?: string;
  noteRole?: string;
  pyramidCode?: PyramidUiCode | 'ALL' | '';
  shelfOnly?: boolean;
  workbenchOnly?: boolean;
  includeRegulatory?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogListResponse {
  items: RawMaterial[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  regulatoryLimits?: MaterialRegulatoryLimit[];
}

export interface MaterialDetailResponse {
  material: RawMaterial;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  usageReviews: MaterialUsageReview[];
}

export interface UserShelfResponse {
  shelf: UserShelfItem[];
  shelfCount: number;
  workbenchCount: number;
}

export interface UpsertShelfItemResponse {
  item: UserShelfItem;
  shelf: UserShelfItem[];
}

export interface RemoveShelfItemResponse {
  removed: boolean;
  materialId: number;
  shelf: UserShelfItem[];
}

export interface FormulasListResponse {
  formulas: Formula[];
  total: number;
}

export interface FormulaDetailResponse {
  formula: Formula;
}

export interface SaveFormulaResponse {
  formulaId: number;
  formulaVersionId: number;
  formula: Formula | null;
}

export interface AccordsListResponse {
  accords: AccordDefinition[];
  total: number;
}

export interface CreateAccordResponse {
  accord: AccordDefinition;
}

export interface CreateMaterialResponse {
  material: RawMaterial;
}

export interface ExperimentsListResponse {
  experiments: ExperimentEntry[];
  total: number;
}

export interface CreateExperimentResponse {
  experiment: ExperimentEntry;
}

export interface EvaluationsListResponse {
  evaluations: SensoryEvaluation[];
  total: number;
}

export interface CreateEvaluationResponse {
  evaluation: SensoryEvaluation;
}

export interface ScentMemoriesListResponse {
  scentMemories: ScentMemoryRecord[];
  total: number;
}

export interface SaveScentMemoryResponse {
  scentMemory: ScentMemoryRecord;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = new Error(
      typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`
    ) as StandardizedClientError;
    err.statusCode = res.status;
    err.code = typeof body.code === 'string' ? body.code : 'HTTP_ERROR';
    err.details = Array.isArray(body.details)
      ? (body.details as Array<{ field: string; message: string; code: string }>)
      : [];
    throw err;
  }

  return body as T;
}

export async function fetchBootstrapApi(
  headers: Record<string, string>
): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap', { headers });
  return parseJsonResponse<BootstrapResponse>(res);
}

export async function fetchCatalogApi(
  params: CatalogQueryParams = {},
  headers: Record<string, string> = {},
  signal?: AbortSignal
): Promise<CatalogListResponse> {
  const query = new URLSearchParams();
  const qVal = (params.q ?? params.search ?? '').trim();
  if (qVal) query.set('q', qVal);
  if (params.family && params.family !== 'All') query.set('family', params.family);
  if (params.origin && params.origin !== 'All') query.set('origin', params.origin);
  if (params.noteRole && params.noteRole !== 'All') query.set('noteRole', params.noteRole);
  if (params.pyramidCode && params.pyramidCode !== 'ALL') {
    query.set('pyramidCode', params.pyramidCode);
  }
  if (params.shelfOnly) query.set('shelfOnly', 'true');
  if (params.workbenchOnly) query.set('workbenchOnly', 'true');
  if (params.includeRegulatory) query.set('includeRegulatory', 'true');
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));

  const qs = query.toString();
  const res = await fetch(`/api/catalog${qs ? `?${qs}` : ''}`, {
    headers,
    signal,
  });
  return parseJsonResponse<CatalogListResponse>(res);
}

export async function fetchMaterialDetailApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<MaterialDetailResponse> {
  const res = await fetch(`/api/catalog/${materialId}`, { headers });
  return parseJsonResponse<MaterialDetailResponse>(res);
}

export async function fetchMaterialRegulatoryDossierApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<MaterialRegulatoryDossier> {
  const res = await fetch(`/api/catalog/${materialId}/regulatory`, { headers });
  return parseJsonResponse<MaterialRegulatoryDossier>(res);
}

export async function fetchUserShelfApi(
  headers: Record<string, string>
): Promise<UserShelfResponse> {
  const res = await fetch('/api/shelf', { headers });
  return parseJsonResponse<UserShelfResponse>(res);
}

export async function upsertUserShelfItemApi(
  materialId: number,
  payload: ShelfMutationPayload,
  headers: Record<string, string>
): Promise<UpsertShelfItemResponse> {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<UpsertShelfItemResponse>(res);
}

export async function updateUserShelfItemApi(
  materialId: number,
  payload: ShelfMutationPayload,
  headers: Record<string, string>
): Promise<UpsertShelfItemResponse> {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<UpsertShelfItemResponse>(res);
}

export async function removeUserShelfItemApi(
  materialId: number,
  headers: Record<string, string>
): Promise<RemoveShelfItemResponse> {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'DELETE',
    headers,
  });
  return parseJsonResponse<RemoveShelfItemResponse>(res);
}

export async function loadStarterOrganApi(
  headers: Record<string, string>
): Promise<{ addedCount: number; shelf: UserShelfItem[]; shelfCount: number }> {
  const res = await fetch('/api/shelf/starter-organ', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  return parseJsonResponse<{
    addedCount: number;
    shelf: UserShelfItem[];
    shelfCount: number;
  }>(res);
}

export async function fetchFormulasListApi(
  headers: Record<string, string>
): Promise<FormulasListResponse> {
  const res = await fetch('/api/formulas', { headers });
  return parseJsonResponse<FormulasListResponse>(res);
}

export async function fetchFormulaDetailApi(
  formulaId: number,
  headers: Record<string, string>
): Promise<FormulaDetailResponse> {
  const res = await fetch(`/api/formulas/${formulaId}`, { headers });
  return parseJsonResponse<FormulaDetailResponse>(res);
}

export async function saveFormulaVersionApi(
  payload: {
    formula: Record<string, unknown>;
    version: Record<string, unknown>;
  },
  headers: Record<string, string>
): Promise<SaveFormulaResponse> {
  const res = await fetch('/api/formulas/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<SaveFormulaResponse>(res);
}

export async function fetchAccordsApi(
  headers: Record<string, string>
): Promise<AccordsListResponse> {
  const res = await fetch('/api/accords', { headers });
  return parseJsonResponse<AccordsListResponse>(res);
}

export async function createAccordApi(
  payload: Partial<AccordDefinition>,
  headers: Record<string, string>
): Promise<CreateAccordResponse> {
  const res = await fetch('/api/accords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CreateAccordResponse>(res);
}

export async function updateAccordApi(
  accordId: number,
  payload: Record<string, unknown>,
  headers: Record<string, string>
): Promise<CreateAccordResponse> {
  const res = await fetch(`/api/accords/${accordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CreateAccordResponse>(res);
}

export async function createCustomMaterialApi(
  payload: Partial<RawMaterial> & { maxAllowedPercent?: number | null },
  headers: Record<string, string>
): Promise<CreateMaterialResponse> {
  const res = await fetch('/api/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CreateMaterialResponse>(res);
}

export async function fetchExperimentsApi(
  headers: Record<string, string>
): Promise<ExperimentsListResponse> {
  const res = await fetch('/api/experiments', { headers });
  return parseJsonResponse<ExperimentsListResponse>(res);
}

export async function createExperimentApi(
  payload: Omit<ExperimentEntry, 'id'>,
  headers: Record<string, string>
): Promise<CreateExperimentResponse> {
  const res = await fetch('/api/experiments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CreateExperimentResponse>(res);
}

export async function fetchEvaluationsApi(
  headers: Record<string, string>
): Promise<EvaluationsListResponse> {
  const res = await fetch('/api/evaluations', { headers });
  return parseJsonResponse<EvaluationsListResponse>(res);
}

export async function createEvaluationApi(
  payload: Omit<SensoryEvaluation, 'id' | 'createdAt'> & { createdAt?: string },
  headers: Record<string, string>
): Promise<CreateEvaluationResponse> {
  const res = await fetch('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CreateEvaluationResponse>(res);
}

export async function fetchScentMemoriesApi(
  headers: Record<string, string>
): Promise<ScentMemoriesListResponse> {
  const res = await fetch('/api/memories', { headers });
  return parseJsonResponse<ScentMemoriesListResponse>(res);
}

export async function saveScentMemoryApi(
  payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'> & {
    lastReviewedAt?: string;
  },
  headers: Record<string, string>
): Promise<SaveScentMemoryResponse> {
  const res = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<SaveScentMemoryResponse>(res);
}

export async function upsertUserRegulatoryRecordApi(
  payload: {
    materialId: number;
    authority: RegulatoryAuthority;
    ruleType: RegulatoryRuleType;
    status?: string;
    standardOrAnnex?: string;
    referenceNumber?: string;
    productCategory?: string | null;
    maxFinishedProductPct?: number | null;
    maxReadyForUsePct?: number | null;
    labelThresholdLeaveOnPct?: number | null;
    labelThresholdRinseOffPct?: number | null;
    conditionText?: string;
    summary?: string;
    sourceUrl?: string;
    sourceDocument?: string;
    sourceVersion?: string;
    verificationStatus?: RegulatoryVerificationStatus;
  },
  headers: Record<string, string>
): Promise<{ status: string; record: unknown }> {
  const res = await fetch('/api/regulatory-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ status: string; record: unknown }>(res);
}

export const fetchCatalogPageApi = fetchCatalogApi;
export const upsertShelfItemApi = upsertUserShelfItemApi;
export const removeShelfItemApi = removeUserShelfItemApi;
export const createMaterialApi = createCustomMaterialApi;

