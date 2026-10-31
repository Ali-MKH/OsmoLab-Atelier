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
  let parseFailed = false;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    parseFailed = true;
    body = {};
  }

  if (parseFailed) {
    if (res.ok) {
      const err = new Error(
        `Invalid JSON received from server (status ${res.status}): unexpected response body.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'INVALID_JSON_RESPONSE';
      err.details = [
        { field: 'body', message: 'Failed to parse JSON response', code: 'PARSE_ERROR' },
      ];
      throw err;
    }
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

export function validateCatalogResponse(
  raw: unknown,
  requestedLimit?: number,
  requestedOffset?: number
): CatalogListResponse {
  if (!raw || typeof raw !== 'object') {
    const err = new Error(
      'Malformed catalog response — missing or invalid body.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [{ field: 'body', message: 'Expected object', code: 'INVALID_SHAPE' }];
    throw err;
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    const err = new Error(
      'Malformed catalog response — items must be an array.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [
      { field: 'items', message: 'Expected array of materials', code: 'INVALID_COLLECTION' },
    ];
    throw err;
  }

  for (let i = 0; i < obj.items.length; i++) {
    const it = obj.items[i];
    if (!it || typeof it !== 'object') {
      const err = new Error(
        `Malformed catalog response — item at index ${i} is not an object.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}]`, message: 'Expected material object', code: 'INVALID_ITEM' },
      ];
      throw err;
    }
    const mat = it as Record<string, unknown>;
    if (typeof mat.id !== 'number' || !Number.isInteger(mat.id) || mat.id <= 0) {
      const err = new Error(
        `Malformed catalog response — item at index ${i} has invalid id: ${String(mat.id)}`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}].id`, message: 'Expected positive integer id', code: 'INVALID_ID' },
      ];
      throw err;
    }
    if (typeof mat.name !== 'string' || mat.name.trim().length === 0) {
      const err = new Error(
        `Malformed catalog response — item at index ${i} (id ${mat.id}) has invalid name.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}].name`, message: 'Expected non-empty string', code: 'INVALID_NAME' },
      ];
      throw err;
    }
    if (typeof mat.primaryFamily !== 'string' || mat.primaryFamily.trim().length === 0) {
      const err = new Error(
        `Malformed catalog response — item at index ${i} (id ${mat.id}) has invalid primaryFamily.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}].primaryFamily`, message: 'Expected non-empty string', code: 'INVALID_FAMILY' },
      ];
      throw err;
    }
    if (typeof mat.volatility !== 'string' || mat.volatility.trim().length === 0) {
      const err = new Error(
        `Malformed catalog response — item at index ${i} (id ${mat.id}) has invalid volatility.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}].volatility`, message: 'Expected non-empty string', code: 'INVALID_VOLATILITY' },
      ];
      throw err;
    }
    if (typeof mat.casNumber !== 'string') {
      const err = new Error(
        `Malformed catalog response — item at index ${i} (id ${mat.id}) has invalid casNumber.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_CATALOG_RESPONSE';
      err.details = [
        { field: `items[${i}].casNumber`, message: 'Expected string', code: 'INVALID_CAS' },
      ];
      throw err;
    }
  }

  if (typeof obj.total !== 'number' || !Number.isInteger(obj.total) || obj.total < 0) {
    const err = new Error(
      'Malformed catalog response — total must be a finite non-negative integer.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [{ field: 'total', message: 'Expected non-negative integer', code: 'INVALID_TOTAL' }];
    throw err;
  }

  if (typeof obj.limit !== 'number' || !Number.isInteger(obj.limit) || obj.limit <= 0) {
    const err = new Error(
      'Malformed catalog response — limit must be a positive integer.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [{ field: 'limit', message: 'Expected positive integer', code: 'INVALID_LIMIT' }];
    throw err;
  }

  if (typeof obj.offset !== 'number' || !Number.isInteger(obj.offset) || obj.offset < 0) {
    const err = new Error(
      'Malformed catalog response — offset must be a finite non-negative integer.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [{ field: 'offset', message: 'Expected non-negative integer', code: 'INVALID_OFFSET' }];
    throw err;
  }

  if (typeof obj.hasMore !== 'boolean') {
    const err = new Error(
      'Malformed catalog response — hasMore must be a boolean.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [{ field: 'hasMore', message: 'Expected boolean', code: 'INVALID_HAS_MORE' }];
    throw err;
  }

  if (obj.items.length > obj.limit) {
    const err = new Error(
      `Malformed catalog response — received ${obj.items.length} items exceeding limit of ${obj.limit}.`
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_CATALOG_RESPONSE';
    err.details = [
      { field: 'items', message: `items length ${obj.items.length} exceeds limit ${obj.limit}`, code: 'LIMIT_EXCEEDED' },
    ];
    throw err;
  }

  return raw as CatalogListResponse;
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
  const limitVal = params.limit ?? 50;
  const offsetVal = params.offset ?? 0;
  query.set('limit', String(limitVal));
  query.set('offset', String(offsetVal));

  const qs = query.toString();
  const res = await fetch(`/api/catalog${qs ? `?${qs}` : ''}`, {
    headers,
    signal,
  });
  const raw = await parseJsonResponse<unknown>(res);
  return validateCatalogResponse(raw, limitVal, offsetVal);
}

export async function fetchMaterialDetailApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<MaterialDetailResponse> {
  const res = await fetch(`/api/catalog/${materialId}`, { headers });
  return parseJsonResponse<MaterialDetailResponse>(res);
}

export function validateRegulatoryDossierResponse(
  raw: unknown
): MaterialRegulatoryDossier {
  if (!raw || typeof raw !== 'object') {
    const err = new Error(
      'Malformed regulatory dossier response — missing or invalid body.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_REGULATORY_DOSSIER';
    err.details = [{ field: 'body', message: 'Expected object', code: 'INVALID_SHAPE' }];
    throw err;
  }

  const obj = raw as Record<string, unknown>;

  if (obj.regulatoryLimit !== undefined && obj.regulatoryLimit !== null) {
    if (typeof obj.regulatoryLimit !== 'object' || Array.isArray(obj.regulatoryLimit)) {
      const err = new Error(
        'Malformed regulatory dossier — regulatoryLimit must be an object or null.'
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_REGULATORY_DOSSIER';
      err.details = [
        { field: 'regulatoryLimit', message: 'Expected object or null', code: 'INVALID_LIMIT' },
      ];
      throw err;
    }
  }

  if (!Array.isArray(obj.regulatoryRecords)) {
    const err = new Error(
      'Malformed regulatory dossier — regulatoryRecords must be an array.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_REGULATORY_DOSSIER';
    err.details = [
      { field: 'regulatoryRecords', message: 'Expected array', code: 'INVALID_COLLECTION' },
    ];
    throw err;
  }

  for (let i = 0; i < obj.regulatoryRecords.length; i++) {
    const rec = obj.regulatoryRecords[i];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      const err = new Error(
        `Malformed regulatory dossier — regulatoryRecord at index ${i} is not an object.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_REGULATORY_DOSSIER';
      err.details = [
        { field: `regulatoryRecords[${i}]`, message: 'Expected object', code: 'INVALID_RECORD' },
      ];
      throw err;
    }
    const r = rec as Record<string, unknown>;
    if (typeof r.authority !== 'string' || r.authority.trim().length === 0) {
      const err = new Error(
        `Malformed regulatory dossier — regulatoryRecord at index ${i} missing authority.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_REGULATORY_DOSSIER';
      err.details = [
        { field: `regulatoryRecords[${i}].authority`, message: 'Expected non-empty string', code: 'INVALID_AUTHORITY' },
      ];
      throw err;
    }
  }

  if (!Array.isArray(obj.constituents)) {
    const err = new Error(
      'Malformed regulatory dossier — constituents must be an array.'
    ) as StandardizedClientError;
    err.statusCode = 502;
    err.code = 'MALFORMED_REGULATORY_DOSSIER';
    err.details = [
      { field: 'constituents', message: 'Expected array', code: 'INVALID_COLLECTION' },
    ];
    throw err;
  }

  for (let i = 0; i < obj.constituents.length; i++) {
    const c = obj.constituents[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      const err = new Error(
        `Malformed regulatory dossier — constituent at index ${i} is not an object.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_REGULATORY_DOSSIER';
      err.details = [
        { field: `constituents[${i}]`, message: 'Expected object', code: 'INVALID_CONSTITUENT' },
      ];
      throw err;
    }
    const con = c as Record<string, unknown>;
    const cName = con.constituentName ?? con.name;
    if (typeof cName !== 'string' || cName.trim().length === 0) {
      const err = new Error(
        `Malformed regulatory dossier — constituent at index ${i} missing constituentName.`
      ) as StandardizedClientError;
      err.statusCode = 502;
      err.code = 'MALFORMED_REGULATORY_DOSSIER';
      err.details = [
        { field: `constituents[${i}].constituentName`, message: 'Expected non-empty string', code: 'INVALID_CONSTITUENT_NAME' },
      ];
      throw err;
    }
  }

  return raw as MaterialRegulatoryDossier;
}

export async function fetchMaterialRegulatoryDossierApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<MaterialRegulatoryDossier> {
  const res = await fetch(`/api/catalog/${materialId}/regulatory`, { headers });
  const raw = await parseJsonResponse<unknown>(res);
  return validateRegulatoryDossierResponse(raw);
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

export function sanitizeFormula(f: Formula): Formula {
  const versions = Array.isArray(f?.versions)
    ? f.versions.map((v) => ({
        ...v,
        items: Array.isArray(v?.items) ? v.items : [],
        normalizedItems: Array.isArray(v?.normalizedItems) ? v.normalizedItems : [],
      }))
    : [];
  return {
    ...f,
    versions,
  };
}

export function sanitizeAccord(a: AccordDefinition): AccordDefinition {
  const versions = Array.isArray(a?.versions)
    ? a.versions.map((v) => ({
        ...v,
        items: Array.isArray(v?.items) ? v.items : [],
      }))
    : [];
  const activeVerSnap =
    versions.find((v) => v.versionLabel === a?.activeVersionLabel) ||
    (versions.length > 0 ? versions[versions.length - 1] : undefined);
  const items = Array.isArray(a?.items)
    ? a.items
    : activeVerSnap && Array.isArray(activeVerSnap.items)
    ? activeVerSnap.items
    : [];
  return {
    ...a,
    items,
    versions,
  };
}

export async function fetchFormulasListApi(
  headers: Record<string, string>
): Promise<FormulasListResponse> {
  const res = await fetch('/api/formulas', { headers });
  const data = await parseJsonResponse<FormulasListResponse>(res);
  return {
    ...data,
    formulas: Array.isArray(data.formulas)
      ? data.formulas.map((f) => sanitizeFormula(f))
      : [],
  };
}

export async function fetchFormulaDetailApi(
  formulaId: number,
  headers: Record<string, string>
): Promise<FormulaDetailResponse> {
  const res = await fetch(`/api/formulas/${formulaId}`, { headers });
  const data = await parseJsonResponse<FormulaDetailResponse>(res);
  return {
    ...data,
    formula: data.formula ? sanitizeFormula(data.formula) : data.formula,
  };
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
  const data = await parseJsonResponse<AccordsListResponse>(res);
  return {
    ...data,
    accords: Array.isArray(data.accords)
      ? data.accords.map((a) => sanitizeAccord(a))
      : [],
  };
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

