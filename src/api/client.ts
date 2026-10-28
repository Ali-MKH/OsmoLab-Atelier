import type {
  AccordDefinition,
  ExperimentEntry,
  Formula,
  FormulaLineItem,
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
  MaterialUsageReview,
  RawMaterial,
  RegulatoryVerificationStatus,
  ScentMemoryRecord,
  SensoryEvaluation,
  ShelfMutationPayload,
  UserShelfItem,
} from '../domain/types';

export interface BootstrapResponseDto {
  user: {
    uid: string;
    email: string;
    displayName: string;
    theme: string;
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
  activeVersionLabel: string | null;
}

export interface CatalogQueryDto {
  search?: string;
  family?: string;
  origin?: string;
  noteRole?: string;
  pyramidCode?: string;
  shelfOnly?: boolean;
  workbenchOnly?: boolean;
  includeRegulatory?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogResponseDto {
  totalCatalogMaterials: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: RawMaterial[];
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords?: MaterialRegulatoryRecord[];
  constituents?: MaterialConstituent[];
}

export interface MaterialRegulatoryDossierDto {
  materialId: number;
  materialName: string;
  casNumber: string;
  verificationStatus: RegulatoryVerificationStatus;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
}

async function parseJsonOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    let errMsg = fallbackError;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) errMsg = body.error;
    } catch {
      // ignore non-json error body
    }
    throw new Error(errMsg);
  }
  return (await res.json()) as T;
}

export async function fetchBootstrapApi(
  headers: Record<string, string>
): Promise<BootstrapResponseDto> {
  const res = await fetch('/api/bootstrap', { headers });
  return parseJsonOrThrow<BootstrapResponseDto>(
    res,
    'Failed to load workspace bootstrap'
  );
}

export async function fetchCatalogApi(
  params: CatalogQueryDto = {},
  headers: Record<string, string> = {}
): Promise<CatalogResponseDto> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.family && params.family !== 'All') qs.set('family', params.family);
  if (params.origin && params.origin !== 'All') qs.set('origin', params.origin);
  if (params.noteRole && params.noteRole !== 'All') {
    qs.set('noteRole', params.noteRole);
  }
  if (params.pyramidCode && params.pyramidCode !== 'ALL') {
    qs.set('pyramidCode', params.pyramidCode);
  }
  if (params.shelfOnly) qs.set('shelfOnly', 'true');
  if (params.workbenchOnly) qs.set('workbenchOnly', 'true');
  if (params.includeRegulatory) qs.set('includeRegulatory', 'true');
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));

  const queryString = qs.toString();
  const url = queryString ? `/api/catalog?${queryString}` : '/api/catalog';
  const res = await fetch(url, { headers });
  return parseJsonOrThrow<CatalogResponseDto>(res, 'Failed to load catalog');
}

export async function fetchCatalogMaterialDetailApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<{
  material: RawMaterial;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  usageReviews: MaterialUsageReview[];
}> {
  const res = await fetch(`/api/catalog/${materialId}`, { headers });
  return parseJsonOrThrow(res, 'Failed to load material details');
}

export async function fetchMaterialRegulatoryDossierApi(
  materialId: number,
  headers: Record<string, string> = {}
): Promise<MaterialRegulatoryDossierDto> {
  const res = await fetch(`/api/catalog/${materialId}/regulatory`, { headers });
  return parseJsonOrThrow<MaterialRegulatoryDossierDto>(
    res,
    'Failed to load material regulatory dossier'
  );
}

export async function fetchUserShelfApi(
  headers: Record<string, string>
): Promise<{
  shelf: UserShelfItem[];
  shelfCount: number;
  workbenchCount: number;
}> {
  const res = await fetch('/api/shelf', { headers });
  return parseJsonOrThrow(res, 'Failed to load user shelf');
}

export async function addToShelfApi(
  materialId: number,
  payload: ShelfMutationPayload,
  headers: Record<string, string>
) {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  return parseJsonOrThrow<{
    item: UserShelfItem;
    shelf: UserShelfItem[];
    workspace?: unknown;
  }>(res, 'Failed to add material to My Shelf');
}

export async function updateShelfItemApi(
  materialId: number,
  payload: ShelfMutationPayload,
  headers: Record<string, string>
) {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<{
    item: UserShelfItem;
    shelf: UserShelfItem[];
    workspace?: unknown;
  }>(res, 'Failed to update My Shelf item');
}

export async function toggleWorkbenchPinApi(
  materialId: number,
  isOnWorkbench: boolean | undefined,
  headers: Record<string, string>
) {
  const res = await fetch(`/api/shelf/${materialId}/workbench`, {
    method: 'POST',
    headers,
    body: JSON.stringify(
      isOnWorkbench !== undefined ? { isOnWorkbench } : {}
    ),
  });
  return parseJsonOrThrow<{ item: UserShelfItem; shelf: UserShelfItem[] }>(
    res,
    'Failed to update Workbench pin'
  );
}

export async function removeFromShelfApi(
  materialId: number,
  headers: Record<string, string>
) {
  const res = await fetch(`/api/shelf/${materialId}`, {
    method: 'DELETE',
    headers,
  });
  return parseJsonOrThrow<{
    removed: boolean;
    shelf: UserShelfItem[];
    workspace?: unknown;
  }>(res, 'Failed to remove material from My Shelf');
}

export async function fetchFormulasApi(
  headers: Record<string, string>
): Promise<{ formulas: Formula[]; total: number }> {
  const res = await fetch('/api/formulas', { headers });
  return parseJsonOrThrow(res, 'Failed to load formulas');
}

export async function saveFormulaVersionApi(
  formula: Partial<Formula> & { id?: number; name: string },
  version: {
    versionLabel: string;
    parentVersionId?: number | null;
    status: 'Draft' | 'Committed';
    versionNotes: string;
    maturationDays: number;
    items: FormulaLineItem[];
  },
  headers: Record<string, string>
) {
  const res = await fetch('/api/formulas/save', {
    method: 'POST',
    headers,
    body: JSON.stringify({ formula, version }),
  });
  return parseJsonOrThrow(res, 'Failed to save formula version');
}

export async function fetchAccordsApi(
  headers: Record<string, string>
): Promise<{ accords: AccordDefinition[]; total: number }> {
  const res = await fetch('/api/accords', { headers });
  return parseJsonOrThrow(res, 'Failed to load accords');
}

export async function fetchEvaluationsApi(
  headers: Record<string, string>,
  formulaId?: number
): Promise<{ evaluations: SensoryEvaluation[]; total: number }> {
  const url = formulaId
    ? `/api/evaluations?formulaId=${formulaId}`
    : '/api/evaluations';
  const res = await fetch(url, { headers });
  return parseJsonOrThrow(res, 'Failed to load evaluations');
}

export async function fetchExperimentsApi(
  headers: Record<string, string>,
  formulaId?: number
): Promise<{ experiments: ExperimentEntry[]; total: number }> {
  const url = formulaId
    ? `/api/experiments?formulaId=${formulaId}`
    : '/api/experiments';
  const res = await fetch(url, { headers });
  return parseJsonOrThrow(res, 'Failed to load experiments');
}

export async function fetchScentMemoriesApi(
  headers: Record<string, string>,
  materialId?: number
): Promise<{ scentMemories: ScentMemoryRecord[]; total: number }> {
  const url = materialId
    ? `/api/memories?materialId=${materialId}`
    : '/api/memories';
  const res = await fetch(url, { headers });
  return parseJsonOrThrow(res, 'Failed to load scent memories');
}
