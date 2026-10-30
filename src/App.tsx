import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import {
  AccordDefinition,
  ExperimentEntry,
  Formula,
  FormulaLineItem,
  MaterialRegulatoryLimit,
  MaterialUsageReview,
  RawMaterial,
  ScentMemoryRecord,
  SensoryEvaluation,
  UserShelfItem,
} from './domain/types';
import {
  CurrencySettings,
  DEFAULT_CURRENCY_SETTINGS,
} from './domain/currency-and-cost';
import {
  OlfactoryWheelView,
  OlfactoryPyramidView,
  FormulaLabView,
} from './features/formula/FormulaLabView';
import { MaterialCatalogView } from './features/catalog/MaterialCatalogView';
import { EvaluationAndJournalView } from './features/evaluation/EvaluationAndJournalView';
import {
  fetchBootstrapApi,
  fetchUserShelfApi,
  fetchFormulasApi,
  fetchAccordsApi,
  fetchEvaluationsApi,
  fetchExperimentsApi,
  fetchScentMemoriesApi,
  addToShelfApi,
  updateShelfItemApi,
  removeFromShelfApi,
  toggleWorkbenchPinApi,
  saveFormulaVersionApi,
} from './api/client';
import {
  OlfactoryMentorView,
  GlobalSearchView,
  SettingsView,
  ThemePaletteId,
  THEME_OPTIONS,
} from './components/MentorAndSearchModal';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import {
  HelpAndTutorialView,
  AboutAndPrivacyView,
  InteractiveTourOverlay,
  GUIDED_TOUR_STEPS,
} from './components/HelpAndAboutViews';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import {
  resolveInitialNavSection,
  parseNavFromHash,
  formatHashForNav,
  NAV_STORAGE_KEY,
  ACTIVE_FORMULA_STORAGE_KEY,
  ACTIVE_VERSION_STORAGE_KEY,
  SELECTED_MATERIAL_STORAGE_KEY,
} from './domain/navigation-state';
import { AppLanguage, t, getDir } from './domain/i18n';
import {
  LayoutDashboard,
  FlaskConical,
  Library,
  Database,
  Package,
  GitMerge,
  Compass,
  Layers,
  Clock,
  ClipboardCheck,
  Brain,
  Sparkles,
  Scale,
  Search,
  Settings,
  HelpCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Menu,
  X,
  SlidersHorizontal,
  Palette,
  Sun,
  Moon,
  Globe,
  ArrowRight,
} from 'lucide-react';

/**
 * Custom 3-Tiered Olfactory Pyramid Icon for Navigation & Schematic Route
 */
export const OlfactoryPyramidIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Top Note Apex */}
    <polygon points="12 3 15.8 9 8.2 9" />
    {/* Heart Note Middle Frustum */}
    <polygon points="7.3 10.5 16.7 10.5 19.2 14.8 4.8 14.8" />
    {/* Base Note Foundation Frustum */}
    <polygon points="3.9 16.3 20.1 16.3 22 20.5 2 20.5" />
  </svg>
);

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

export const TAB_INSTRUCTION_GUIDE: Record<
  NavSectionId,
  { title: string; summary: string; howTo: string }
> = {
  dashboard: {
    title: 'Perfumer Studio Overview',
    summary:
      'Your central workspace showing active formulas, maturation blotter checkpoints, recent version changes, and scent memory progress.',
    howTo:
      'Click "Formulate →" on any study to open it in the Formula Lab, or use the top Formula Development Route to move step-by-step from raw materials to finished perfume.',
  },
  'raw-materials': {
    title: 'Step 1 · Raw Materials Palette (Perfumer Organ)',
    summary:
      'Explore your perfumery ingredients by olfactory family, volatility tier (Top, Heart, Base), odor profile, substantivity, and IFRA safety limits.',
    howTo:
      'Select any raw material to inspect its evaporation curve, odor descriptors, and which formulas or accords use it.',
  },
  accords: {
    title: 'Step 1B · Structural Accords & Bases',
    summary:
      'Build and inspect reusable sub-compositions (e.g., Chypre, Ambergris, Dewy Fig, White Floral) that act as modular building blocks.',
    howTo:
      'Click "Insert into Active Formula" on any accord to add it directly into your current fragrance study.',
  },
  'olfactory-wheel': {
    title: 'Step 2 · Interactive Olfactory Wheel & Facet Calibration',
    summary:
      'Map your fragrance across 17 olfactory families and compare your creative Target Brief (Intent) against what you actually smell on the blotter (Result).',
    howTo:
      'Click any colored sector on the wheel to explore its sub-facets and adjust the 0–10 intensity sliders on the right.',
  },
  'scent-hierarchy': {
    title: 'Step 3 · Olfactory Pyramid & Volatility Balance',
    summary:
      'Visualize your formula across 5 evaporation tiers—Top, Top-Heart Bridge, Heart, Heart-Base Bridge, and Base—with color bars showing each tier’s exact proportion of the total formula.',
    howTo:
      'Click any tier to adjust ingredient percentages with vertical faders, or click "+" to add new materials into that volatility tier.',
  },
  'formula-lab': {
    title: 'Step 4 · Formula Lab Workbench',
    summary:
      'Compose, normalize to 100%, scale in Grams/Ounces/mL, monitor real-time IFRA safety limits, and compare formula versions side-by-side.',
    howTo:
      'Adjust ingredient gram weights, click "Normalize to 100%" to balance percentages, and click "Save New Version" or "Branch Experiment" to preserve your progress.',
  },
  'formula-library': {
    title: 'Formula Archive & Version Lineages',
    summary:
      'Browse all your fragrance compositions, creative briefs, and version histories in one organized collection.',
    howTo:
      'Filter by status (Draft, Testing, Aging, Final) or click "Open in Lab →" to load any formula into the active workbench.',
  },
  evaluations: {
    title: 'Step 5 · Sensory Evaluations & Blotter Log',
    summary:
      'Record empirical smelling notes on paper blotter or skin across opening (0–15m), heart (30m–4h), and drydown (4h–24h+) checkpoints.',
    howTo:
      'Log longevity, projection, and perceived facet scores after maturation so you can refine your next formula version.',
  },
  mentor: {
    title: 'Step 5B · AI Olfactory Mentor & Controlled Trials',
    summary:
      'Diagnose structural imbalances (such as dryness, muddiness, or weak projection) and generate 3 controlled A/B/C bench trials.',
    howTo:
      'Describe what you smell on the blotter and click "Create Branch" on any proposed trial to test a 1–2 ingredient adjustment safely.',
  },
  experiments: {
    title: 'Perfumer Lab Journal & Dilution Trials',
    summary:
      'Document single-material dilution studies, raw material comparisons, and pairwise synergy observations.',
    howTo:
      'Record your hypothesis and outcome before committing changes to your master formula.',
  },
  'scent-memory': {
    title: 'Scent Memory & Blind Smelling Trainer',
    summary:
      'Train your nose by associating each raw material with personal sensory memories, textures, and blind-smelling recognition scores.',
    howTo:
      'Select a material to save your personal associations or run a blind recognition drill.',
  },
  search: {
    title: 'Global Studio Search & Multi-Facet Filter',
    summary:
      'Instantly find raw materials, CAS numbers, olfactory descriptors, accords, and formulas across your entire studio.',
    howTo:
      'Type any scent note (e.g., "petrichor", "bergamot", "cedar") or filter by family and origin.',
  },
  help: {
    title: 'Interactive Perfumer Guide & Tutorials',
    summary:
      'Step-by-step visual walkthroughs of the OsmoLab creative workflow, dilution math, and olfactory architecture.',
    howTo:
      'Click "Launch Interactive Live Tour" to be guided through each module with live examples.',
  },
  about: {
    title: 'About OsmoLab & Data Privacy',
    summary:
      'Architecture overview, deterministic formulation engines, and intellectual property protection for your formulas.',
    howTo:
      'Review how your formulas are isolated and how to export full JSON/CSV backups.',
  },
  settings: {
    title: 'Studio Preferences, Themes & Currency',
    summary:
      'Customize your 6 visual color themes (Dark & Day modes), active valuation currency, IFRA safety guardrails, and workspace backups.',
    howTo:
      'Switch between Dark and Day themes or export a complete JSON snapshot of your perfumery workspace.',
  },
};

const NAV_ITEMS: Array<{
  id: NavSectionId;
  label: string;
  group: 'Workspace' | 'Encyclopedia' | 'Olfactory' | 'Bench';
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', group: 'Workspace', icon: LayoutDashboard },
  { id: 'formula-lab', label: 'Formula Lab', group: 'Workspace', icon: FlaskConical },
  { id: 'formula-library', label: 'Formula Library', group: 'Workspace', icon: Library },
  { id: 'raw-materials', label: 'Raw Materials', group: 'Encyclopedia', icon: Database },
  { id: 'accords', label: 'Accords & Bases', group: 'Encyclopedia', icon: Layers },
  { id: 'scent-hierarchy', label: 'Olfactory Pyramid', group: 'Olfactory', icon: OlfactoryPyramidIcon },
  { id: 'olfactory-wheel', label: 'Olfactory Wheel', group: 'Olfactory', icon: Compass },
  { id: 'scent-memory', label: 'Scent Memory', group: 'Olfactory', icon: Brain },
  { id: 'mentor', label: 'Olfactory Mentor', group: 'Olfactory', icon: Sparkles },
  { id: 'evaluations', label: 'Evaluations', group: 'Bench', icon: ClipboardCheck },
  { id: 'experiments', label: 'Experiments', group: 'Bench', icon: Clock },
  { id: 'search', label: 'Search', group: 'Workspace', icon: Search },
  { id: 'help', label: 'Help & Tutorial', group: 'Workspace', icon: HelpCircle },
  { id: 'about', label: 'About & Privacy', group: 'Workspace', icon: Info },
  { id: 'settings', label: 'Settings', group: 'Workspace', icon: Settings },
];

export default function App() {
  const [activeNav, setActiveNavState] = useState<NavSectionId>(() => {
    try {
      const storedNav = localStorage.getItem(NAV_STORAGE_KEY);
      return resolveInitialNavSection(window.location.hash, storedNav);
    } catch {
      return resolveInitialNavSection(window.location.hash, null);
    }
  });

  const setActiveNav = useCallback((nextNav: NavSectionId) => {
    setActiveNavState(nextNav);
    try {
      localStorage.setItem(NAV_STORAGE_KEY, nextNav);
    } catch {
      // ignore localStorage write errors
    }
    if (typeof window !== 'undefined') {
      const targetHash = formatHashForNav(nextNav);
      if (window.location.hash !== targetHash) {
        try {
          window.history.pushState({ nav: nextNav }, '', targetHash);
        } catch {
          window.location.hash = targetHash;
        }
      }
    }
  }, []);

  // Ensure initial URL hash matches resolved activeNav and listen to Browser Back/Forward (popstate / hashchange)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentFromHash = parseNavFromHash(window.location.hash);
    if (!currentFromHash) {
      try {
        window.history.replaceState({ nav: activeNav }, '', formatHashForNav(activeNav));
      } catch {
        // ignore history error
      }
    }

    const syncFromLocation = () => {
      const parsed = parseNavFromHash(window.location.hash);
      if (parsed) {
        setActiveNavState(parsed);
        try {
          localStorage.setItem(NAV_STORAGE_KEY, parsed);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      window.removeEventListener('hashchange', syncFromLocation);
    };
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('osmolab_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Firebase Auth state (token kept strictly in memory per security guidelines)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  // Workspace Data State (starts empty/loading and hydrates strictly from typed APIs)
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [regulatoryLimits, setRegulatoryLimits] = useState<MaterialRegulatoryLimit[]>([]);
  const [scentMemories, setScentMemories] = useState<ScentMemoryRecord[]>([]);
  const [accords, setAccords] = useState<AccordDefinition[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [experiments, setExperiments] = useState<ExperimentEntry[]>([]);
  const [evaluations, setEvaluations] = useState<SensoryEvaluation[]>([]);
  const [usageReviews, setUsageReviews] = useState<MaterialUsageReview[]>([]);
  const [userShelfItems, setUserShelfItems] = useState<UserShelfItem[]>([]);

  // Active Selection State (persisted across reloads)
  const [activeFormulaId, setActiveFormulaId] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(ACTIVE_FORMULA_STORAGE_KEY));
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 0;
  });
  const [activeVersionLabel, setActiveVersionLabel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_VERSION_STORAGE_KEY);
      if (saved && saved.trim()) return saved;
    } catch {
      // ignore
    }
    return 'V1';
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SELECTED_MATERIAL_STORAGE_KEY));
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_FORMULA_STORAGE_KEY, String(activeFormulaId));
    } catch {
      // ignore
    }
  }, [activeFormulaId]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_VERSION_STORAGE_KEY, activeVersionLabel);
    } catch {
      // ignore
    }
  }, [activeVersionLabel]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_MATERIAL_STORAGE_KEY, String(selectedMaterialId));
    } catch {
      // ignore
    }
  }, [selectedMaterialId]);

  useEffect(() => {
    try {
      localStorage.setItem('osmolab_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // User Preferences & Configurable Dashboard Widgets & Theme
  const [theme, setTheme] = useState<ThemePaletteId>(() => {
    try {
      const stored = localStorage.getItem('osmolab_theme');
      if (
        stored === 'noir' ||
        stored === 'parchment' ||
        stored === 'creamy' ||
        stored === 'cypress' ||
        stored === 'grasse' ||
        stored === 'clinical'
      ) {
        return stored as ThemePaletteId;
      }
      if (stored === 'light') return 'parchment';
      if (stored === 'dark') return 'noir';
    } catch {
      // LocalStorage unavailable
    }
    return 'noir';
  });
  const [lang, setLang] = useState<AppLanguage>(() => {
    try {
      const stored = localStorage.getItem('osmolab_lang');
      if (stored === 'fa' || stored === 'en') return stored as AppLanguage;
    } catch {
      // LocalStorage unavailable
    }
    return 'en';
  });

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as NavSectionId, label: t('dashboard', lang), group: t('groupWorkspace', lang), icon: LayoutDashboard },
      { id: 'formula-lab' as NavSectionId, label: t('formulaLab', lang), group: t('groupWorkspace', lang), icon: FlaskConical },
      { id: 'formula-library' as NavSectionId, label: t('formulaLibrary', lang), group: t('groupWorkspace', lang), icon: Library },
      { id: 'raw-materials' as NavSectionId, label: t('rawMaterials', lang), group: t('groupEncyclopedia', lang), icon: Database },
      { id: 'accords' as NavSectionId, label: t('accords', lang), group: t('groupEncyclopedia', lang), icon: Layers },
      { id: 'scent-hierarchy' as NavSectionId, label: t('olfactoryPyramid', lang), group: t('groupOlfactory', lang), icon: OlfactoryPyramidIcon },
      { id: 'olfactory-wheel' as NavSectionId, label: t('olfactoryWheel', lang), group: t('groupOlfactory', lang), icon: Compass },
      { id: 'scent-memory' as NavSectionId, label: t('scentMemory', lang), group: t('groupOlfactory', lang), icon: Brain },
      { id: 'mentor' as NavSectionId, label: t('mentor', lang), group: t('groupOlfactory', lang), icon: Sparkles },
      { id: 'evaluations' as NavSectionId, label: t('evaluations', lang), group: t('groupBench', lang), icon: ClipboardCheck },
      { id: 'experiments' as NavSectionId, label: t('experiments', lang), group: t('groupBench', lang), icon: Clock },
      { id: 'search' as NavSectionId, label: t('search', lang), group: t('groupWorkspace', lang), icon: Search },
      { id: 'help' as NavSectionId, label: t('helpAndTutorial', lang), group: t('groupWorkspace', lang), icon: HelpCircle },
      { id: 'about' as NavSectionId, label: t('aboutAndPrivacy', lang), group: t('groupWorkspace', lang), icon: Info },
      { id: 'settings' as NavSectionId, label: t('settings', lang), group: t('groupWorkspace', lang), icon: Settings },
    ],
    [lang]
  );

  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [liveTourActive, setLiveTourActive] = useState<boolean>(false);
  const [liveTourStepIndex, setLiveTourStepIndex] = useState<number>(0);

  const handleSelectLiveTourStep = useCallback((stepIdx: number) => {
    const clamped = Math.max(0, Math.min(GUIDED_TOUR_STEPS.length - 1, stepIdx));
    setLiveTourStepIndex(clamped);
    setLiveTourActive(true);
    setActiveNav(GUIDED_TOUR_STEPS[clamped].targetNav);
  }, []);

  const [educationalPrompts, setEducationalPrompts] = useState<boolean>(true);
  const [safetyEnabled, setSafetyEnabled] = useState<boolean>(true);
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings>(() => {
    try {
      const raw = localStorage.getItem('osmolab_currency_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.activeCurrency && parsed.ratesFromUsd) {
          return { ...DEFAULT_CURRENCY_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore localStorage read errors
    }
    return DEFAULT_CURRENCY_SETTINGS;
  });
  const [isSyncingRates, setIsSyncingRates] = useState<boolean>(false);

  const handleUpdateCurrencySettings = useCallback((next: CurrencySettings) => {
    setCurrencySettings(next);
    try {
      localStorage.setItem('osmolab_currency_settings', JSON.stringify(next));
    } catch {
      // ignore localStorage write errors
    }
  }, []);

  const handleSyncLiveExchangeRates = useCallback(
    async (irrProfile: 'market' | 'nima' | 'official' = 'market') => {
      setIsSyncingRates(true);
      try {
        const res = await fetch(
          `/api/exchange-rates?irrProfile=${encodeURIComponent(irrProfile)}`
        );
        if (res.ok) {
          const data = await res.json();
          setCurrencySettings((prev) => {
            const nextIrr =
              data.ratesFromUsd?.IRR || prev.usdToIrrRate || 820000;
            const updated: CurrencySettings = {
              ...prev,
              rateMode: 'live',
              usdToIrrRate: nextIrr,
              ratesFromUsd: {
                ...prev.ratesFromUsd,
                ...(data.ratesFromUsd || {}),
                IRR: nextIrr,
              },
              lastUpdatedIso: data.lastUpdatedIso || new Date().toISOString(),
              rateSource:
                data.rateSource || 'ExchangeRate-API & Market Reference (Live)',
            };
            try {
              localStorage.setItem(
                'osmolab_currency_settings',
                JSON.stringify(updated)
              );
            } catch {
              // ignore
            }
            return updated;
          });
        }
      } catch {
        // retain current settings on network failure
      } finally {
        setIsSyncingRates(false);
      }
    },
    []
  );

  const [showWidgetCustomizer, setShowWidgetCustomizer] = useState<boolean>(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    currentWork: true,
    aging: true,
    activity: true,
    scentMemory: true,
    mentor: true,
  });

  // Handler for updating formula line items from Pyramid View or Formula Lab
  const handleUpdateFormulaLineItems = useCallback(
    (newItems: FormulaLineItem[]) => {
      setFormulas((prev) =>
        prev.map((f) => {
          if (f.id !== activeFormulaId) return f;
          return {
            ...f,
            updatedAt: new Date().toISOString().slice(0, 10),
            versions: f.versions.map((v) =>
              v.versionLabel === f.activeVersionLabel ? { ...v, items: newItems } : v
            ),
          };
        })
      );
    },
    [activeFormulaId]
  );

  // Build auth headers for authenticated backend requests (zero unverified client UID headers)
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
    return {};
  }, [idToken]);

  const applyServerWorkspace = useCallback((data: Record<string, unknown>) => {
    if (Array.isArray(data.materials) && data.materials.length > 0) {
      setMaterials(data.materials as RawMaterial[]);
    }
    if (Array.isArray(data.regulatoryLimits)) {
      setRegulatoryLimits(data.regulatoryLimits as MaterialRegulatoryLimit[]);
    }
    if (Array.isArray(data.scentMemories)) {
      setScentMemories(data.scentMemories as ScentMemoryRecord[]);
    }
    if (Array.isArray(data.accords)) {
      setAccords(data.accords as AccordDefinition[]);
    }
    if (Array.isArray(data.formulas) && data.formulas.length > 0) {
      const fList = data.formulas as Formula[];
      setFormulas(fList);
      setActiveFormulaId((prev) =>
        fList.some((f) => f.id === prev) ? prev : fList[0].id
      );
    }
    if (Array.isArray(data.experiments)) {
      setExperiments(data.experiments as ExperimentEntry[]);
    }
    if (Array.isArray(data.evaluations)) {
      setEvaluations(data.evaluations as SensoryEvaluation[]);
    }
    if (Array.isArray(data.usageReviews)) {
      setUsageReviews(data.usageReviews as MaterialUsageReview[]);
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
    });
    return () => unsub();
  }, []);

  const reloadWorkspaceData = useCallback(async () => {
    if (!idToken) return;
    const headers = getAuthHeaders();
    try {
      const [boot, shelfData, formulasData, accordsData] = await Promise.all([
        fetchBootstrapApi(headers).catch(() => null),
        fetchUserShelfApi(headers).catch(() => null),
        fetchFormulasApi(headers).catch(() => null),
        fetchAccordsApi(headers).catch(() => null),
      ]);
      if (boot?.user?.theme) {
        // sync user settings if returned
      }
      if (shelfData?.shelf) {
        setUserShelfItems(shelfData.shelf);
        const shelfMats: RawMaterial[] =
          (shelfData as unknown as { materials?: RawMaterial[] }).materials || [];
        setMaterials(shelfMats);
      }
      if (formulasData?.formulas) {
        setFormulas(formulasData.formulas);
        if (formulasData.formulas.length > 0) {
          setActiveFormulaId((prev) =>
            formulasData.formulas.some((f) => f.id === prev)
              ? prev
              : formulasData.formulas[0].id
          );
        }
      }
      if (accordsData?.accords) {
        setAccords(accordsData.accords);
      }
    } catch (err) {
      console.warn('Failed to load user workspace data:', err);
    }
  }, [idToken, getAuthHeaders]);

  // Load user data strictly when authenticated with a verified Firebase ID token
  useEffect(() => {
    reloadWorkspaceData();
  }, [reloadWorkspaceData]);

  // Lazy-load bench modules on navigation
  useEffect(() => {
    if (!idToken) return;
    const headers = getAuthHeaders();
    if (activeNav === 'evaluations' && evaluations.length === 0) {
      fetchEvaluationsApi(headers)
        .then((res) => {
          if (res.evaluations) setEvaluations(res.evaluations);
        })
        .catch(() => {});
    } else if (activeNav === 'experiments' && experiments.length === 0) {
      fetchExperimentsApi(headers)
        .then((res) => {
          if (res.experiments) setExperiments(res.experiments);
        })
        .catch(() => {});
    } else if (activeNav === 'scent-memory' && scentMemories.length === 0) {
      fetchScentMemoriesApi(headers)
        .then((res) => {
          if (res.scentMemories) setScentMemories(res.scentMemories);
        })
        .catch(() => {});
    }
  }, [activeNav, idToken, getAuthHeaders, evaluations.length, experiments.length, scentMemories.length]);

  // Shelf & Workbench handlers (Global Catalog -> My Shelf -> Current Workbench -> Formula)
  const handleAddToShelf = useCallback(
    async (
      materialId: number,
      payload: {
        supplierName?: string | null;
        supplierProductName?: string | null;
        workingDilutionPct?: number | null;
        personalNotes?: string | null;
        isOnWorkbench?: boolean;
        pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
        favorite?: boolean;
      } = {}
    ) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId
            ? {
                ...m,
                isOnShelf: true,
                isOnWorkbench: payload.isOnWorkbench ?? m.isOnWorkbench ?? false,
                supplier: payload.supplierName ?? m.supplier,
                supplierProductName: payload.supplierProductName ?? m.supplierProductName,
                workingDilutionPct:
                  payload.workingDilutionPct ?? m.workingDilutionPct ?? m.recommendedDilution,
                personalNotes: payload.personalNotes ?? m.personalNotes,
                pyramidOverrideCode:
                  payload.pyramidOverrideCode !== undefined
                    ? payload.pyramidOverrideCode
                    : m.pyramidOverrideCode,
                favorite: payload.favorite ?? m.favorite,
              }
            : m
        )
      );
      if (!idToken) return;
      try {
        const res = await addToShelfApi(
          materialId,
          {
            supplierName: payload.supplierName || undefined,
            supplierProductName: payload.supplierProductName || undefined,
            workingDilutionPct: payload.workingDilutionPct,
            personalNotes: payload.personalNotes || undefined,
            isOnWorkbench: payload.isOnWorkbench,
            pyramidOverrideCode: payload.pyramidOverrideCode,
            favorite: payload.favorite,
          },
          getAuthHeaders()
        );
        if (res.item) {
          setUserShelfItems((prev) => {
            const idx = prev.findIndex((s) => s.materialId === materialId);
            return idx >= 0
              ? prev.map((s, i) => (i === idx ? res.item : s))
              : [...prev, res.item];
          });
        }
      } catch (err) {
        console.warn('Shelf addition failed:', err);
      }
    },
    [idToken, getAuthHeaders]
  );

  const handleUpdateShelfItem = useCallback(
    async (
      materialId: number,
      payload: {
        supplierName?: string | null;
        supplierProductName?: string | null;
        workingDilutionPct?: number | null;
        personalNotes?: string | null;
        isOnWorkbench?: boolean;
        pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
        favorite?: boolean;
      }
    ) => {
      setMaterials((prev) =>
        prev.map((m) => {
          if (m.id !== materialId) return m;
          const nextOnShelf = m.isOnShelf || Boolean(payload.isOnWorkbench);
          return {
            ...m,
            isOnShelf: nextOnShelf,
            isOnWorkbench:
              payload.isOnWorkbench !== undefined ? payload.isOnWorkbench : m.isOnWorkbench,
            supplier:
              payload.supplierName !== undefined && payload.supplierName !== null
                ? payload.supplierName
                : m.supplier,
            supplierProductName:
              payload.supplierProductName !== undefined
                ? payload.supplierProductName || ''
                : m.supplierProductName,
            workingDilutionPct:
              payload.workingDilutionPct !== undefined
                ? payload.workingDilutionPct
                : m.workingDilutionPct,
            recommendedDilution:
              payload.workingDilutionPct !== undefined && payload.workingDilutionPct !== null
                ? payload.workingDilutionPct
                : m.recommendedDilution,
            personalNotes:
              payload.personalNotes !== undefined && payload.personalNotes !== null
                ? payload.personalNotes
                : m.personalNotes,
            pyramidOverrideCode:
              payload.pyramidOverrideCode !== undefined
                ? payload.pyramidOverrideCode
                : m.pyramidOverrideCode,
            favorite: payload.favorite !== undefined ? payload.favorite : m.favorite,
          };
        })
      );
      if (!idToken) return;
      try {
        const res = await updateShelfItemApi(
          materialId,
          {
            supplierName: payload.supplierName || undefined,
            supplierProductName: payload.supplierProductName || undefined,
            workingDilutionPct: payload.workingDilutionPct,
            personalNotes: payload.personalNotes || undefined,
            isOnWorkbench: payload.isOnWorkbench,
            pyramidOverrideCode: payload.pyramidOverrideCode,
            favorite: payload.favorite,
          },
          getAuthHeaders()
        );
        if (res.item) {
          setUserShelfItems((prev) =>
            prev.map((s) => (s.materialId === materialId ? res.item : s))
          );
        }
      } catch (err) {
        console.warn('Shelf update failed:', err);
      }
    },
    [idToken, getAuthHeaders]
  );

  const handleRemoveFromShelf = useCallback(
    async (materialId: number) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId ? { ...m, isOnShelf: false, isOnWorkbench: false } : m
        )
      );
      if (!idToken) return;
      try {
        await removeFromShelfApi(materialId, getAuthHeaders());
        setUserShelfItems((prev) => prev.filter((s) => s.materialId !== materialId));
      } catch (err) {
        console.warn('Shelf removal failed:', err);
      }
    },
    [idToken, getAuthHeaders]
  );

  // Retry handler passed to TabErrorBoundary to recover view state and reload workspace data
  const handleRetryViewData = useCallback(() => {
    void reloadWorkspaceData();
  }, [reloadWorkspaceData]);

  // Synchronize Dark / Light and 6 Palettes with <html> data-theme and classes
  useEffect(() => {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute('data-theme', theme);
    if (theme === 'parchment' || theme === 'clinical' || theme === 'creamy') {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
    } else {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
    }
    try {
      localStorage.setItem('osmolab_theme', theme);
    } catch {
      // LocalStorage unavailable
    }
  }, [theme]);

  // Synchronize Language and LTR / RTL direction
  useEffect(() => {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute('lang', lang);
    htmlEl.setAttribute('dir', getDir(lang));
    try {
      localStorage.setItem('osmolab_lang', lang);
    } catch {
      // LocalStorage unavailable
    }
  }, [lang]);

  // Keyboard shortcut: Cmd/Ctrl + K for Global Search Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
    } catch (error) {
      console.warn('Google sign-in popup closed or blocked in preview iframe:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setIdToken(null);
    setMaterials([]);
    setRegulatoryLimits([]);
    setScentMemories([]);
    setAccords([]);
    setFormulas([]);
    setExperiments([]);
    setEvaluations([]);
    setUsageReviews([]);
    setUserShelfItems([]);
    setActiveFormulaId(0);
    setActiveVersionLabel('V1');
    setSelectedMaterialId(0);
  };

const BLANK_DRAFT_FORMULA: Formula = {
  id: 0,
  projectId: null,
  projectName: 'Personal Formulation',
  name: 'New Fragrance Study',
  status: 'Draft',
  description: 'Initial formulation draft session.',
  intendedProduct: 'Eau de Parfum (20% conc.)',
  ifraCategory: 'Category 4 (Fine Fragrance)',
  finalProductConcentration: 20,
  targetBrief: 'Harmonious opening with balanced heart structure and enduring drydown.',
  targetFamilies: ['Green', 'Citrus', 'Woody'],
  targetFacets: { Green: 7, Woody: 6, Citrus: 5, Musky: 5 },
  targetIntensity: 7,
  targetTexture: 'Fresh, airy with botanical clarity',
  targetAtmosphere: 'Luminous morning botanical garden',
  targetTemperature: 'Cool',
  targetColor: '#2E6F40',
  targetMood: 'Uplifting & focused',
  targetDiffusion: 7,
  targetEvolution: 'Crisp green opening yielding to a radiant transparent woody heart',
  targetDrydown: 'Clean skin-scent warmth with subtle resinous cedar persistence',
  materialsToAvoid: [],
  isFavorite: false,
  tags: ['Study', 'Custom'],
  activeVersionLabel: 'V1',
  versions: [
    {
      id: 0,
      formulaId: 0,
      parentVersionId: null,
      versionLabel: 'V1',
      status: 'Draft',
      versionNotes: 'Initial formulation draft',
      maturationDays: 14,
      items: [],
      createdAt: new Date().toISOString().slice(0, 10),
    },
  ],
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
};

  const activeFormula: Formula =
    formulas.find((f) => f.id === activeFormulaId) || formulas[0] || BLANK_DRAFT_FORMULA;


  // Handlers for PostgreSQL mutations with optimistic updates
  const handleSaveFormulaVersion = async (
    formulaPayload: Partial<Formula> & { id?: number; name: string },
    versionPayload: {
      versionLabel: string;
      parentVersionId?: number | null;
      status: 'Draft' | 'Committed';
      versionNotes: string;
      maturationDays: number;
      items: FormulaLineItem[];
    }
  ) => {
    // Optimistic update
    setFormulas((prev) => {
      const existingIdx = prev.findIndex((f) => f.id === formulaPayload.id);
      if (existingIdx >= 0) {
        const target = prev[existingIdx];
        const verExists = target.versions.some(
          (v) => v.versionLabel === versionPayload.versionLabel
        );
        const nextVersions = verExists
          ? target.versions.map((v) =>
              v.versionLabel === versionPayload.versionLabel
                ? { ...v, items: versionPayload.items, versionNotes: versionPayload.versionNotes }
                : v
            )
          : [
              ...target.versions,
              {
                id: Date.now(),
                formulaId: target.id,
                parentVersionId: versionPayload.parentVersionId ?? null,
                versionLabel: versionPayload.versionLabel,
                status: versionPayload.status,
                versionNotes: versionPayload.versionNotes,
                maturationDays: versionPayload.maturationDays,
                items: versionPayload.items,
                createdAt: new Date().toISOString().slice(0, 10),
              },
            ];
        const updatedFormula: Formula = {
          ...target,
          ...formulaPayload,
          activeVersionLabel: versionPayload.versionLabel,
          versions: nextVersions,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        const copy = [...prev];
        copy[existingIdx] = updatedFormula;
        return copy;
      } else {
        const newId = Date.now();
        const created: Formula = {
          id: newId,
          projectId: 1,
          projectName: formulaPayload.projectName || 'Personal Study',
          name: formulaPayload.name,
          status: formulaPayload.status || 'Draft',
          description: formulaPayload.description || '',
          intendedProduct: formulaPayload.intendedProduct || 'Eau de Parfum (20% conc.)',
          ifraCategory: formulaPayload.ifraCategory || 'Category 4 (Fine Fragrance)',
          finalProductConcentration: formulaPayload.finalProductConcentration ?? 20,
          targetBrief: formulaPayload.targetBrief || '',
          targetFamilies: formulaPayload.targetFamilies || ['Green'],
          targetFacets: formulaPayload.targetFacets || { Green: 7 },
          targetIntensity: 7,
          targetTexture: '',
          targetAtmosphere: '',
          targetTemperature: 'Cool',
          targetColor: '#2E6F40',
          targetMood: '',
          targetDiffusion: 7,
          targetEvolution: '',
          targetDrydown: '',
          materialsToAvoid: [],
          isFavorite: false,
          tags: ['New-Study'],
          activeVersionLabel: versionPayload.versionLabel,
          versions: [
            {
              id: Date.now() + 1,
              formulaId: newId,
              parentVersionId: null,
              versionLabel: versionPayload.versionLabel,
              status: versionPayload.status,
              versionNotes: versionPayload.versionNotes,
              maturationDays: versionPayload.maturationDays,
              items: versionPayload.items,
              createdAt: new Date().toISOString().slice(0, 10),
            },
          ],
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        setActiveFormulaId(newId);
        return [...prev, created];
      }
    });
    setActiveVersionLabel(versionPayload.versionLabel);

    if (!idToken) return;
    try {
      const res = await fetch('/api/formulas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ formula: formulaPayload, version: versionPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Queued formula save locally:', err);
    }
  };

  const handleCreateMaterial = async (
    payload: Omit<RawMaterial, 'id'> & {
      maxAllowedPercent?: number | null;
      ifraSource?: string;
    }
  ) => {
    const tempId = Date.now();
    setMaterials((prev) => [...prev, { ...payload, id: tempId }]);
    setSelectedMaterialId(tempId);

    if (!idToken) return;
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Saved material to local cache:', err);
    }
  };

  const handleCreateAccord = async (payload: Omit<AccordDefinition, 'id'>) => {
    setAccords((prev) => [...prev, { ...payload, id: Date.now() }]);
    if (!idToken) return;
    try {
      const res = await fetch('/api/accords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Saved accord to local cache:', err);
    }
  };

  const handleUpdateAccord = (updatedAccord: AccordDefinition) => {
    setAccords((prev) =>
      prev.map((acc) => (acc.id === updatedAccord.id ? updatedAccord : acc))
    );
  };

  const handleDeleteAccord = (accordId: number) => {
    setAccords((prev) => prev.filter((acc) => acc.id !== accordId));
  };

  const handleAddExperiment = async (entry: Omit<ExperimentEntry, 'id'>) => {
    setExperiments((prev) => [{ ...entry, id: Date.now() }, ...prev]);
    if (!idToken) return;
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Saved experiment locally:', err);
    }
  };

  const handleAddEvaluation = async (
    evaluation: Omit<SensoryEvaluation, 'id' | 'createdAt'>
  ) => {
    setEvaluations((prev) => [
      {
        ...evaluation,
        id: Date.now(),
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      },
      ...prev,
    ]);
    if (!idToken) return;
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(evaluation),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Saved evaluation locally:', err);
    }
  };

  const handleSaveScentMemory = async (
    record: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
  ) => {
    setScentMemories((prev) => {
      const idx = prev.findIndex((m) => m.materialId === record.materialId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...record, lastReviewedAt: '2026-10-23' };
        return copy;
      }
      return [
        ...prev,
        { ...record, id: Date.now(), lastReviewedAt: '2026-10-23' },
      ];
    });
    if (!idToken) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerWorkspace(data);
      }
    } catch (err) {
      console.warn('Saved scent memory locally:', err);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0B0E14] text-slate-100" dir={getDir(lang)}>
      <OfflineIndicator />

      {/* Desktop Collapsible Sidebar (15 Navigation Sections) */}
      <aside
        className={`hidden lg:flex flex-col justify-between border-r border-slate-800/90 bg-[#0E121B] shrink-0 transition-all ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
        aria-label="Primary Laboratory Navigation"
      >
        <div className="p-3 space-y-4">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800/80">
            {!sidebarCollapsed && (
              <span className="text-lg font-sans font-bold tracking-tight text-white whitespace-nowrap">
                OsmoLab
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-2">
            <div className="truncate">
              Account:{' '}
              <span className="text-slate-200 font-medium">
                {firebaseUser ? firebaseUser.email : 'Perfumery Studio'}
              </span>
            </div>
            {!firebaseUser && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                Continue with Google
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        {/* Top Bar Contract: Responsive across all viewports (320px - 1920px+) with z-40 stacking above main stage */}
        <header className="relative z-40 w-full max-w-full grid grid-cols-1 gap-2 px-3 sm:px-5 py-2.5 border-b border-slate-800/90 bg-[#0E121B]">
          {/* Row 1: Flexible wrapping top row with shrink-0 Brand Title and Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
            {/* Zone 1: Brand / Mobile menu trigger */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open mobile navigation"
                className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md text-slate-300 hover:text-white bg-slate-800 shrink-0"
              >
                <Menu className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                title="Return to Studio Overview Dashboard"
                className="shrink-0 whitespace-nowrap text-sm sm:text-base font-sans font-bold tracking-tight text-white hover:text-emerald-400 transition-colors py-1 text-left"
              >
                {t('appTitle', lang)}
              </button>
            </div>

            {/* Zone 3: Primary Actions (Dark/Light Mode, Theme Palette Picker, Language, PWA, Search) */}
            <div className="flex items-center justify-end gap-1 sm:gap-1.5 md:gap-2 shrink-0 ml-auto">
              {/* Quick 1-Click Dark / Day (White & Silver) Mode Toggle */}
              <button
                type="button"
                data-testid="toggle-day-night-btn"
                onClick={() =>
                  setTheme((prev) =>
                    prev === 'parchment' || prev === 'clinical' || prev === 'creamy'
                      ? 'noir'
                      : 'parchment'
                  )
                }
                aria-label="Toggle Dark / Light Mode"
                title={
                  theme === 'parchment' || theme === 'clinical' || theme === 'creamy'
                    ? 'Switch to Dark Mode (Atelier Noir)'
                    : 'Switch to Day Theme (Studio White & Silver)'
                }
                className="h-8 w-8 text-xs text-slate-300 hover:text-white bg-[#111621] border border-slate-800 rounded-md hover:border-slate-700 transition-colors flex items-center justify-center shrink-0"
              >
                {theme === 'parchment' || theme === 'clinical' || theme === 'creamy' ? (
                  <Moon className="w-4 h-4 text-slate-700 shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </button>

              {/* 6-Theme Palette Quick Picker Popover */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  data-testid="header-theme-picker-btn"
                  onClick={() => setThemePickerOpen((v) => !v)}
                  aria-label="Select Color Theme"
                  title="Change Color Theme Palette"
                  className="h-8 px-2 sm:px-2.5 text-xs font-medium text-slate-200 bg-[#111621] border border-slate-800 rounded-md hover:border-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Palette className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="hidden md:inline capitalize font-mono text-[11px] shrink-0 whitespace-nowrap">
                    {THEME_OPTIONS.find((t) => t.id === theme)?.name || theme}
                  </span>
                </button>

                {themePickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[90]"
                      onClick={() => setThemePickerOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[min(19.5rem,calc(100vw-1.5rem))] rounded-xl bg-[#111621] border border-slate-700 shadow-2xl ring-1 ring-black/60 p-3 z-[110] space-y-2 text-xs"
                      role="menu"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="font-semibold text-white">Color Palettes (6 Themes)</span>
                        <button
                          type="button"
                          onClick={() => setThemePickerOpen(false)}
                          aria-label="Close theme picker"
                          className="text-slate-400 hover:text-white p-0.5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-[80dvh] sm:max-h-none overflow-y-auto">
                        {THEME_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={`theme-option-${opt.id}`}
                            onClick={() => {
                              setTheme(opt.id);
                              setThemePickerOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-center justify-between border ${
                              theme === opt.id
                                ? 'bg-emerald-600/15 border-emerald-500/50 text-white'
                                : 'bg-[#0B0E14] border-slate-800/80 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold flex items-center gap-1.5 text-xs">
                                <span className="truncate">{opt.name}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-mono shrink-0">
                                  ({opt.mode})
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                                {opt.subtitle.split('·')[0]}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20"
                                style={{ backgroundColor: opt.bgHex }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20"
                                style={{ backgroundColor: opt.accentHex }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Language Switcher (EN / FA Persian) */}
              <button
                type="button"
                onClick={() => setLang((prev) => (prev === 'en' ? 'fa' : 'en'))}
                aria-label="Toggle Language"
                title={lang === 'en' ? 'Switch to Persian (FA)' : 'Switch to English (EN)'}
                className="h-8 px-2 sm:px-2.5 text-xs font-semibold text-slate-200 bg-[#111621] border border-slate-800 rounded-md hover:border-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px] sm:hidden">
                  {lang === 'en' ? 'FA' : 'EN'}
                </span>
                <span className="hidden sm:inline font-mono text-[11px]">
                  {lang === 'en' ? 'EN / FA' : 'FA / EN'}
                </span>
              </button>

              <PWAInstallButton />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Search (⌘K)"
                className="h-8 px-2 sm:px-3 text-xs font-medium text-slate-200 bg-[#111621] border border-slate-800 rounded-md hover:border-slate-700 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Search</span>
                <span className="hidden xl:inline text-slate-400 font-mono text-[10px]">(Ctrl+K)</span>
              </button>
            </div>
          </div>

          {/* Row 2: Schematic Formula Development Route in Dedicated Overflow-X Container */}
          <nav
            data-testid="formula-development-route"
            className="w-full max-w-full min-w-0 flex flex-col gap-1.5 pt-2 border-t border-slate-800/60 text-xs font-normal"
            aria-label="Schematic Route of Developing a Formula"
          >
            {(() => {
              const routeSteps = [
                {
                  step: '1',
                  id: 'raw-materials' as NavSectionId,
                  label: lang === 'fa' ? '۱. مواد اولیه' : '1. Palette',
                  sub: 'Materials',
                  icon: Database,
                },
                {
                  step: '2',
                  id: 'accords' as NavSectionId,
                  label: lang === 'fa' ? '۲. آکوردها' : '2. Accords',
                  sub: 'Bases',
                  icon: Layers,
                },
                {
                  step: '3',
                  id: 'olfactory-wheel' as NavSectionId,
                  label: lang === 'fa' ? '۳. چرخه بویایی' : '3. Wheel',
                  sub: 'Families',
                  icon: Compass,
                },
                {
                  step: '4',
                  id: 'scent-hierarchy' as NavSectionId,
                  label: lang === 'fa' ? '۴. هرم بویایی' : '4. Pyramid',
                  sub: 'Volatility',
                  icon: OlfactoryPyramidIcon,
                },
                {
                  step: '5',
                  id: 'formula-lab' as NavSectionId,
                  label: lang === 'fa' ? '۵. آزمایشگاه فرمول' : '5. Formula Lab',
                  sub: 'Compose',
                  icon: FlaskConical,
                },
                {
                  step: '6',
                  id: 'evaluations' as NavSectionId,
                  label: lang === 'fa' ? '۶. ارزیابی و مربی' : '6. Evaluate',
                  sub: 'Blotter',
                  icon: ClipboardCheck,
                },
              ];
              const activeRouteIdx = routeSteps.findIndex(
                (rs) =>
                  activeNav === rs.id ||
                  (rs.id === 'evaluations' && activeNav === 'mentor') ||
                  (rs.id === 'formula-lab' && activeNav === 'formula-library')
              );
              const activeRouteStep = activeRouteIdx >= 0 ? routeSteps[activeRouteIdx] : null;
              const nextRouteStep =
                activeRouteIdx >= 0 && activeRouteIdx < routeSteps.length - 1
                  ? routeSteps[activeRouteIdx + 1]
                  : null;

              return (
                <>
                  {/* Mobile Route Flow Header: Shows Current Step & Next Step Direction Clearly */}
                  <div className="flex sm:hidden items-center justify-between gap-2 w-full min-w-0 px-0.5 text-[11px] font-mono-tabular">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold min-w-0 truncate">
                      <Compass className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {activeRouteStep
                          ? `Route Step ${activeRouteStep.step}/6: ${activeRouteStep.label.replace(/^[0-9۱-۶]+\.\s*/, '')}`
                          : 'Formula Route (6 Steps)'}
                      </span>
                    </span>
                    {nextRouteStep ? (
                      <button
                        type="button"
                        onClick={() => setActiveNav(nextRouteStep.id)}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/80 shrink-0 whitespace-nowrap"
                      >
                        <span>Next: {nextRouteStep.label}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                      </button>
                    ) : (
                      <span className="text-slate-400 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <span>Swipe Flow</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                      </span>
                    )}
                  </div>

                  {/* Horizontally Scrollable Step Chain with Visible Graphical Guidance Arrows Across All Viewports */}
                  <div className="w-full max-w-full min-w-0 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 sm:pb-0.5 no-scrollbar">
                    <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mr-1 shrink-0 whitespace-nowrap">
                      Formula Route:
                    </span>
                    {routeSteps.map((routeStep, idx, arr) => {
                      const StepIcon = routeStep.icon;
                      const isStepActive =
                        activeNav === routeStep.id ||
                        (routeStep.id === 'evaluations' && activeNav === 'mentor') ||
                        (routeStep.id === 'formula-lab' && activeNav === 'formula-library');
                      const isCompleted = activeRouteIdx > idx;

                      return (
                        <React.Fragment key={routeStep.id}>
                          <button
                            type="button"
                            data-testid={`route-step-${routeStep.id}`}
                            onClick={() => setActiveNav(routeStep.id)}
                            className={`px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-md text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                              isStepActive
                                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold shadow-xs ring-2 ring-emerald-500/30'
                                : isCompleted
                                ? 'bg-emerald-950/30 text-emerald-300 border-emerald-700/50 font-medium hover:border-emerald-500'
                                : 'bg-[#111621] text-slate-300 border-slate-800/80 font-normal hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            <StepIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isStepActive ? 'text-white' : 'text-emerald-400'
                              }`}
                            />
                            <span>{routeStep.label}</span>
                          </button>

                          {idx < arr.length - 1 && (
                            <span
                              data-testid={`route-arrow-${idx + 1}`}
                              className={`inline-flex items-center justify-center shrink-0 px-0.5 ${
                                isStepActive
                                  ? 'text-emerald-400 scale-110'
                                  : isCompleted
                                  ? 'text-emerald-400/80'
                                  : 'text-slate-400'
                              }`}
                              aria-hidden="true"
                              title={`Proceed from ${routeStep.label} to ${arr[idx + 1].label}`}
                            >
                              <svg
                                viewBox="0 0 22 12"
                                className="w-5 h-3 shrink-0"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M1 6H19M19 6L14 1.5M19 6L14 10.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Olfactory Mentor placed directly next to the last menu (6. Evaluate) */}
                    <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-800 shrink-0">
                      <button
                        type="button"
                        data-testid="header-mentor-btn"
                        onClick={() => setActiveNav('mentor')}
                        className={`px-3 py-1.5 sm:py-1 rounded-md text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                          activeNav === 'mentor'
                            ? 'bg-amber-600 text-white border-amber-500 font-semibold'
                            : 'bg-[#111621] text-slate-300 border-slate-800/80 hover:border-slate-700 hover:text-white font-normal'
                        }`}
                      >
                        <Sparkles
                          className={`w-3.5 h-3.5 shrink-0 ${
                            activeNav === 'mentor' ? 'text-white' : 'text-amber-400'
                          }`}
                        />
                        <span>{t('mentor', lang)}</span>
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </nav>
        </header>

        {/* Main Workspace Stage — Closes transient mobile/theme menus without collapsing desktop sidebar */}
        <main
          onClick={() => {
            if (mobileMenuOpen) setMobileMenuOpen(false);
            if (themePickerOpen) setThemePickerOpen(false);
          }}
          className="flex-1 p-3.5 sm:p-6 lg:p-8 lg:px-10 max-w-[1440px] w-full mx-auto min-w-0 space-y-6 sm:space-y-7"
        >
          <div key={activeNav} className="animate-section-fade-in space-y-6 sm:space-y-7 w-full min-w-0">
          {/* 1. DASHBOARD VIEW */}
          {activeNav === 'dashboard' && (
            <TabErrorBoundary
              activeSection="dashboard"
              sectionTitle={TAB_INSTRUCTION_GUIDE.dashboard.title}
              onRetry={handleRetryViewData}
            >
            <div className="space-y-8 w-full max-w-full min-w-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
                <div>
                  <h1 className="text-2xl font-sans font-semibold text-white">
                    Perfumery Formulation & Olfactory Learning Studio
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 font-normal">
                    Monitor active fragrance formulas, maturation checkpoints, version lineages, and scent memory progress in one workspace.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowWidgetCustomizer((v) => !v)}
                    className="justify-center px-3.5 py-2 sm:py-1.5 bg-[#111621] border border-slate-800 hover:border-slate-700 text-xs font-normal text-slate-300 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Configure Widgets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav('formula-lab')}
                    className="justify-center px-4 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-normal rounded-md transition-colors flex items-center whitespace-nowrap shrink-0"
                  >
                    Open Formula Lab →
                  </button>
                </div>
              </div>

              {/* Widget Customizer Bar */}
              {showWidgetCustomizer && (
                <div className="p-4 rounded-lg bg-[#111621] border border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-medium text-white">Visible Dashboard Widgets:</span>
                  {[
                    { key: 'currentWork', label: 'Current Work' },
                    { key: 'aging', label: 'Aging / Maceration' },
                    { key: 'activity', label: 'Formula Activity' },
                    { key: 'scentMemory', label: 'Scent Memory' },
                    { key: 'mentor', label: 'Olfactory Mentor' },
                  ].map((w) => (
                    <label
                      key={w.key}
                      className="flex items-center gap-1.5 text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleWidgets[w.key]}
                        onChange={(e) =>
                          setVisibleWidgets((prev) => ({
                            ...prev,
                            [w.key]: e.target.checked,
                          }))
                        }
                        className="accent-emerald-500"
                      />
                      <span>{w.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Dashboard Configurable Widgets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Widget 1: Current Work */}
                {visibleWidgets.currentWork && (
                  <div className="rounded-xl bg-[#111621] border border-slate-800/70 p-6 flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-white">01. Current Work</span>
                        <span className="font-mono-tabular">{formulas.length} Active</span>
                      </div>
                      <div className="space-y-2.5">
                        {formulas.map((f) => (
                          <div
                            key={f.id}
                            className="p-3 rounded bg-[#0B0E14] border border-slate-800/90 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-white">
                                {f.name} ({f.activeVersionLabel})
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {f.projectName} · {f.status} · Updated {f.updatedAt}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFormulaId(f.id);
                                setActiveVersionLabel(f.activeVersionLabel);
                                setActiveNav('formula-lab');
                              }}
                              className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0"
                            >
                              Formulate →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('formula-library')}
                      className="text-xs text-slate-400 hover:text-white text-left pt-2 border-t border-slate-800/80"
                    >
                      View Full Formula Library →
                    </button>
                  </div>
                )}

                {/* Widget 2: Aging / Maceration Checkpoints Due Today */}
                {visibleWidgets.aging && (
                  <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-white">
                          02. Aging & Maceration Checkpoints
                        </span>
                        <span className="text-amber-400 font-mono-tabular">3 Due Today</span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">Forest Study V5</span>
                            <span className="font-mono-tabular text-amber-400">
                              Day 7 Evaluation Due
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Check Oakmoss integration & Cedar dryness
                          </p>
                        </div>
                        <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">White Floral V4</span>
                            <span className="font-mono-tabular text-emerald-400">
                              Day 14 Checkpoint
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Evaluate 18% Hedione solar jasmine radiance
                          </p>
                        </div>
                        <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">Tea Experiment V3</span>
                            <span className="font-mono-tabular text-emerald-400">
                              Day 30 Maturation Ready
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Final 30-day Vetiver Haiti & Violet Leaf review
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('evaluations')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 text-left pt-2 border-t border-slate-800/80"
                    >
                      Record Maturation Evaluation →
                    </button>
                  </div>
                )}

                {/* Widget 3: Formula Version Activity */}
                {visibleWidgets.activity && (
                  <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-white">
                          03. Recent Version Lineage & Diffs
                        </span>
                        <span className="font-mono-tabular">Forest Project</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {activeFormula ? (
                          activeFormula.versions.slice(-3).reverse().map((v) => (
                            <div
                              key={v.id}
                              className="p-3 rounded bg-[#0B0E14] border border-slate-800"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono-tabular font-semibold text-emerald-400">
                                  {activeFormula.name} — {v.versionLabel}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {v.status} · {v.createdAt}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                                {v.versionNotes}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 rounded bg-[#0B0E14] border border-slate-800 text-slate-500 italic">
                            No active formula loaded.
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('formula-lab')}
                      className="text-xs text-slate-400 hover:text-white text-left pt-2 border-t border-slate-800/80"
                    >
                      Compare V4 vs V5 in Formula Lab →
                    </button>
                  </div>
                )}

                {/* Widget 5: Scent Memory Recognition */}
                {visibleWidgets.scentMemory && (
                  <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-white">
                          05. Scent Memory & Recognition
                        </span>
                        <span className="font-mono-tabular text-emerald-400">
                          4 Studied
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        {scentMemories.slice(0, 4).map((mem) => {
                          const mat = materials.find((m) => m.id === mem.materialId);
                          const pct =
                            mem.recognitionTrials > 0
                              ? Math.round(
                                  (mem.recognitionCorrect / mem.recognitionTrials) * 100
                                )
                              : 0;
                          return (
                            <div
                              key={mem.id}
                              className="flex items-center justify-between p-2.5 rounded bg-[#0B0E14] border border-slate-800"
                            >
                              <div>
                                <div className="font-semibold text-white">
                                  {mat?.name}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {mem.myPerception.slice(0, 3).join(' · ')}
                                </div>
                              </div>
                              <span className="font-mono-tabular font-semibold text-emerald-400">
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('scent-memory')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 text-left pt-2 border-t border-slate-800/80"
                    >
                      Start Blind Smelling Drill →
                    </button>
                  </div>
                )}

                {/* Widget 6: Olfactory Mentor Observation */}
                {visibleWidgets.mentor && (
                  <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          06. Olfactory Mentor Insight
                        </span>
                        <span className="text-[11px] font-mono-tabular text-emerald-400">
                          High Confidence
                        </span>
                      </div>
                      <div className="p-3.5 rounded bg-[#0B0E14] border border-slate-800 space-y-2 text-xs">
                        <div className="font-semibold text-white">
                          Suggested Next Experiment for Forest Study V5:
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          Your 1-hour blotter evaluation noted excessive woody dryness from Virginia Cedarwood (10%) and Cashmeran (4%). Try a 10 g trial reducing Cashmeran to 2.5% and increasing Helvetolide (+1.5%) for airy unsweetened softness.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('mentor')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 text-left pt-2 border-t border-slate-800/80"
                    >
                      Open Mentor & Generate 3 Controlled Trials →
                    </button>
                  </div>
                )}
              </div>
            </div>
            </TabErrorBoundary>
          )}

          {/* 2 & 3. FORMULA LAB & FORMULA LIBRARY */}
          {(activeNav === 'formula-lab' || activeNav === 'formula-library') && (
            <TabErrorBoundary
              activeSection={activeNav}
              sectionTitle={TAB_INSTRUCTION_GUIDE[activeNav].title}
              onRetry={handleRetryViewData}
            >
            <FormulaLabView
              mode={activeNav === 'formula-library' ? 'library' : 'lab'}
              formulas={formulas}
              activeFormula={activeFormula}
              activeVersionLabel={activeVersionLabel}
              materials={materials}
              accords={accords}
              regulatoryLimits={regulatoryLimits}
              evaluations={evaluations}
              educationalPromptsEnabled={educationalPrompts}
              safetyEnabled={safetyEnabled}
              currencySettings={currencySettings}
              onUpdateCurrencySettings={handleUpdateCurrencySettings}
              onSyncLiveExchangeRates={handleSyncLiveExchangeRates}
              isSyncingRates={isSyncingRates}
              onOpenSettings={() => setActiveNav('settings')}
              onSelectFormula={(id, ver) => {
                setActiveFormulaId(id);
                if (ver) setActiveVersionLabel(ver);
                setActiveNav('formula-lab');
              }}
              onSaveFormulaVersion={handleSaveFormulaVersion}
              onOpenMentor={() => setActiveNav('mentor')}
              onInspectMaterial={(matId) => {
                setSelectedMaterialId(matId);
                setActiveNav('raw-materials');
              }}
              onAddToShelf={(matId) => {
                void handleAddToShelf(matId, { isOnWorkbench: false });
              }}
            />
            </TabErrorBoundary>
          )}

          {/* 4 & 8. RAW MATERIALS & ACCORDS */}
          {(activeNav === 'raw-materials' || activeNav === 'accords') && (
            <TabErrorBoundary
              activeSection={activeNav}
              sectionTitle={TAB_INSTRUCTION_GUIDE[activeNav].title}
              onRetry={handleRetryViewData}
            >
            <MaterialCatalogView
              mode={activeNav === 'raw-materials' ? 'materials' : 'accords'}
              materials={materials}
              selectedMaterialId={selectedMaterialId}
              regulatoryLimits={regulatoryLimits}
              scentMemories={scentMemories}
              usageReviews={usageReviews}
              accords={accords}
              formulas={formulas}
              educationalPromptsEnabled={educationalPrompts}
              onSelectMaterial={(id) => setSelectedMaterialId(id)}
              onCreateMaterial={handleCreateMaterial}
              onCreateAccord={handleCreateAccord}
              onUpdateAccord={handleUpdateAccord}
              onDeleteAccord={handleDeleteAccord}
              onInsertAccordIntoActiveFormula={(accord, dosageGrams = 10, targetFormulaId, newFormulaName) => {
                let target = targetFormulaId ? formulas.find((f) => f.id === targetFormulaId) : null;
                if (!target && newFormulaName) {
                  const newId = Date.now();
                  const created: Formula = {
                    id: newId,
                    projectId: 1,
                    projectName: 'Accord Study',
                    name: newFormulaName.trim(),
                    status: 'Draft',
                    description: `Formula developed around ${accord.name}`,
                    intendedProduct: 'Eau de Parfum (20% conc.)',
                    ifraCategory: 'Category 4 (Fine Fragrance)',
                    finalProductConcentration: 20,
                    targetBrief: `Formulation featuring ${accord.name}`,
                    targetFamilies: [accord.category || 'Floral'],
                    targetFacets: { [accord.category || 'Floral']: 7 },
                    targetIntensity: 7,
                    targetTexture: '',
                    targetAtmosphere: '',
                    targetTemperature: 'Warm',
                    targetColor: '#C49A45',
                    targetMood: '',
                    targetDiffusion: 7,
                    targetEvolution: '',
                    targetDrydown: '',
                    materialsToAvoid: [],
                    isFavorite: false,
                    tags: ['Accord-Study'],
                    activeVersionLabel: 'V1',
                    versions: [
                      {
                        id: Date.now() + 1,
                        formulaId: newId,
                        versionLabel: 'V1',
                        parentVersionId: null,
                        status: 'Draft',
                        versionNotes: `Initial formula iteration with ${accord.name} (${dosageGrams}g)`,
                        maturationDays: 14,
                        items: [
                          {
                            id: `acc-${Date.now()}`,
                            type: 'accord',
                            accordId: accord.id,
                            name: accord.name,
                            quantityGrams: dosageGrams,
                            percentage: 100,
                            dilutionPercent: 100,
                            solvent: 'Neat',
                            activeMaterialPercent: dosageGrams,
                            supplier: 'In-House Accord',
                            costPerGram: 0.45,
                            notes: `Foundation accord (${accord.items.length} notes)`,
                          },
                        ],
                        createdAt: new Date().toISOString().slice(0, 10),
                      },
                    ],
                    createdAt: new Date().toISOString().slice(0, 10),
                    updatedAt: new Date().toISOString().slice(0, 10),
                  };
                  setFormulas((prev) => [created, ...prev]);
                  setActiveFormulaId(newId);
                  setActiveVersionLabel('V1');
                  setActiveNav('formula-lab');
                  return;
                }

                const resolvedTarget = target || activeFormula;
                if (!resolvedTarget) return;
                const currentVer =
                  resolvedTarget.versions.find(
                    (v) => v.versionLabel === resolvedTarget.activeVersionLabel
                  ) || resolvedTarget.versions[0];
                const rawItems: FormulaLineItem[] = [
                  ...(currentVer?.items || []),
                  {
                    id: `acc-${Date.now()}`,
                    type: 'accord',
                    accordId: accord.id,
                    name: accord.name,
                    quantityGrams: dosageGrams,
                    percentage: dosageGrams,
                    dilutionPercent: 100,
                    solvent: 'Neat',
                    activeMaterialPercent: dosageGrams,
                    supplier: 'In-House Accord',
                    costPerGram: 0.45,
                    notes: `Inserted from Accord Library (${accord.items.length} components)`,
                  },
                ];
                const totalWeight = rawItems.reduce((s, it) => s + it.quantityGrams, 0);
                const nextItems = rawItems.map((it) => ({
                  ...it,
                  percentage: totalWeight > 0 ? (it.quantityGrams / totalWeight) * 100 : 0,
                }));
                handleSaveFormulaVersion(resolvedTarget, {
                  versionLabel: currentVer?.versionLabel || 'V1',
                  parentVersionId: currentVer?.parentVersionId ?? null,
                  status: 'Draft',
                  versionNotes: `Added ${accord.name} (${dosageGrams}g)`,
                  maturationDays: currentVer?.maturationDays || 14,
                  items: nextItems,
                });
                setActiveFormulaId(resolvedTarget.id);
                setActiveNav('formula-lab');
              }}
              onInsertMaterialIntoFormula={(material, dosageGrams, dilutionPercent, targetFormulaId, newFormulaName) => {
                let target = targetFormulaId ? formulas.find((f) => f.id === targetFormulaId) : null;
                if (!target && newFormulaName) {
                  const newId = Date.now();
                  const created: Formula = {
                    id: newId,
                    projectId: 1,
                    projectName: 'Single-Note Study',
                    name: newFormulaName.trim(),
                    status: 'Draft',
                    description: `Formula starting with ${material.name}`,
                    intendedProduct: 'Eau de Parfum (20% conc.)',
                    ifraCategory: 'Category 4 (Fine Fragrance)',
                    finalProductConcentration: 20,
                    targetBrief: `Formulation exploring ${material.name}`,
                    targetFamilies: [material.primaryFamily],
                    targetFacets: { [material.primaryFamily]: 7 },
                    targetIntensity: 7,
                    targetTexture: '',
                    targetAtmosphere: '',
                    targetTemperature: 'Cool',
                    targetColor: '#10B981',
                    targetMood: '',
                    targetDiffusion: 7,
                    targetEvolution: '',
                    targetDrydown: '',
                    materialsToAvoid: [],
                    isFavorite: false,
                    tags: ['Palette-Study'],
                    activeVersionLabel: 'V1',
                    versions: [
                      {
                        id: Date.now() + 1,
                        formulaId: newId,
                        versionLabel: 'V1',
                        parentVersionId: null,
                        status: 'Draft',
                        versionNotes: `Initial formula iteration with ${material.name} (${dosageGrams}g @ ${dilutionPercent}%)`,
                        maturationDays: 14,
                        items: [
                          {
                            id: `mat-${Date.now()}`,
                            type: 'material',
                            materialId: material.id,
                            name: material.name,
                            quantityGrams: dosageGrams,
                            percentage: 100,
                            dilutionPercent: dilutionPercent,
                            solvent: dilutionPercent < 100 ? 'DPG' : 'Neat',
                            activeMaterialPercent: dosageGrams * (dilutionPercent / 100),
                            supplier: material.supplier || 'Standard',
                            costPerGram: material.costPerGram ?? 0.35,
                            notes: `${material.volatility} note (${material.primaryFamily})`,
                          },
                        ],
                        createdAt: new Date().toISOString().slice(0, 10),
                      },
                    ],
                    createdAt: new Date().toISOString().slice(0, 10),
                    updatedAt: new Date().toISOString().slice(0, 10),
                  };
                  setFormulas((prev) => [created, ...prev]);
                  setActiveFormulaId(newId);
                  setActiveVersionLabel('V1');
                  setActiveNav('formula-lab');
                  return;
                }

                const resolvedTarget = target || activeFormula;
                if (!resolvedTarget) return;
                const currentVer =
                  resolvedTarget.versions.find(
                    (v) => v.versionLabel === resolvedTarget.activeVersionLabel
                  ) || resolvedTarget.versions[0];
                const rawItems: FormulaLineItem[] = [
                  ...(currentVer?.items || []),
                  {
                    id: `mat-${Date.now()}`,
                    type: 'material',
                    materialId: material.id,
                    name: material.name,
                    quantityGrams: dosageGrams,
                    percentage: dosageGrams,
                    dilutionPercent: dilutionPercent,
                    solvent: dilutionPercent < 100 ? 'DPG' : 'Neat',
                    activeMaterialPercent: dosageGrams * (dilutionPercent / 100),
                    supplier: material.supplier || 'Standard',
                    costPerGram: material.costPerGram ?? 0.35,
                    notes: `${material.volatility} note (${material.primaryFamily})`,
                  },
                ];
                const totalWeight = rawItems.reduce((s, it) => s + it.quantityGrams, 0);
                const nextItems = rawItems.map((it) => ({
                  ...it,
                  percentage: totalWeight > 0 ? (it.quantityGrams / totalWeight) * 100 : 0,
                }));
                handleSaveFormulaVersion(resolvedTarget, {
                  versionLabel: currentVer?.versionLabel || 'V1',
                  parentVersionId: currentVer?.parentVersionId ?? null,
                  status: 'Draft',
                  versionNotes: `Added ${material.name} (${dosageGrams}g @ ${dilutionPercent}%)`,
                  maturationDays: currentVer?.maturationDays || 14,
                  items: nextItems,
                });
                setActiveFormulaId(resolvedTarget.id);
                setActiveNav('formula-lab');
              }}
              onSaveScentMemory={handleSaveScentMemory}
              onOpenFormula={(fId, vLabel) => {
                setActiveFormulaId(fId);
                if (vLabel) setActiveVersionLabel(vLabel);
                setActiveNav('formula-lab');
              }}
              onToggleWorkbenchMaterial={(id) => {
                const mat = materials.find((m) => m.id === id);
                if (!mat) return;
                void handleUpdateShelfItem(id, {
                  isOnWorkbench: !Boolean(mat.isOnWorkbench),
                });
              }}
              onUpdateMaterialNotes={(id, notes) => {
                void handleUpdateShelfItem(id, { personalNotes: notes });
              }}
              onAddToShelf={handleAddToShelf}
              onUpdateShelfItem={handleUpdateShelfItem}
              onRemoveFromShelf={handleRemoveFromShelf}
            />
            </TabErrorBoundary>
          )}

          {/* 6. OLFACTORY PYRAMID & ARCHITECTURE (TOP, MID, BASE & BRIDGES) */}
          {activeNav === 'scent-hierarchy' && (
            <TabErrorBoundary
              activeSection="scent-hierarchy"
              sectionTitle={TAB_INSTRUCTION_GUIDE['scent-hierarchy'].title}
              onRetry={handleRetryViewData}
            >
            <OlfactoryPyramidView
              activeFormula={activeFormula}
              formulas={formulas}
              materials={materials}
              accords={accords}
              lang={lang}
              onSelectMaterial={(id: number) => {
                setSelectedMaterialId(id);
                setActiveNav('raw-materials');
              }}
              onOpenFormulaLab={() => {
                setActiveNav('formula-lab');
              }}
              onUpdateFormulaItems={handleUpdateFormulaLineItems}
            />
            </TabErrorBoundary>
          )}

          {/* 7. OLFACTORY WHEEL */}
          {activeNav === 'olfactory-wheel' && (
            <TabErrorBoundary
              activeSection="olfactory-wheel"
              sectionTitle={TAB_INSTRUCTION_GUIDE['olfactory-wheel'].title}
              onRetry={handleRetryViewData}
            >
            <OlfactoryWheelView
              mode="wheel"
              formulas={formulas}
              activeFormula={activeFormula}
              materials={materials}
              accords={accords}
              evaluations={evaluations}
              onUpdateTargetFacets={(formulaId, updatedFacets) => {
                setFormulas((prev) =>
                  prev.map((f) =>
                    f.id === formulaId ? { ...f, targetFacets: updatedFacets } : f
                  )
                );
              }}
              onUpdateFormulaItems={handleUpdateFormulaLineItems}
              onSelectMaterial={(id) => {
                setSelectedMaterialId(id);
                setActiveNav('raw-materials');
              }}
              onSelectFormula={(id) => {
                setActiveFormulaId(id);
                setActiveNav('formula-lab');
              }}
            />
            </TabErrorBoundary>
          )}

          {/* 9, 10, 11. EXPERIMENTS, EVALUATIONS, SCENT MEMORY */}
          {(activeNav === 'experiments' ||
            activeNav === 'evaluations' ||
            activeNav === 'scent-memory') && (
            <TabErrorBoundary
              activeSection={activeNav}
              sectionTitle={TAB_INSTRUCTION_GUIDE[activeNav].title}
              onRetry={handleRetryViewData}
            >
            <EvaluationAndJournalView
              mode={
                activeNav === 'experiments'
                  ? 'experiments'
                  : activeNav === 'evaluations'
                  ? 'evaluations'
                  : 'memory'
              }
              formulas={formulas}
              activeFormula={activeFormula}
              materials={materials}
              experiments={experiments}
              evaluations={evaluations}
              scentMemories={scentMemories}
              onAddExperiment={handleAddExperiment}
              onAddEvaluation={handleAddEvaluation}
              onUpdateScentMemory={handleSaveScentMemory}
            />
            </TabErrorBoundary>
          )}

          {/* 12. OLFACTORY MENTOR */}
          {activeNav === 'mentor' && (
            <TabErrorBoundary
              activeSection="mentor"
              sectionTitle={TAB_INSTRUCTION_GUIDE.mentor.title}
              onRetry={handleRetryViewData}
            >
            <OlfactoryMentorView
              activeFormula={activeFormula}
              materials={materials}
              evaluations={evaluations}
              accords={accords}
              authHeaders={getAuthHeaders()}
              onUpdateFormulaItems={handleUpdateFormulaLineItems}
              onNavigateToWheel={() => setActiveNav('olfactory-wheel')}
              onInspectMaterial={(id) => {
                setSelectedMaterialId(id);
                setActiveNav('raw-materials');
              }}
              onOpenFormulaLab={() => setActiveNav('formula-lab')}
              onCreateExperimentalBranch={async (
                branchLabel,
                branchNotes,
                modifiedItems
              ) => {
                if (!activeFormula) return;
                await handleSaveFormulaVersion(activeFormula, {
                  versionLabel: branchLabel,
                  parentVersionId: null,
                  status: 'Draft',
                  versionNotes: branchNotes,
                  maturationDays: 14,
                  items: modifiedItems,
                });
                setActiveNav('formula-lab');
              }}
            />
            </TabErrorBoundary>
          )}

          {/* 14. GLOBAL SEARCH */}
          {activeNav === 'search' && (
            <TabErrorBoundary
              activeSection="search"
              sectionTitle={TAB_INSTRUCTION_GUIDE.search.title}
              onRetry={handleRetryViewData}
            >
            <GlobalSearchView
              materials={materials}
              formulas={formulas}
              accords={accords}
              experiments={experiments}
              evaluations={evaluations}
              scentMemories={scentMemories}
              onSelectMaterial={(id) => {
                setSelectedMaterialId(id);
                setActiveNav('raw-materials');
              }}
              onSelectFormula={(id, ver) => {
                setActiveFormulaId(id);
                if (ver) setActiveVersionLabel(ver);
                setActiveNav('formula-lab');
              }}
            />
            </TabErrorBoundary>
          )}

          {/* 15. HELP & INTERACTIVE TUTORIAL */}
          {activeNav === 'help' && (
            <TabErrorBoundary
              activeSection="help"
              sectionTitle={TAB_INSTRUCTION_GUIDE.help.title}
              onRetry={handleRetryViewData}
            >
            <HelpAndTutorialView
              lang={lang}
              onStartLiveTour={(stepIdx = 0) => handleSelectLiveTourStep(stepIdx)}
              onNavigateToModule={(targetNav) => setActiveNav(targetNav)}
            />
            </TabErrorBoundary>
          )}

          {/* 16. ABOUT, VERSION, GITHUB & PRIVACY POLICY */}
          {activeNav === 'about' && (
            <TabErrorBoundary
              activeSection="about"
              sectionTitle={TAB_INSTRUCTION_GUIDE.about.title}
              onRetry={handleRetryViewData}
            >
            <AboutAndPrivacyView
              lang={lang}
              onStartTour={() => setActiveNav('help')}
            />
            </TabErrorBoundary>
          )}

          {/* 17. SETTINGS */}
          {activeNav === 'settings' && (
            <TabErrorBoundary
              activeSection="settings"
              sectionTitle={TAB_INSTRUCTION_GUIDE.settings.title}
              onRetry={handleRetryViewData}
            >
            <SettingsView
              userEmail={firebaseUser?.email || 'atelier-student@perfumery.edu'}
              isGoogleAuthenticated={Boolean(firebaseUser)}
              theme={theme}
              educationalPrompts={educationalPrompts}
              safetyEnabled={safetyEnabled}
              currencySettings={currencySettings}
              fullWorkspaceSnapshot={{
                exportedAt: new Date().toISOString(),
                materials,
                regulatoryLimits,
                accords,
                formulas,
                experiments,
                evaluations,
                scentMemories,
              }}
              onToggleTheme={setTheme}
              onToggleEducational={setEducationalPrompts}
              onToggleSafety={setSafetyEnabled}
              onUpdateCurrencySettings={handleUpdateCurrencySettings}
              onSyncLiveExchangeRates={handleSyncLiveExchangeRates}
              isSyncingRates={isSyncingRates}
              onGoogleLogin={handleGoogleSignIn}
              onLogout={handleLogout}
              onDeleteAccount={async () => {
                await fetch('/api/account', {
                  method: 'DELETE',
                  headers: getAuthHeaders(),
                });
                window.location.reload();
              }}
            />
            </TabErrorBoundary>
          )}
          </div>
        </main>

        {/* Live Step-by-Step Interactive App Tour Floating Overlay */}
        {liveTourActive && (
          <InteractiveTourOverlay
            activeStepIndex={liveTourStepIndex}
            onSelectStep={handleSelectLiveTourStep}
            onCloseTour={() => setLiveTourActive(false)}
            lang={lang}
          />
        )}
      </div>

      {/* Mobile Navigation Drawer — Clicking/tapping outside the sidebar closes the menu */}
      {mobileMenuOpen && (
        <div
          data-testid="mobile-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-[110] lg:hidden flex bg-black/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-64 bg-[#0E121B] border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto shadow-2xl"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-lg font-sans font-bold text-white">
                  OsmoLab
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile navigation"
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium ${
                        active
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Cmd/Ctrl + K) */}
      {commandPaletteOpen && (
        <div
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-[110] flex items-start justify-center p-2 sm:p-4 pt-6 sm:pt-20 bg-black/75 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Global Command Palette"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden my-auto sm:my-0"
          >
            <div className="flex items-center px-4 py-3 border-b border-slate-800 shrink-0">
              <Search className="w-4 h-4 text-emerald-400 mr-3 shrink-0" />
              <input
                type="search"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Type a raw material, formula, accord, or workspace section..."
                className="w-full bg-transparent text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="text-xs text-slate-400 hover:text-white ml-2 px-2 py-1 bg-slate-800/80 rounded"
              >
                ESC
              </button>
            </div>
            <div className="flex-1 max-h-80 overflow-y-auto overscroll-contain p-2 space-y-1 text-xs">
              {materials
                .filter(
                  (m) =>
                    !commandQuery.trim() ||
                    m.name.toLowerCase().includes(commandQuery.toLowerCase()) ||
                    m.primaryFamily.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .slice(0, 5)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMaterialId(m.id);
                      setActiveNav('raw-materials');
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800 text-left"
                  >
                    <span className="font-medium text-white">
                      Material: {m.name}
                    </span>
                    <span className="font-mono-tabular text-slate-400">
                      {m.primaryFamily} · CAS {m.casNumber}
                    </span>
                  </button>
                ))}
              {formulas
                .filter(
                  (f) =>
                    !commandQuery.trim() ||
                    f.name.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFormulaId(f.id);
                      setActiveNav('formula-lab');
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800 text-left"
                  >
                    <span className="font-medium text-emerald-300">
                      Formula: {f.name} ({f.activeVersionLabel})
                    </span>
                    <span className="text-slate-400">{f.status}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
