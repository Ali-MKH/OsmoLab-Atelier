import type {
  FormulaLineItem,
  FormulaStatus,
  PyramidUiCode,
  RegulatoryAuthority,
  RegulatoryRuleType,
  RegulatoryVerificationStatus,
  ShelfMutationPayload,
  VolatilityTier,
} from '../domain/types.ts';
import {
  assertNoPrototypePollution,
  sanitizeBoundedString,
  SecurityPolicyViolationError,
} from '../domain/security-policy.ts';

export interface ApiErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface StandardizedApiErrorBody {
  error: string;
  code: string;
  details: ApiErrorDetail[];
}

export class ApiValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ApiErrorDetail[];

  constructor(
    message: string,
    code = 'VALIDATION_ERROR',
    details: ApiErrorDetail[] = [],
    statusCode = 400
  ) {
    super(message);
    this.name = 'ApiValidationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const VALID_FORMULA_STATUSES: ReadonlySet<FormulaStatus> = new Set([
  'Idea',
  'Draft',
  'Testing',
  'Aging',
  'Evaluation',
  'Revision',
  'Final',
  'Archived',
]);

export const VALID_PYRAMID_UI_CODES: ReadonlySet<PyramidUiCode> = new Set([
  'T',
  'H',
  'B',
  'TH',
  'HB',
  'TB',
  'THB',
  'NONE',
]);

export const VALID_VOLATILITY_TIERS: ReadonlySet<VolatilityTier> = new Set([
  'Top',
  'Top-Heart',
  'Heart',
  'Heart-Base',
  'Base',
]);

export const VALID_REGULATORY_AUTHORITIES: ReadonlySet<RegulatoryAuthority> = new Set([
  'IFRA',
  'EU_COSMETICS',
  'SUPPLIER',
  'USER',
]);

export const VALID_REGULATORY_RULE_TYPES: ReadonlySet<RegulatoryRuleType> = new Set([
  'MAX_USE',
  'PROHIBITION',
  'SPECIFICATION',
  'LABEL_THRESHOLD',
  'CONSTITUENT_CONTRIBUTION',
  'INFORMATION',
]);

export const VALID_VERIFICATION_STATUSES: ReadonlySet<RegulatoryVerificationStatus> =
  new Set([
    'VERIFIED_OFFICIAL',
    'PARTIALLY_VERIFIED',
    'DEMO',
    'LOOKUP_REQUIRED',
    'USER_ENTERED_UNVERIFIED',
  ]);

export function validatePositiveIntId(
  value: unknown,
  fieldName = 'id'
): number {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw new ApiValidationError(
      `Invalid ${fieldName}: must be a positive integer.`,
      'INVALID_ID',
      [{ field: fieldName, message: `${fieldName} must be a positive integer.`, code: 'INVALID_ID' }]
    );
  }
  return num;
}

export interface ValidatedCatalogQuery {
  search: string;
  family: string;
  origin: string;
  noteRole: string;
  pyramidCode: string;
  shelfOnly: boolean;
  workbenchOnly: boolean;
  includeRegulatory: boolean;
  limit: number;
  offset: number;
  paginated: boolean;
}

export function validateCatalogQuery(
  query: Record<string, unknown>
): ValidatedCatalogQuery {
  const details: ApiErrorDetail[] = [];

  const search = sanitizeBoundedString(query.search ?? query.q, 160, '');
  const family = sanitizeBoundedString(query.family, 80, '');
  const origin = sanitizeBoundedString(query.origin ?? query.materialKind, 40, '');
  const noteRole = sanitizeBoundedString(query.noteRole ?? query.volatility, 40, '');
  const pyramidCode = sanitizeBoundedString(query.pyramidCode, 16, '').toUpperCase();

  if (
    pyramidCode &&
    pyramidCode !== 'ALL' &&
    !VALID_PYRAMID_UI_CODES.has(pyramidCode as PyramidUiCode)
  ) {
    details.push({
      field: 'pyramidCode',
      message: `Invalid pyramidCode "${pyramidCode}". Allowed: T, H, B, TH, HB, TB, THB, NONE.`,
      code: 'INVALID_ENUM',
    });
  }

  const shelfOnly =
    query.shelfOnly === 'true' ||
    query.shelfOnly === true ||
    query.shelfOnly === '1';
  const workbenchOnly =
    query.workbenchOnly === 'true' ||
    query.workbenchOnly === true ||
    query.workbenchOnly === '1';
  const includeRegulatory =
    query.includeRegulatory === 'true' ||
    query.includeRegulatory === true ||
    query.includeRegulatory === '1';

  const hasExplicitPagination =
    query.limit !== undefined || query.offset !== undefined;

  let limit = 1000;
  if (query.limit !== undefined && query.limit !== '') {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      details.push({
        field: 'limit',
        message: 'limit must be an integer between 1 and 1000.',
        code: 'OUT_OF_RANGE',
      });
    } else {
      limit = parsedLimit;
    }
  }

  let offset = 0;
  if (query.offset !== undefined && query.offset !== '') {
    const parsedOffset = Number(query.offset);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      details.push({
        field: 'offset',
        message: 'offset must be a non-negative integer.',
        code: 'OUT_OF_RANGE',
      });
    } else {
      offset = parsedOffset;
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'INVALID_QUERY_PARAMETERS',
      details,
      400
    );
  }

  return {
    search,
    family,
    origin,
    noteRole,
    pyramidCode: pyramidCode === 'ALL' ? '' : pyramidCode,
    shelfOnly,
    workbenchOnly,
    includeRegulatory,
    limit,
    offset,
    paginated: hasExplicitPagination,
  };
}

export function validateShelfMutationPayload(
  rawBody: unknown
): ShelfMutationPayload {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Shelf mutation payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];
  const out: ShelfMutationPayload = {};

  if (body.supplierName !== undefined) {
    if (body.supplierName === null) {
      out.supplierName = '';
    } else if (typeof body.supplierName !== 'string' || body.supplierName.length > 160) {
      details.push({
        field: 'supplierName',
        message: 'supplierName must be a string up to 160 characters.',
        code: 'INVALID_STRING_BOUNDS',
      });
    } else {
      out.supplierName = sanitizeBoundedString(body.supplierName, 160);
    }
  }

  if (body.supplierProductName !== undefined) {
    if (body.supplierProductName === null) {
      out.supplierProductName = '';
    } else if (
      typeof body.supplierProductName !== 'string' ||
      body.supplierProductName.length > 160
    ) {
      details.push({
        field: 'supplierProductName',
        message: 'supplierProductName must be a string up to 160 characters.',
        code: 'INVALID_STRING_BOUNDS',
      });
    } else {
      out.supplierProductName = sanitizeBoundedString(body.supplierProductName, 160);
    }
  }

  if (body.workingDilutionPct !== undefined && body.workingDilutionPct !== null) {
    const num = Number(body.workingDilutionPct);
    if (!Number.isFinite(num) || num <= 0 || num > 100) {
      details.push({
        field: 'workingDilutionPct',
        message: 'workingDilutionPct must be greater than 0 and at most 100.',
        code: 'INVALID_DILUTION_RANGE',
      });
    } else {
      out.workingDilutionPct = num;
    }
  } else if (body.workingDilutionPct === null) {
    out.workingDilutionPct = null;
  }

  if (body.personalNotes !== undefined) {
    if (body.personalNotes === null) {
      out.personalNotes = '';
    } else if (typeof body.personalNotes !== 'string' || body.personalNotes.length > 4000) {
      details.push({
        field: 'personalNotes',
        message: 'personalNotes must be a string up to 4000 characters.',
        code: 'INVALID_STRING_BOUNDS',
      });
    } else {
      out.personalNotes = sanitizeBoundedString(body.personalNotes, 4000);
    }
  }

  if (body.isOnWorkbench !== undefined) {
    if (typeof body.isOnWorkbench !== 'boolean') {
      details.push({
        field: 'isOnWorkbench',
        message: 'isOnWorkbench must be a boolean.',
        code: 'INVALID_TYPE',
      });
    } else {
      out.isOnWorkbench = body.isOnWorkbench;
    }
  }

  if (body.favorite !== undefined) {
    if (typeof body.favorite !== 'boolean') {
      details.push({
        field: 'favorite',
        message: 'favorite must be a boolean.',
        code: 'INVALID_TYPE',
      });
    } else {
      out.favorite = body.favorite;
    }
  }

  if (body.pyramidOverrideCode !== undefined) {
    if (body.pyramidOverrideCode === null || body.pyramidOverrideCode === '') {
      out.pyramidOverrideCode = null;
    } else if (
      typeof body.pyramidOverrideCode !== 'string' ||
      !VALID_PYRAMID_UI_CODES.has(body.pyramidOverrideCode as PyramidUiCode)
    ) {
      details.push({
        field: 'pyramidOverrideCode',
        message:
          'pyramidOverrideCode must be one of T, H, B, TH, HB, TB, THB, NONE, or null.',
        code: 'INVALID_ENUM',
      });
    } else {
      out.pyramidOverrideCode = body.pyramidOverrideCode as PyramidUiCode;
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'SHELF_VALIDATION_ERROR',
      details,
      400
    );
  }

  return out;
}

export function validateCreateMaterialPayload(rawBody: unknown): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Material payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 160) {
    details.push({
      field: 'name',
      message: 'Material name is required and must be between 1 and 160 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (body.volatility !== undefined) {
    if (
      typeof body.volatility !== 'string' ||
      !VALID_VOLATILITY_TIERS.has(body.volatility as VolatilityTier)
    ) {
      details.push({
        field: 'volatility',
        message: 'volatility must be one of Top, Top-Heart, Heart, Heart-Base, Base.',
        code: 'INVALID_ENUM',
      });
    }
  }

  if (body.recommendedDilution !== undefined && body.recommendedDilution !== null) {
    const dil = Number(body.recommendedDilution);
    if (!Number.isFinite(dil) || dil <= 0 || dil > 100) {
      details.push({
        field: 'recommendedDilution',
        message: 'recommendedDilution must be between 0.01 and 100.',
        code: 'INVALID_DILUTION_RANGE',
      });
    }
  }

  if (body.maxAllowedPercent !== undefined && body.maxAllowedPercent !== null) {
    const maxPct = Number(body.maxAllowedPercent);
    if (!Number.isFinite(maxPct) || maxPct < 0 || maxPct > 100) {
      details.push({
        field: 'maxAllowedPercent',
        message: 'maxAllowedPercent must be between 0 and 100, or null if unknown.',
        code: 'INVALID_PERCENTAGE_RANGE',
      });
    }
  }

  if (body.pyramidUiCode !== undefined && body.pyramidUiCode !== null) {
    if (
      typeof body.pyramidUiCode !== 'string' ||
      !VALID_PYRAMID_UI_CODES.has(body.pyramidUiCode as PyramidUiCode)
    ) {
      details.push({
        field: 'pyramidUiCode',
        message: 'pyramidUiCode must be one of T, H, B, TH, HB, TB, THB, NONE.',
        code: 'INVALID_ENUM',
      });
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'MATERIAL_VALIDATION_ERROR',
      details,
      400
    );
  }

  return {
    ...body,
    name: sanitizeBoundedString(body.name, 160, 'Unnamed Material'),
  };
}

export function validateFormulaLineItemPayload(
  rawItem: unknown,
  index: number,
  details: ApiErrorDetail[]
): FormulaLineItem | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    details.push({
      field: `version.items[${index}]`,
      message: `Formula line item at index ${index} must be an object.`,
      code: 'INVALID_LINE_ITEM',
    });
    return null;
  }

  const item = rawItem as Record<string, unknown>;
  const rawType = String(item.itemType || item.type || 'material').toLowerCase();
  const isAccord = rawType === 'accord';
  const isMaterial = rawType === 'material';

  if (!isMaterial && !isAccord) {
    details.push({
      field: `version.items[${index}].type`,
      message: `Line item type must be "material" or "accord" (got "${String(item.type || item.itemType)}").`,
      code: 'INVALID_LINE_TYPE',
    });
  }

  if (isMaterial) {
    const matId = Number(item.materialId);
    if (!Number.isInteger(matId) || matId <= 0) {
      details.push({
        field: `version.items[${index}].materialId`,
        message: `Material line item at index ${index} requires a positive integer materialId.`,
        code: 'MISSING_MATERIAL_ID',
      });
    }
  }

  if (isAccord) {
    const accId = Number(item.accordId);
    const accVerId = Number(item.accordVersionId);
    if (
      (!Number.isInteger(accId) || accId <= 0) &&
      (!Number.isInteger(accVerId) || accVerId <= 0)
    ) {
      details.push({
        field: `version.items[${index}].accordId`,
        message: `Accord line item at index ${index} requires a valid accordId or accordVersionId.`,
        code: 'MISSING_ACCORD_ID',
      });
    }
  }

  const qty = Number(item.quantityGrams ?? 0);
  if (!Number.isFinite(qty) || qty < 0 || qty > 100000) {
    details.push({
      field: `version.items[${index}].quantityGrams`,
      message: `quantityGrams at index ${index} must be between 0 and 100,000.`,
      code: 'INVALID_QUANTITY_RANGE',
    });
  }

  const pct = Number(item.percentage ?? 0);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    details.push({
      field: `version.items[${index}].percentage`,
      message: `percentage at index ${index} must be between 0 and 100.`,
      code: 'INVALID_PERCENTAGE_RANGE',
    });
  }

  const dil = Number(item.dilutionPercent ?? 100);
  if (!Number.isFinite(dil) || dil <= 0 || dil > 100) {
    details.push({
      field: `version.items[${index}].dilutionPercent`,
      message: `dilutionPercent at index ${index} must be greater than 0 and at most 100.`,
      code: 'INVALID_DILUTION_RANGE',
    });
  }

  return item as unknown as FormulaLineItem;
}

export function validateSaveFormulaPayload(rawBody: unknown): {
  formula: Record<string, unknown>;
  version: Record<string, unknown>;
} {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Save formula payload must be an object containing formula and version.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  if (!body.formula || typeof body.formula !== 'object' || Array.isArray(body.formula)) {
    details.push({
      field: 'formula',
      message: 'formula object is required.',
      code: 'MISSING_FORMULA',
    });
  }
  if (!body.version || typeof body.version !== 'object' || Array.isArray(body.version)) {
    details.push({
      field: 'version',
      message: 'version object is required.',
      code: 'MISSING_VERSION',
    });
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'FORMULA_VALIDATION_ERROR',
      details,
      400
    );
  }

  const formula = body.formula as Record<string, unknown>;
  const version = body.version as Record<string, unknown>;

  if (formula.id !== undefined && formula.id !== null) {
    const fId = Number(formula.id);
    if (!Number.isInteger(fId) || fId <= 0) {
      details.push({
        field: 'formula.id',
        message: 'formula.id must be a positive integer when provided.',
        code: 'INVALID_ID',
      });
    }
  }

  if (
    typeof formula.name !== 'string' ||
    formula.name.trim().length < 1 ||
    formula.name.length > 160
  ) {
    details.push({
      field: 'formula.name',
      message: 'formula.name must be between 1 and 160 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (formula.status !== undefined) {
    if (
      typeof formula.status !== 'string' ||
      !VALID_FORMULA_STATUSES.has(formula.status as FormulaStatus)
    ) {
      details.push({
        field: 'formula.status',
        message: `formula.status must be one of ${Array.from(VALID_FORMULA_STATUSES).join(', ')}.`,
        code: 'INVALID_ENUM',
      });
    }
  }

  if (
    formula.finalProductConcentration !== undefined &&
    formula.finalProductConcentration !== null
  ) {
    const conc = Number(formula.finalProductConcentration);
    if (!Number.isFinite(conc) || conc < 0.1 || conc > 100) {
      details.push({
        field: 'formula.finalProductConcentration',
        message: 'finalProductConcentration must be between 0.1% and 100%.',
        code: 'INVALID_CONCENTRATION_RANGE',
      });
    }
  }

  if (
    typeof version.versionLabel !== 'string' ||
    version.versionLabel.trim().length < 1 ||
    version.versionLabel.length > 48
  ) {
    details.push({
      field: 'version.versionLabel',
      message: 'version.versionLabel is required and must be 1..48 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (version.status !== undefined) {
    if (version.status !== 'Draft' && version.status !== 'Committed') {
      details.push({
        field: 'version.status',
        message: 'version.status must be "Draft" or "Committed".',
        code: 'INVALID_ENUM',
      });
    }
  }

  if (version.maturationDays !== undefined) {
    const days = Number(version.maturationDays);
    if (!Number.isFinite(days) || days < 0 || days > 3650) {
      details.push({
        field: 'version.maturationDays',
        message: 'version.maturationDays must be between 0 and 3650.',
        code: 'OUT_OF_RANGE',
      });
    }
  }

  if (!Array.isArray(version.items)) {
    details.push({
      field: 'version.items',
      message: 'version.items must be an array of formula line items.',
      code: 'INVALID_ITEMS_ARRAY',
    });
  } else {
    version.items.forEach((rawItem, idx) => {
      validateFormulaLineItemPayload(rawItem, idx, details);
    });
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'FORMULA_VALIDATION_ERROR',
      details,
      400
    );
  }

  return { formula, version };
}

export function validateAccordPayload(rawBody: unknown): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Accord payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 160) {
    details.push({
      field: 'name',
      message: 'Accord name is required and must be 1..160 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    details.push({
      field: 'items',
      message: 'Accord must include at least one ingredient item.',
      code: 'EMPTY_ACCORD_ITEMS',
    });
  } else {
    body.items.forEach((it, idx) => {
      if (!it || typeof it !== 'object') {
        details.push({
          field: `items[${idx}]`,
          message: 'Accord item must be an object.',
          code: 'INVALID_TYPE',
        });
        return;
      }
      const itemRec = it as Record<string, unknown>;
      const matId = Number(itemRec.materialId);
      if (!Number.isInteger(matId) || matId <= 0) {
        details.push({
          field: `items[${idx}].materialId`,
          message: `Accord item at index ${idx} requires a positive integer materialId.`,
          code: 'INVALID_ID',
        });
      }
      const pct = Number(itemRec.percentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        details.push({
          field: `items[${idx}].percentage`,
          message: `Accord item percentage at index ${idx} must be between 0.01 and 100.`,
          code: 'INVALID_PERCENTAGE_RANGE',
        });
      }
      const dil = Number(itemRec.dilutionPercent ?? 100);
      if (!Number.isFinite(dil) || dil <= 0 || dil > 100) {
        details.push({
          field: `items[${idx}].dilutionPercent`,
          message: `Accord item dilutionPercent at index ${idx} must be between 0.01 and 100.`,
          code: 'INVALID_DILUTION_RANGE',
        });
      }
    });
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'ACCORD_VALIDATION_ERROR',
      details,
      400
    );
  }

  return body;
}

export function validateEvaluationPayload(rawBody: unknown): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Evaluation payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  const formulaId = Number(body.formulaId);
  if (!Number.isInteger(formulaId) || formulaId <= 0) {
    details.push({
      field: 'formulaId',
      message: 'formulaId must be a positive integer.',
      code: 'INVALID_ID',
    });
  }

  if (
    typeof body.checkpoint !== 'string' ||
    body.checkpoint.trim().length < 1 ||
    body.checkpoint.length > 80
  ) {
    details.push({
      field: 'checkpoint',
      message: 'checkpoint is required and must be 1..80 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (body.overallScore !== undefined) {
    const score = Number(body.overallScore);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      details.push({
        field: 'overallScore',
        message: 'overallScore must be between 0 and 10.',
        code: 'OUT_OF_RANGE',
      });
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'EVALUATION_VALIDATION_ERROR',
      details,
      400
    );
  }

  return body;
}

export function validateExperimentPayload(rawBody: unknown): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Experiment payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  const formulaId = Number(body.formulaId);
  if (!Number.isInteger(formulaId) || formulaId <= 0) {
    details.push({
      field: 'formulaId',
      message: 'formulaId must be a positive integer.',
      code: 'INVALID_ID',
    });
  }

  if (
    typeof body.observation !== 'string' ||
    body.observation.trim().length < 1 ||
    body.observation.length > 4000
  ) {
    details.push({
      field: 'observation',
      message: 'observation is required and must be 1..4000 characters.',
      code: 'INVALID_STRING_BOUNDS',
    });
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'EXPERIMENT_VALIDATION_ERROR',
      details,
      400
    );
  }

  return body;
}

export function validateScentMemoryPayload(rawBody: unknown): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Scent memory payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  const materialId = Number(body.materialId);
  if (!Number.isInteger(materialId) || materialId <= 0) {
    details.push({
      field: 'materialId',
      message: 'materialId must be a positive integer.',
      code: 'INVALID_ID',
    });
  }

  for (const scoreKey of ['strengthScore', 'familiarityScore', 'blindConfidenceScore']) {
    if (body[scoreKey] !== undefined) {
      const val = Number(body[scoreKey]);
      if (!Number.isFinite(val) || val < 0 || val > 10) {
        details.push({
          field: scoreKey,
          message: `${scoreKey} must be between 0 and 10.`,
          code: 'OUT_OF_RANGE',
        });
      }
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'SCENT_MEMORY_VALIDATION_ERROR',
      details,
      400
    );
  }

  return body;
}

export function validateUserRegulatoryRecordPayload(
  rawBody: unknown
): Record<string, unknown> {
  assertNoPrototypePollution(rawBody);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new ApiValidationError(
      'Regulatory record payload must be a JSON object.',
      'INVALID_PAYLOAD',
      [{ field: 'body', message: 'Expected JSON object.', code: 'INVALID_TYPE' }]
    );
  }

  const body = rawBody as Record<string, unknown>;
  const details: ApiErrorDetail[] = [];

  const materialId = Number(body.materialId);
  if (!Number.isInteger(materialId) || materialId <= 0) {
    details.push({
      field: 'materialId',
      message: 'materialId must be a positive integer.',
      code: 'INVALID_ID',
    });
  }

  if (
    typeof body.authority !== 'string' ||
    !VALID_REGULATORY_AUTHORITIES.has(body.authority as RegulatoryAuthority)
  ) {
    details.push({
      field: 'authority',
      message: 'authority must be one of IFRA, EU, OTHER.',
      code: 'INVALID_ENUM',
    });
  }

  if (
    typeof body.ruleType !== 'string' ||
    !VALID_REGULATORY_RULE_TYPES.has(body.ruleType as RegulatoryRuleType)
  ) {
    details.push({
      field: 'ruleType',
      message: `ruleType must be one of ${Array.from(VALID_REGULATORY_RULE_TYPES).join(', ')}.`,
      code: 'INVALID_ENUM',
    });
  }

  if (
    body.maxFinishedProductPct !== undefined &&
    body.maxFinishedProductPct !== null
  ) {
    const pct = Number(body.maxFinishedProductPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      details.push({
        field: 'maxFinishedProductPct',
        message: 'maxFinishedProductPct must be between 0 and 100, or null.',
        code: 'INVALID_PERCENTAGE_RANGE',
      });
    }
  }

  if (body.verificationStatus !== undefined) {
    if (
      typeof body.verificationStatus !== 'string' ||
      !VALID_VERIFICATION_STATUSES.has(
        body.verificationStatus as RegulatoryVerificationStatus
      )
    ) {
      details.push({
        field: 'verificationStatus',
        message: `verificationStatus must be one of ${Array.from(VALID_VERIFICATION_STATUSES).join(', ')}.`,
        code: 'INVALID_ENUM',
      });
    }
  }

  if (details.length > 0) {
    throw new ApiValidationError(
      details[0].message,
      'REGULATORY_RECORD_VALIDATION_ERROR',
      details,
      400
    );
  }

  return body;
}

/**
 * Formats any caught error into the standardized API error envelope:
 * `{ error: string, code: string, details: ApiErrorDetail[] }`
 * without leaking raw SQL queries, internal driver objects, or stack traces.
 */
export function formatStandardizedApiError(
  error: unknown,
  fallbackMessage: string
): { statusCode: number; body: StandardizedApiErrorBody } {
  if (error instanceof ApiValidationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }
  if (error instanceof SecurityPolicyViolationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        details: [],
      },
    };
  }
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'PersistenceModeError'
  ) {
    const statusCode =
      'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 503;
    return {
      statusCode,
      body: {
        error: error instanceof Error ? error.message : fallbackMessage,
        code: 'PERSISTENCE_MODE_ERROR',
        details: [],
      },
    };
  }
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'ShelfValidationError'
  ) {
    const statusCode =
      'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 400;
    return {
      statusCode,
      body: {
        error: error instanceof Error ? error.message : fallbackMessage,
        code: 'SHELF_VALIDATION_ERROR',
        details: [],
      },
    };
  }
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'FormulaIntegrityError'
  ) {
    const statusCode =
      'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 400;
    return {
      statusCode,
      body: {
        error: error instanceof Error ? error.message : fallbackMessage,
        code: 'FORMULA_INTEGRITY_ERROR',
        details: [],
      },
    };
  }
  if (error instanceof Error && error.message.startsWith('Forbidden:')) {
    return {
      statusCode: 403,
      body: {
        error: error.message,
        code: 'CROSS_TENANT_ACCESS_DENIED',
        details: [],
      },
    };
  }
  if (error instanceof Error && error.message.startsWith('NotFound:')) {
    return {
      statusCode: 404,
      body: {
        error: error.message.replace(/^NotFound:\s*/, ''),
        code: 'RESOURCE_NOT_FOUND',
        details: [],
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: fallbackMessage,
      code: 'INTERNAL_SERVER_ERROR',
      details: [],
    },
  };
}
