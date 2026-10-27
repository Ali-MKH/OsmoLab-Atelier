export type NavSectionId =
  | 'dashboard'
  | 'formula-lab'
  | 'formula-library'
  | 'raw-materials'
  | 'scent-hierarchy'
  | 'olfactory-wheel'
  | 'accords'
  | 'experiments'
  | 'evaluations'
  | 'scent-memory'
  | 'mentor'
  | 'search'
  | 'help'
  | 'about'
  | 'settings';

export const VALID_NAV_SECTIONS: ReadonlyArray<NavSectionId> = [
  'dashboard',
  'formula-lab',
  'formula-library',
  'raw-materials',
  'scent-hierarchy',
  'olfactory-wheel',
  'accords',
  'experiments',
  'evaluations',
  'scent-memory',
  'mentor',
  'search',
  'help',
  'about',
  'settings',
];

const VALID_NAV_SET = new Set<string>(VALID_NAV_SECTIONS);

export const NAV_STORAGE_KEY = 'osmolab_active_nav';
export const ACTIVE_FORMULA_STORAGE_KEY = 'osmolab_active_formula_id';
export const ACTIVE_VERSION_STORAGE_KEY = 'osmolab_active_version_label';
export const SELECTED_MATERIAL_STORAGE_KEY = 'osmolab_selected_material_id';

export function isValidNavSection(value: unknown): value is NavSectionId {
  return typeof value === 'string' && VALID_NAV_SET.has(value);
}

/**
 * Extracts a validated NavSectionId from a URL hash string (e.g. "#formula-lab" or "#/raw-materials").
 */
export function parseNavFromHash(hash: string): NavSectionId | null {
  if (!hash || typeof hash !== 'string') return null;
  const cleaned = hash
    .trim()
    .replace(/^#+/, '')
    .replace(/^\/+/, '')
    .split('?')[0]
    .trim()
    .toLowerCase();
  if (isValidNavSection(cleaned)) {
    return cleaned;
  }
  return null;
}

export function formatHashForNav(nav: NavSectionId): string {
  return `#${nav}`;
}

/**
 * Resolves the initial navigation tab on app boot or tab restore:
 * 1. Explicit URL hash if valid (e.g., #olfactory-wheel)
 * 2. Persisted localStorage tab if valid
 * 3. Fallback to 'dashboard'
 */
export function resolveInitialNavSection(
  hash: string,
  storedNav: string | null | undefined
): NavSectionId {
  const fromHash = parseNavFromHash(hash);
  if (fromHash) return fromHash;
  if (storedNav && isValidNavSection(storedNav.trim().toLowerCase())) {
    return storedNav.trim().toLowerCase() as NavSectionId;
  }
  return 'dashboard';
}

/**
 * Safely normalizes `alsoCalled` / `aliases` on a RawMaterial into a clean string array
 * so search filters and UI badges never throw if a material has a string or undefined value.
 */
export function normalizeMaterialSynonyms(
  alsoCalled: unknown,
  aliases?: string | null
): string[] {
  const result: string[] = [];
  if (Array.isArray(alsoCalled)) {
    for (const entry of alsoCalled) {
      if (typeof entry === 'string' && entry.trim()) {
        result.push(entry.trim());
      }
    }
  } else if (typeof alsoCalled === 'string' && alsoCalled.trim()) {
    for (const part of alsoCalled.split(',')) {
      if (part.trim()) result.push(part.trim());
    }
  }

  if (result.length === 0 && typeof aliases === 'string' && aliases.trim()) {
    for (const part of aliases.split(',')) {
      if (part.trim()) result.push(part.trim());
    }
  }
  return result;
}
