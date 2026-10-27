export type AppLanguage = 'en' | 'fa';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    fa: string;
  };
}

export const TRANSLATIONS: TranslationDictionary = {
  // Navigation & Shell
  appTitle: {
    en: 'OsmoLab Atelier',
    fa: 'آتلیه عطرسازی اسمولب',
  },
  appSubtitle: {
    en: 'Precision Fragrance Formulation Studio',
    fa: 'استودیوی تخصصی طراحی و فرمولاسیون عطر',
  },
  dashboard: {
    en: 'Dashboard',
    fa: 'داشبورد',
  },
  formulaLab: {
    en: 'Formula Lab',
    fa: 'آزمایشگاه فرمول',
  },
  formulaLibrary: {
    en: 'Formula Library',
    fa: 'کتابخانه فرمول‌ها',
  },
  rawMaterials: {
    en: 'Catalog & Workbench',
    fa: 'کاتالوگ و میز کار',
  },
  myWorkbench: {
    en: 'My Workbench',
    fa: 'میز کار من',
  },
  accords: {
    en: 'Accords & Bases',
    fa: 'آکوردها و پایه‌ها',
  },
  olfactoryPyramid: {
    en: 'Olfactory Pyramid',
    fa: 'هرم بویایی و پل‌ها',
  },
  olfactoryWheel: {
    en: 'Olfactory Wheel',
    fa: 'چرخه بویایی',
  },
  scentMemory: {
    en: 'Scent Memory',
    fa: 'حافظه بویایی',
  },
  mentor: {
    en: 'Olfactory Mentor',
    fa: 'منتور فرمولاسیون',
  },
  experiments: {
    en: 'Experiments',
    fa: 'آزمایش‌ها',
  },
  evaluations: {
    en: 'Evaluations',
    fa: 'ارزیابی‌های حسی',
  },
  search: {
    en: 'Search',
    fa: 'جستجو',
  },
  settings: {
    en: 'Settings',
    fa: 'تنظیمات',
  },

  // Groups
  groupWorkspace: {
    en: 'Workspace',
    fa: 'فضای کاری',
  },
  groupEncyclopedia: {
    en: 'Catalog & Workbench',
    fa: 'کاتالوگ و میز کار',
  },
  groupOlfactory: {
    en: 'Olfactory Design',
    fa: 'طراحی بویایی',
  },
  groupBench: {
    en: 'Laboratory Journal',
    fa: 'ژورنال آزمایشگاه',
  },

  // Header & Controls
  theme: {
    en: 'Theme',
    fa: 'پوسته',
  },
  darkMode: {
    en: 'Dark Mode',
    fa: 'حالت تیره',
  },
  lightMode: {
    en: 'Light Mode',
    fa: 'حالت روشن',
  },
  language: {
    en: 'Language',
    fa: 'زبان',
  },
  activeStudy: {
    en: 'Active Study',
    fa: 'فرمول در حال بررسی',
  },
  openInFormulaLab: {
    en: 'Open in Formula Lab',
    fa: 'باز کردن در آزمایشگاه فرمول',
  },
  globalSearchPlaceholder: {
    en: 'Search materials, formulas, accords (Ctrl+K)...',
    fa: 'جستجوی مواد، فرمول‌ها و آکوردها (Ctrl+K)...',
  },

  // Olfactory Pyramid Specific
  pyramidHeaderTitle: {
    en: 'Olfactory Pyramid & Structural Bridge Architecture',
    fa: 'هرم بویایی و معماری پل‌های پیوند دهنده فراریت',
  },
  pyramidHeaderDesc: {
    en: 'Balance formula proportions across five evaporation tiers and molecular bridges from top notes to base.',
    fa: 'توازن نسبت‌های فرمول در پنج لایه تبخیر و پل‌های مولکولی از نت‌های آغازین تا پایه.',
  },
  dragDropHint: {
    en: 'Drag materials directly into any tier or use vertical faders to sculpt proportions',
    fa: 'مواد را مستقیماً به هر لایه بکشید و رها کنید یا از فیدرهای عمودی برای تنظیم نسبت استفاده نمایید',
  },
  dragDropWorkbenchTitle: {
    en: 'My Workbench Materials',
    fa: 'مواد اولیه میز کار من',
  },
  dragDropWorkbenchSubtitle: {
    en: 'Drag into pyramid tiers or click to inspect',
    fa: 'به درون لایه‌های هرم بکشید یا برای جزئیات کلیک کنید',
  },
  filterByTier: {
    en: 'Filter Tier',
    fa: 'فیلتر لایه',
  },
  allTiers: {
    en: 'All Volatilities',
    fa: 'همه لایه‌ها',
  },
  tierTop: {
    en: 'Top Notes',
    fa: 'نت‌های آغازین (Top Notes)',
  },
  tierTopHeart: {
    en: 'Top-to-Heart Bridge',
    fa: 'پل آغازین به میانی (Top-to-Heart Bridge)',
  },
  tierHeart: {
    en: 'Heart Notes',
    fa: 'نت‌های میانی (Heart Notes)',
  },
  tierHeartBase: {
    en: 'Heart-to-Base Bridge',
    fa: 'پل میانی به پایه (Heart-to-Base Bridge)',
  },
  tierBase: {
    en: 'Base Notes',
    fa: 'نت‌های پایه (Base Notes)',
  },
  dropZoneReady: {
    en: 'Release to drop material into this tier',
    fa: 'رها کنید تا ماده در این لایه ثبت شود',
  },
  bridgeCohesionIndex: {
    en: 'Bridge Cohesion Index',
    fa: 'شاخص انسجام پل‌های بویایی',
  },
  classicalRatioArchetype: {
    en: 'Classical Ratio Archetype',
    fa: 'الگوی نسبت‌های کلاسیک',
  },
  archetypeModernEdp: {
    en: 'Modern EDP (20 / 15 / 25 / 20 / 20)',
    fa: 'مدرن EDP (۲۰ / ۱۵ / ۲۵ / ۲۰ / ۲۰)',
  },
  archetypeCologne: {
    en: 'Classic Cologne (50 / 20 / 15 / 10 / 5)',
    fa: 'کلن کلاسیک (۵۰ / ۲۰ / ۱۵ / ۱۰ / ۵)',
  },
  archetypeChypre: {
    en: 'Forest Chypre (15 / 10 / 25 / 25 / 25)',
    fa: 'شیپق جنگلی (۱۵ / ۱۰ / ۲۵ / ۲۵ / ۲۵)',
  },
  archetypeAmber: {
    en: 'Amber Extrait (10 / 10 / 20 / 25 / 35)',
    fa: 'اکستریت عنبری (۱۰ / ۱۰ / ۲۰ / ۲۵ / ۳۵)',
  },
  activeFormulaWeight: {
    en: 'Active Formula Weight',
    fa: 'وزن در فرمول فعال',
  },
  olfactoryRoleFunction: {
    en: 'Olfactory Role & Function',
    fa: 'نقش و کارکرد بویایی',
  },
  molecularClasses: {
    en: 'Molecular Classes',
    fa: 'دسته‌های مولکولی',
  },
  sensoryDecayTimeline: {
    en: 'Sensory Decay Timeline on Blotter Strip',
    fa: 'خط سیر تبخیر و افت بویایی روی کاغذ بلاتر',
  },
  substantivityWindow: {
    en: 'Substantivity window',
    fa: 'بازه ماندگاری',
  },
  bridgingPrincipleTitle: {
    en: 'Perfumery School Bridging Principle',
    fa: 'اصل آکادمیک پل‌های پیوند دهنده در عطرسازی',
  },
  activeFormulaIngredientsInTier: {
    en: 'Active Formula Ingredients in this Tier',
    fa: 'مواد اولیه فرمول فعال در این لایه',
  },
  noMaterialsAssigned: {
    en: 'No materials currently assigned to this tier in this formula. Drag from the bench below to add.',
    fa: 'در حال حاضر ماده‌ای در این لایه تخصیص نیافته است. از کتابخانه پایین به اینجا بکشید.',
  },
  verticalVolumeControl: {
    en: 'Vertical Volume Fader',
    fa: 'فیدر عمودی تنظیم غلظت و حجم',
  },
  scrollGestureInstruction: {
    en: 'Use mouse wheel over fader or touch/drag vertically to adjust percentage',
    fa: 'نشانگر ماوس را روی فیدر اسکرول کنید یا با لمس و کشیدن مقدار را تغییر دهید',
  },
  inFormulaBadge: {
    en: 'In Formula',
    fa: 'درون فرمول',
  },
  dossierBtn: {
    en: 'Dossier',
    fa: 'پرونده',
  },
  workbenchAvailable: {
    en: 'On My Workbench',
    fa: 'در میز کار من',
  },
  removeFromTier: {
    en: 'Remove',
    fa: 'حذف',
  },
  dragToTierAction: {
    en: 'Drag into tier',
    fa: 'کشیدن به لایه',
  },
  bridgesIndicator: {
    en: 'Olfactory Bridge Interlocks',
    fa: 'پل‌های پیوند مولکولی و گذار',
  },
  topHeartBridgeDesc: {
    en: 'Anchors fugitive top citrus & greens before collapsing into floral core',
    fa: 'تثبیت مرکبات و نت‌های سبز فرار قبل از ورود به قلب گلی',
  },
  heartBaseBridgeDesc: {
    en: 'Diffusive cushion linking florals to dense resins, woods, and musks',
    fa: 'بالشتک پخشی پیوند دهنده گل‌ها به رزین‌ها، چوب‌ها و مشک‌ها',
  },
  exportToPng: {
    en: 'Export to PNG',
    fa: 'خروجی تصویر PNG',
  },
  exportedPngToast: {
    en: 'Exported high-resolution Olfactory Pyramid PNG',
    fa: 'تصویر هرم بویایی با کیفیت بالا (PNG) دانلود شد',
  },
  emptyTierPrompt: {
    en: 'Empty Tier — Click to Add Material',
    fa: 'لایه خالی — برای افزودن ماده کلیک کنید',
  },
  addMaterialModalTitle: {
    en: 'Add or Assign Material to Tier',
    fa: 'افزودن یا تخصیص ماده اولیه به لایه',
  },
  fromCurrentFormulaSection: {
    en: 'Materials from Current Formula',
    fa: 'مواد موجود در فرمول فعلی',
  },
  fromOrganLibrarySection: {
    en: 'Available Raw Materials from Organ Library',
    fa: 'مواد اولیه موجود در کتابخانه ارگان',
  },
  assignToTierBtn: {
    en: 'Assign to Tier',
    fa: 'انتقال به لایه',
  },
  addToFormulaTierBtn: {
    en: 'Add to Tier (+2.0g)',
    fa: 'افزودن به لایه (+۲.۰ گرم)',
  },
  influenceLabel: {
    en: 'Influence',
    fa: 'سهم تأثیر',
  },
  helpAndTutorial: {
    en: 'Help & Tutorial',
    fa: 'راهنما و آموزش تصویری',
  },
  aboutAndPrivacy: {
    en: 'About & Privacy',
    fa: 'درباره پروژه و حریم خصوصی',
  },
  interactiveTourBtn: {
    en: 'Start Interactive Tour',
    fa: 'شروع تور تعاملی گام‌به‌گام',
  },
};

export interface IsoscelesTrapezoidTierGeometry {
  id: 'top' | 'top-heart' | 'heart' | 'heart-base' | 'base';
  roman: string;
  topY: number;
  botY: number;
  midY: number;
  topHalfW: number;
  botHalfW: number;
  topLeftX: number;
  topRightX: number;
  botRightX: number;
  botLeftX: number;
  leftEdgeX: number;
  rightEdgeX: number;
  leftSlope: number;
  rightSlope: number;
  points: string;
}

/**
 * Computes consistent 4-vertex symmetrical isosceles trapezoid geometry for all 5 pyramid tiers.
 * Ensures uniform side slope `k` and symmetrical base/top angles across Top, Bridges, Heart, and Base.
 */
export function computeUniformIsoscelesTrapezoids(
  centerX = 200,
  startY = 10,
  topPlateauHalfW = 24,
  tierHeight = 36,
  tierGap = 4,
  slopeK = 0.65
): IsoscelesTrapezoidTierGeometry[] {
  const tierMeta: Array<{ id: IsoscelesTrapezoidTierGeometry['id']; roman: string }> = [
    { id: 'top', roman: 'I' },
    { id: 'top-heart', roman: 'II' },
    { id: 'heart', roman: 'III' },
    { id: 'heart-base', roman: 'IV' },
    { id: 'base', roman: 'V' },
  ];

  return tierMeta.map((meta, idx) => {
    const topY = startY + idx * (tierHeight + tierGap);
    const botY = topY + tierHeight;
    const midY = (topY + botY) / 2;

    const topHalfW = Number((topPlateauHalfW + slopeK * (topY - startY)).toFixed(2));
    const botHalfW = Number((topPlateauHalfW + slopeK * (botY - startY)).toFixed(2));
    const midHalfW = Number(((topHalfW + botHalfW) / 2).toFixed(2));

    const topLeftX = Number((centerX - topHalfW).toFixed(2));
    const topRightX = Number((centerX + topHalfW).toFixed(2));
    const botRightX = Number((centerX + botHalfW).toFixed(2));
    const botLeftX = Number((centerX - botHalfW).toFixed(2));

    const leftEdgeX = Number((centerX - midHalfW).toFixed(2));
    const rightEdgeX = Number((centerX + midHalfW).toFixed(2));

    const leftSlope = Number(((topLeftX - botLeftX) / (botY - topY)).toFixed(4));
    const rightSlope = Number(((botRightX - topRightX) / (botY - topY)).toFixed(4));

    return {
      id: meta.id,
      roman: meta.roman,
      topY,
      botY,
      midY,
      topHalfW,
      botHalfW,
      topLeftX,
      topRightX,
      botRightX,
      botLeftX,
      leftEdgeX,
      rightEdgeX,
      leftSlope,
      rightSlope,
      points: `${topLeftX},${topY} ${topRightX},${topY} ${botRightX},${botY} ${botLeftX},${botY}`,
    };
  });
}

export function t(key: string, lang: AppLanguage = 'en'): string {
  const item = TRANSLATIONS[key];
  if (!item) return key;
  return item[lang] || item.en || key;
}

export function getDir(lang: AppLanguage): 'ltr' | 'rtl' {
  return lang === 'fa' ? 'rtl' : 'ltr';
}

