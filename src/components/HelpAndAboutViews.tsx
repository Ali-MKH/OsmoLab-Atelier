import React, { useState } from 'react';
import { AppLanguage, getDir } from '../domain/i18n';
import {
  BookOpen,
  Compass,
  Play,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  FlaskConical,
  Sliders,
  ShieldCheck,
  Lock,
  ExternalLink,
  Code2,
  FileText,
  Download,
  HelpCircle,
  Info,
  Scale,
  Brain,
  Database,
  X,
  Check,
  Terminal,
  GitBranch,
  Globe,
} from 'lucide-react';

export type TourTargetNavId =
  | 'dashboard'
  | 'formula-lab'
  | 'scent-hierarchy'
  | 'olfactory-wheel'
  | 'raw-materials'
  | 'mentor';

export interface GuidedTourStep {
  stepNumber: number;
  id: string;
  targetNav: TourTargetNavId;
  moduleBadge: string;
  title: string;
  subtitle: string;
  description: string;
  interactiveTasks: string[];
  proTip: string;
  diagramType:
    | 'overview'
    | 'formula-fader'
    | 'isosceles-pyramid'
    | 'olfactory-wheel'
    | 'organ-inventory'
    | 'mentor-trials';
}

export const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  {
    stepNumber: 1,
    id: 'tour-dashboard',
    targetNav: 'dashboard',
    moduleBadge: '01 · Laboratory Command Center',
    title: 'Configure Your Perfumery Workspace & Daily Checkpoints',
    subtitle: 'Monitor active formulas, maceration schedules, and organ stock alerts at a glance.',
    description:
      'The Dashboard aggregates your active fragrance studies, scheduled maturation blotter checkpoints (Day 7, Day 14, Day 30), low-stock raw material warnings, and recent version diffs.',
    interactiveTasks: [
      'Click "Configure Widgets" to toggle visibility of your 6 studio panels.',
      'Review Aging & Maceration Checkpoints to see which batches need sensory evaluation today.',
      'Click "Formulate →" on any active study to jump straight into the Formula Lab.',
    ],
    proTip:
      'Use Cmd/Ctrl + K from anywhere in the studio to open the Global Command Palette and jump to any raw material, CAS number, or formula.',
    diagramType: 'overview',
  },
  {
    stepNumber: 2,
    id: 'tour-formula-lab',
    targetNav: 'formula-lab',
    moduleBadge: '02 · Precision Formula Workbench',
    title: 'Compose Formulas with Dilution Math & IFRA 51st Guardrails',
    subtitle: 'Track neat weight (g), relative formula %, and true active aromatic concentration.',
    description:
      'In the Formula Lab, every line item tracks both bulk weight in grams and dilution solvent (e.g., 10% in Ethanol or DPG). The engine automatically computes active aromatic contribution and checks IFRA Category 4 limits.',
    interactiveTasks: [
      'Adjust any ingredient weight using the tactile vertical volume fader or numeric input.',
      'Click "Normalize to 100%" to proportionally scale your formula so percentages sum to exactly 100.00%.',
      'Compare historical versions (e.g., V4 vs. V5) to inspect exact gram and percentage deltas.',
    ],
    proTip:
      'Scroll your mouse wheel over any vertical fader for fine 0.5g adjustments, or hold Shift while scrolling for ultra-fine 0.1g micro-dosing.',
    diagramType: 'formula-fader',
  },
  {
    stepNumber: 3,
    id: 'tour-pyramid',
    targetNav: 'scent-hierarchy',
    moduleBadge: '03 · 5-Tier Isosceles Olfactory Pyramid',
    title: 'Balance Volatility Tiers, Molecular Bridges & Influence %',
    subtitle: 'Visualize evaporation architecture across uniform symmetrical isosceles trapezoids.',
    description:
      'The Olfactory Pyramid divides your formula into 5 uniform isosceles trapezoid tiers: Top Notes (I), Top-to-Heart Bridge (II), Heart Notes (III), Heart-to-Base Bridge (IV), and Base Notes (V), with live Influence Percentage indicators next to each tier.',
    interactiveTasks: [
      'Click any tier slice in the minimal pyramid or stacked cards below to inspect or assign materials.',
      'Click an empty tier (or the "+ Add Material" button) to open the Material Picker modal.',
      'Drag vertical volume faders on material cards to rebalance tier influence in real time, then click "Export to PNG".',
    ],
    proTip:
      'Bridge tiers (II and IV) prevent "olfactory gaps" where fleeting citrus top notes evaporate before dense heart or base notes bloom.',
    diagramType: 'isosceles-pyramid',
  },
  {
    stepNumber: 4,
    id: 'tour-wheel',
    targetNav: 'olfactory-wheel',
    moduleBadge: '04 · 16-Family Radial Olfactory Wheel',
    title: 'Map Olfactory Families & Target vs. Actual Facet Radar',
    subtitle: 'Explore primary/secondary scent families and detect structural gaps in your accord.',
    description:
      'The interactive 16-family SVG Olfactory Wheel maps every raw material in your organ across Citrus, Green, Floral, Woody, Amber, Musk, Chypre, and Gourmand axes, paired with a Target vs. Actual Facet Radar.',
    interactiveTasks: [
      'Click any radial sector on the Olfactory Wheel to filter materials belonging to that family.',
      'Inspect the Target vs. Actual Facet Radar to see where your current formula under- or over-shoots your creative brief.',
      'Click any material node to open its full technical dossier.',
    ],
    proTip:
      'Use complementary wheel sectors (e.g., Crisp Green + Resinous Amber) to create high-contrast tension in modern niche compositions.',
    diagramType: 'olfactory-wheel',
  },
  {
    stepNumber: 5,
    id: 'tour-materials',
    targetNav: 'raw-materials',
    moduleBadge: '05 · Perfumer Palette & Accords',
    title: 'Inspect Raw Material Dossiers, CAS Registry & Scent Profiles',
    subtitle: 'Explore naturals, synthetics, olfactory facets, and IFRA limits.',
    description:
      'Your Raw Material Library catalogs vapor pressure, substantivity hours, odor detection thresholds, and IFRA restrictions for every ingredient in your creative palette.',
    interactiveTasks: [
      'Filter materials by Volatility Tier (Top, Heart, Base) or Natural vs. Synthetic origin.',
      'Open a material dossier to view its evaporation curve, odor descriptors, and historical formula usage.',
      'Explore Accords & Bases to insert modular scent structures directly into your formula.',
    ],
    proTip:
      'Keep high-impact materials like Galbanum, Birch Tar, and Aldehyde C-12 MNA prediluted at 1% or 10% for accurate micro-dosing.',
    diagramType: 'organ-inventory',
  },
  {
    stepNumber: 6,
    id: 'tour-mentor',
    targetNav: 'mentor',
    moduleBadge: '06 · Olfactory Mentor & Controlled Trials',
    title: 'Diagnose Formula Imbalances & Generate 3 Controlled Trials',
    subtitle: 'Turn sensory critiques into structured A/B/C experimental branches.',
    description:
      'The Olfactory Mentor analyzes your formula structure—detecting top-note crowding, muddiness, excessive woody dryness, or missing bridges—and proposes 3 controlled trial branches changing only 1–2 variables at a time.',
    interactiveTasks: [
      'Review the structural diagnostics for your active formula.',
      'Inspect the 3 proposed controlled trials (Conservative, Structural Bridge, High-Contrast).',
      'Click "Create Experimental Branch" to spawn a new formula version directly in your Formula Lab.',
    ],
    proTip:
      'Scientific perfumery relies on isolating variables: change only one or two materials per trial so you know exactly what caused the sensory shift.',
    diagramType: 'mentor-trials',
  },
];

/**
 * Custom Illustrative Vector Diagrams for the Help & Tutorial Studio
 */
export const TutorialIllustrationSVG: React.FC<{
  type: GuidedTourStep['diagramType'];
}> = ({ type }) => {
  if (type === 'isosceles-pyramid') {
    return (
      <svg
        viewBox="0 0 520 220"
        className="w-full h-auto rounded-lg bg-[#090C12] border border-slate-800 p-2"
        role="img"
        aria-label="Uniform Isosceles Trapezoid Pyramid Architecture Diagram"
      >
        <defs>
          <linearGradient id="tutTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="tutBridge1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="tutHeart" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="tutBridge2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="tutBase" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Outer Symmetrical Angle Guide */}
        <polygon
          points="166,18 214,18 331,198 49,198"
          fill="none"
          stroke="#334155"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* 5 Uniform Isosceles Trapezoids */}
        <polygon points="166,18 214,18 235.6,50 144.4,50" fill="url(#tutTop)" stroke="#F59E0B" strokeWidth="1.5" />
        <polygon points="142,54 238,54 259.6,86 120.4,86" fill="url(#tutBridge1)" stroke="#10B981" strokeWidth="1.5" />
        <polygon points="118,90 262,90 283.6,122 96.4,122" fill="url(#tutHeart)" stroke="#3B82F6" strokeWidth="1.5" />
        <polygon points="94,126 286,126 307.6,158 72.4,158" fill="url(#tutBridge2)" stroke="#8B5CF6" strokeWidth="1.5" />
        <polygon points="70,162 310,162 331.6,194 48.4,194" fill="url(#tutBase)" stroke="#94A3B8" strokeWidth="1.5" />

        {/* Center Symmetry Axis */}
        <line x1="190" y1="12" x2="190" y2="204" stroke="rgba(255,255,255,0.22)" strokeDasharray="2 2" />

        {/* Angle Symmetry Callout Left */}
        <text x="82" y="42" fill="#FBBF24" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="end">
          θ = Uniform Slope
        </text>
        <text x="64" y="110" fill="#34D399" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="end">
          Isosceles Frustum
        </text>

        {/* Labels inside Trapezoids */}
        <text x="190" y="38" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">I · TOP</text>
        <text x="190" y="74" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">II · BRIDGE</text>
        <text x="190" y="110" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">III · HEART</text>
        <text x="190" y="146" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">IV · BRIDGE</text>
        <text x="190" y="182" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">V · BASE</text>

        {/* Influence Indicators on Right */}
        {[
          { y: 34, label: 'I · 11.4% Influence', color: '#F59E0B', w: 24 },
          { y: 70, label: 'II · 8.0% Influence', color: '#10B981', w: 18 },
          { y: 106, label: 'III · 29.5% Influence', color: '#3B82F6', w: 46 },
          { y: 142, label: 'IV · 20.5% Influence', color: '#8B5CF6', w: 34 },
          { y: 178, label: 'V · 30.7% Influence', color: '#94A3B8', w: 48 },
        ].map((ind, i) => (
          <g key={i}>
            <line x1="335" y1={ind.y} x2="352" y2={ind.y} stroke={ind.color} strokeDasharray="2 2" />
            <rect x="354" y={ind.y - 10} width="154" height="20" rx="4" fill="#111622" stroke={ind.color} strokeOpacity="0.6" />
            <text x="362" y={ind.y + 3} fill="#F8FAFC" fontSize="8.5" fontFamily="monospace" fontWeight="700">
              {ind.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  if (type === 'formula-fader') {
    return (
      <svg
        viewBox="0 0 520 220"
        className="w-full h-auto rounded-lg bg-[#090C12] border border-slate-800 p-2"
        role="img"
        aria-label="Vertical Volume Faders and Formula Normalization Diagram"
      >
        {/* Left: Formula Table Schematic */}
        <rect x="16" y="20" width="290" height="180" rx="8" fill="#111622" stroke="#1E293B" />
        <text x="30" y="44" fill="#10B981" fontSize="10" fontFamily="monospace" fontWeight="700">
          FORMULA WORKBENCH · 100.00% NORMALIZED
        </text>
        {[
          { name: 'Bergamot Calabrian', g: '12.0g', pct: '13.6%', c: '#F59E0B', bar: 90 },
          { name: 'Hedione HC', g: '18.0g', pct: '20.5%', c: '#3B82F6', bar: 135 },
          { name: 'Iso E Super', g: '22.0g', pct: '25.0%', c: '#8B5CF6', bar: 165 },
          { name: 'Vetiver Haiti', g: '14.0g', pct: '15.9%', c: '#94A3B8', bar: 105 },
        ].map((r, idx) => {
          const y = 65 + idx * 32;
          return (
            <g key={idx}>
              <rect x="28" y={y - 12} width="266" height="24" rx="4" fill="#0B0E14" stroke="#1E293B" />
              <text x="36" y={y + 3} fill="#F8FAFC" fontSize="9.5" fontWeight="600">{r.name}</text>
              <rect x="145" y={y - 3} width={r.bar * 0.45} height="6" rx="3" fill={r.c} />
              <text x="284" y={y + 3} fill="#34D399" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="end">
                {r.g} ({r.pct})
              </text>
            </g>
          );
        })}

        {/* Right: Tactile Vertical Fader Zoom Illustration */}
        <rect x="324" y="20" width="180" height="180" rx="8" fill="#111622" stroke="#10B981" strokeOpacity="0.5" />
        <text x="414" y="42" fill="#F8FAFC" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          VERTICAL VOLUME FADER
        </text>
        {/* Fader Track */}
        <rect x="364" y="58" width="22" height="118" rx="6" fill="#090D16" stroke="#334155" />
        <rect x="366" y="96" width="18" height="78" rx="4" fill="#10B981" fillOpacity="0.8" />
        {/* Fader Cap */}
        <rect x="360" y="90" width="30" height="12" rx="3" fill="#F8FAFC" stroke="#10B981" strokeWidth="1.5" />
        {/* Callouts */}
        <text x="402" y="76" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">▲ +0.1g Fine Step</text>
        <text x="402" y="100" fill="#34D399" fontSize="9" fontFamily="monospace" fontWeight="700">◀ Drag / Scroll</text>
        <text x="402" y="124" fill="#FBBF24" fontSize="8.5" fontFamily="monospace">Shift+Wheel: ±0.1g</text>
        <text x="402" y="148" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">▼ -0.1g Fine Step</text>
      </svg>
    );
  }

  if (type === 'olfactory-wheel') {
    return (
      <svg
        viewBox="0 0 520 220"
        className="w-full h-auto rounded-lg bg-[#090C12] border border-slate-800 p-2"
        role="img"
        aria-label="16-Family Olfactory Wheel and Target vs Actual Radar"
      >
        {/* Left: Concentric Wheel */}
        <circle cx="145" cy="110" r="82" fill="none" stroke="#334155" strokeWidth="14" strokeDasharray="24 8" />
        <circle cx="145" cy="110" r="56" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="18 10" strokeOpacity="0.7" />
        <circle cx="145" cy="110" r="28" fill="#111622" stroke="#F59E0B" strokeWidth="2" />
        <text x="145" y="113" fill="#F8FAFC" fontSize="8.5" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          16 FAMILIES
        </text>

        {/* Right: Target vs Actual Radar Polygon */}
        <circle cx="375" cy="110" r="74" fill="#111622" stroke="#1E293B" />
        <circle cx="375" cy="110" r="50" fill="none" stroke="#1E293B" strokeDasharray="2 2" />
        <polygon
          points="375,44 432,88 415,164 330,158 318,82"
          fill="rgba(245, 158, 11, 0.18)"
          stroke="#F59E0B"
          strokeWidth="1.8"
          strokeDasharray="3 2"
        />
        <polygon
          points="375,54 440,96 402,152 338,166 332,90"
          fill="rgba(16, 185, 129, 0.25)"
          stroke="#10B981"
          strokeWidth="2"
        />
        <text x="375" y="202" fill="#34D399" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          TARGET (AMBER) VS. ACTUAL (EMERALD) RADAR
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 520 220"
      className="w-full h-auto rounded-lg bg-[#090C12] border border-slate-800 p-2"
      role="img"
      aria-label="OsmoLab Perfumery Workflow Architecture Diagram"
    >
      {/* 4 Connected Workflow Nodes */}
      {[
        { x: 20, title: '1. ORGAN LIBRARY', sub: 'Catalog · My Workbench', color: '#F59E0B' },
        { x: 145, title: '2. FORMULA LAB', sub: 'Dilutions · IFRA 51', color: '#10B981' },
        { x: 270, title: '3. PYRAMID & WHEEL', sub: 'Isosceles Tiers · Radar', color: '#3B82F6' },
        { x: 395, title: '4. EVALUATIONS', sub: 'Blotter · Maturation', color: '#8B5CF6' },
      ].map((node, i) => (
        <g key={i}>
          <rect
            x={node.x}
            y="48"
            width="105"
            height="124"
            rx="8"
            fill="#111622"
            stroke={node.color}
            strokeWidth="1.6"
          />
          <circle cx={node.x + 52} cy="82" r="14" fill={node.color} fillOpacity="0.2" stroke={node.color} />
          <text x={node.x + 52} y="86" fill="#FFF" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">
            0{i + 1}
          </text>
          <text x={node.x + 52} y="122" fill="#F8FAFC" fontSize="8.5" fontFamily="monospace" fontWeight="700" textAnchor="middle">
            {node.title}
          </text>
          <text x={node.x + 52} y="142" fill="#94A3B8" fontSize="8" textAnchor="middle">
            {node.sub}
          </text>
          {i < 3 && (
            <line
              x1={node.x + 107}
              y1="110"
              x2={node.x + 143}
              y2="110"
              stroke="#34D399"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
          )}
        </g>
      ))}
    </svg>
  );
};

/**
 * Floating Step-by-Step Interactive Guided Tour Banner (Works Across All App Tabs)
 */
export const InteractiveTourOverlay: React.FC<{
  activeStepIndex: number;
  onSelectStep: (index: number) => void;
  onCloseTour: () => void;
  lang?: AppLanguage;
}> = ({ activeStepIndex, onSelectStep, onCloseTour, lang = 'en' }) => {
  const step = GUIDED_TOUR_STEPS[activeStepIndex] || GUIDED_TOUR_STEPS[0];
  const isFirst = activeStepIndex === 0;
  const isLast = activeStepIndex === GUIDED_TOUR_STEPS.length - 1;

  return (
    <div
      data-testid="live-guided-tour-overlay"
      role="region"
      aria-label="Interactive Step-by-Step Guided Tour"
      dir={getDir(lang)}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl rounded-xl bg-[#0E131F]/95 backdrop-blur-md border-2 border-emerald-500/80 shadow-2xl p-4 text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono font-bold text-[11px]">
            STEP {step.stepNumber} OF {GUIDED_TOUR_STEPS.length}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">{step.moduleBadge}</span>
        </div>

        {/* Step Dots */}
        <div className="flex items-center gap-1.5">
          {GUIDED_TOUR_STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStep(idx)}
              aria-label={`Jump to tour step ${s.stepNumber}: ${s.title}`}
              className={`h-2 rounded-full transition-all ${
                idx === activeStepIndex
                  ? 'w-6 bg-emerald-400'
                  : idx < activeStepIndex
                  ? 'w-2 bg-emerald-600/60'
                  : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
          <button
            type="button"
            onClick={onCloseTour}
            aria-label="Exit interactive tour"
            data-testid="exit-live-tour-btn"
            className="ml-3 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Tour</span>
          </button>
        </div>
      </div>

      <div className="py-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-7 space-y-1.5">
          <h3 className="text-sm font-semibold text-white">{step.title}</h3>
          <p className="text-slate-300 leading-relaxed text-[11px]">{step.description}</p>
        </div>
        <div className="md:col-span-5 rounded-lg bg-[#090C12] border border-slate-800 p-2.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
            Try Here on This Screen:
          </div>
          <ul className="space-y-1 text-[11px] text-slate-200">
            {step.interactiveTasks.slice(0, 2).map((task, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{task}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <div className="text-[11px] text-amber-300/90 truncate max-w-md">
          <strong>Pro Tip:</strong> {step.proTip}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onSelectStep(Math.max(0, activeStepIndex - 1))}
            data-testid="tour-prev-step-btn"
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={() => onSelectStep(activeStepIndex + 1)}
              data-testid="tour-next-step-btn"
              className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
            >
              Next Step ({GUIDED_TOUR_STEPS[activeStepIndex + 1].moduleBadge.split('·')[0].trim()})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCloseTour}
              data-testid="tour-finish-btn"
              className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Finish Guided Tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * HELP & GRAPHICAL TUTORIAL VIEW
 */
export const HelpAndTutorialView: React.FC<{
  lang?: AppLanguage;
  onStartLiveTour: (stepIndex?: number) => void;
  onNavigateToModule: (nav: TourTargetNavId) => void;
}> = ({ lang = 'en', onStartLiveTour, onNavigateToModule }) => {
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<'interactive-tour' | 'visual-manual' | 'shortcuts'>(
    'interactive-tour'
  );

  const activeStep = GUIDED_TOUR_STEPS[selectedStepIdx] || GUIDED_TOUR_STEPS[0];

  const toggleChecklistTask = (key: string) => {
    setCompletedChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden" dir={getDir(lang)} data-testid="help-and-tutorial-view">
      {/* Clean Page Title Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-white">
            OsmoLab Illustrated Guide & Interactive Step-by-Step Tour
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore interactive workflow schematics, hands-on formulation checklists, and guided live studio tours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onStartLiveTour(0)}
            data-testid="launch-live-tour-btn"
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            <span>Start Live Interactive App Tour (7 Steps)</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('interactive-tour')}
          data-testid="help-tab-interactive-walkthrough"
          className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors text-center ${
            activeSubTab === 'interactive-tour'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-[#111621] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>1. Step-by-Step Interactive Walkthrough (7 Stages)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('visual-manual')}
          data-testid="help-tab-visual-manual"
          className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors text-center ${
            activeSubTab === 'visual-manual'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-[#111621] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>2. Graphical & Illustrative Architecture Atlas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('shortcuts')}
          data-testid="help-tab-shortcuts"
          className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors text-center ${
            activeSubTab === 'shortcuts'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-[#111621] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>3. Tactile Fader Gestures & Keyboard Shortcuts</span>
        </button>
      </div>

      {/* SUB-TAB 1: STEP-BY-STEP INTERACTIVE WALKTHROUGH STUDIO */}
      {activeSubTab === 'interactive-tour' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 7-Step Vertical Curriculum Rail */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold text-slate-300 px-1 mb-2 flex items-center justify-between">
              <span>Curriculum Steps (Click Any Step)</span>
              <span className="font-mono text-[11px] text-emerald-400">
                Step {activeStep.stepNumber} / {GUIDED_TOUR_STEPS.length}
              </span>
            </div>

            {GUIDED_TOUR_STEPS.map((step, idx) => {
              const isSelected = idx === selectedStepIdx;
              const stepTasksDone = step.interactiveTasks.every(
                (_, tIdx) => completedChecklist[`${step.id}-${tIdx}`]
              );

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepIdx(idx)}
                  data-testid={`walkthrough-step-btn-${step.stepNumber}`}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/60 text-white shadow-md'
                      : 'bg-[#111621] border-slate-800/90 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                      stepTasksDone
                        ? 'bg-emerald-500 text-slate-950'
                        : isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : 'bg-[#0B0E14] text-slate-400 border border-slate-800'
                    }`}
                  >
                    {stepTasksDone ? '✓' : step.stepNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      {step.moduleBadge}
                    </div>
                    <div className="text-xs font-semibold text-white mt-0.5 line-clamp-1">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {step.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Interactive Stage for Selected Step */}
          <div className="lg:col-span-8 rounded-xl bg-[#111621] border border-slate-800 p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                    {activeStep.moduleBadge}
                  </span>
                  <h2 className="text-lg font-sans font-semibold text-white mt-0.5">
                    Step {activeStep.stepNumber}: {activeStep.title}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => onStartLiveTour(selectedStepIdx)}
                    data-testid="launch-step-live-overlay-btn"
                    className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Launch Live Tour at Step {activeStep.stepNumber}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToModule(activeStep.targetNav)}
                    className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center"
                  >
                    Open Module Directly →
                  </button>
                </div>
              </div>

              {/* Graphical Schematic Illustration for Current Step */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Interactive Architectural Schematic
                </div>
                <TutorialIllustrationSVG type={activeStep.diagramType} />
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">{activeStep.description}</p>

              {/* Interactive Hands-On Practice Checklist */}
              <div className="rounded-lg bg-[#0B0E14] border border-slate-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Hands-On Practice Checklist (Click to Mark Completed)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    {
                      activeStep.interactiveTasks.filter(
                        (_, i) => completedChecklist[`${activeStep.id}-${i}`]
                      ).length
                    }{' '}
                    / {activeStep.interactiveTasks.length} Completed
                  </span>
                </div>

                <div className="space-y-2">
                  {activeStep.interactiveTasks.map((task, tIdx) => {
                    const key = `${activeStep.id}-${tIdx}`;
                    const checked = Boolean(completedChecklist[key]);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleChecklistTask(key)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-start gap-2.5 text-xs ${
                          checked
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                            : 'bg-[#111621] border-slate-800 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="mt-0.5 accent-emerald-500 pointer-events-none"
                        />
                        <span className={checked ? 'line-through opacity-80' : ''}>{task}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Master Perfumer Pro-Tip Box */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300">Atelier Master Tip: </strong>
                  {activeStep.proTip}
                </div>
              </div>
            </div>

            {/* Step Navigation Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={selectedStepIdx === 0}
                onClick={() => setSelectedStepIdx((i) => Math.max(0, i - 1))}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-[#0B0E14] hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                Previous Tutorial Step
              </button>

              <div className="text-xs font-mono text-slate-400 text-center">
                Stage {activeStep.stepNumber} of {GUIDED_TOUR_STEPS.length}
              </div>

              <button
                type="button"
                disabled={selectedStepIdx === GUIDED_TOUR_STEPS.length - 1}
                onClick={() =>
                  setSelectedStepIdx((i) => Math.min(GUIDED_TOUR_STEPS.length - 1, i + 1))
                }
                data-testid="walkthrough-next-btn"
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                Next Tutorial Step
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GRAPHICAL & ILLUSTRATIVE ARCHITECTURE ATLAS */}
      {activeSubTab === 'visual-manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="visual-manual-grid">
          {/* Visual Card 1: Uniform Isosceles Trapezoid Pyramid */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
              Visual Guide 01 · Volatility Architecture
            </div>
            <h3 className="text-base font-semibold text-white">
              Uniform Isosceles Trapezoid Pyramid & Influence %
            </h3>
            <TutorialIllustrationSVG type="isosceles-pyramid" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Every tier from <strong>Tier I (Top Notes)</strong> through <strong>Tier V (Base Notes)</strong> is constructed as a symmetrical 4-vertex isosceles trapezoid with a constant side slope (<code className="text-emerald-300">k = 0.65</code>). Next to each tier, the live <strong>Influence Percentage</strong> indicator shows the exact mass contribution of that volatility zone relative to your total formula weight.
            </p>
          </div>

          {/* Visual Card 2: Tactile Vertical Volume Faders */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Visual Guide 02 · Precision Dosing Controls
            </div>
            <h3 className="text-base font-semibold text-white">
              Tactile Vertical Volume Faders & Dynamic Normalization
            </h3>
            <TutorialIllustrationSVG type="formula-fader" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Each raw material card features an audio-console-inspired <strong>Vertical Volume Fader</strong> with LED-style level ticks, pointer-capture vertical dragging, mouse-wheel micro-stepping, and <code className="text-emerald-300">±0.1g</code> nudge buttons. Changing any material weight immediately updates all 5 tier influence percentages.
            </p>
          </div>

          {/* Visual Card 3: Radial Olfactory Wheel & Radar */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
              Visual Guide 03 · Olfactory Taxonomy
            </div>
            <h3 className="text-base font-semibold text-white">
              16-Family Radial Olfactory Wheel & Target/Actual Radar
            </h3>
            <TutorialIllustrationSVG type="olfactory-wheel" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Compare your intended olfactory brief (Amber dashed polygon) against the actual mass-weighted family profile of your formula (Emerald polygon) across 16 classical and modern niche scent families.
            </p>
          </div>

          {/* Visual Card 4: End-to-End Bench Workflow */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-semibold">
              Visual Guide 04 · End-to-End Atelier Pipeline
            </div>
            <h3 className="text-base font-semibold text-white">
              From My Workbench Selection to Sensory Evaluation
            </h3>
            <TutorialIllustrationSVG type="overview" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Follow the 4-stage laboratory pipeline: curate raw materials on My Workbench in the Organ Library, formulate with IFRA 51st guardrails in the Formula Lab, balance evaporation bridges in the Pyramid, and record blotter & maturation evaluations.
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: TACTILE GESTURES & KEYBOARD SHORTCUTS */}
      {activeSubTab === 'shortcuts' && (
        <div className="rounded-xl bg-[#111621] border border-slate-800 p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">
            Tactile Fader Gestures & Studio Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {[
              {
                combo: 'Cmd / Ctrl + K',
                action: 'Open Global Command Palette (instant search across materials, CAS, formulas)',
              },
              {
                combo: 'Drag Vertical Fader Cap',
                action: 'Smoothly adjust raw material weight from 0.0g to 35.0g+ with live % preview',
              },
              {
                combo: 'Mouse Wheel on Fader',
                action: 'Adjust material weight in ±0.5g steps without clicking',
              },
              {
                combo: 'Shift + Mouse Wheel on Fader',
                action: 'Ultra-fine ±0.1g micro-dosing for high-impact materials (Aldehydes, Oud, Galbanum)',
              },
              {
                combo: 'Click Empty Pyramid Tier',
                action: 'Open the Tier Material Picker modal to assign or add raw materials',
              },
              {
                combo: 'Drag & Drop Material Card',
                action: 'Reassign any raw material to a different volatility tier or bridge',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 flex items-center justify-between gap-4"
              >
                <span className="text-slate-300">{item.action}</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-emerald-300 whitespace-nowrap shrink-0">
                  {item.combo}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ABOUT, VERSION, GITHUB REPOSITORY & PRIVACY POLICY VIEW
 */
export const AboutAndPrivacyView: React.FC<{
  lang?: AppLanguage;
  onStartTour?: () => void;
}> = ({ lang = 'en', onStartTour }) => {
  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden" dir={getDir(lang)} data-testid="about-and-privacy-view">
      {/* Clean Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-white">
            About OsmoLab & Privacy Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review platform architecture, open-source formulation engines, release version history, and zero-trust data governance.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1 shrink-0 font-mono text-xs">
          <div
            data-testid="about-version-badge"
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold"
          >
            Version 2.4.0 (Build 2026.10)
          </div>
          <span className="text-[11px] text-slate-400">
            IFRA 51st Amendment Engine · Bilingual EN / FA
          </span>
        </div>
      </div>

      {/* GitHub Repository & Open-Source Reference Card */}
      <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>Official Project GitHub Repository & Source Documentation</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Explore the open-source perfumery calculation engines, uniform isosceles trapezoid pyramid geometry, dilution & IFRA Category 4 compliance formulas, and contribute raw material datasets on GitHub.
            </p>
            <div className="text-[11px] font-mono text-emerald-400 pt-0.5">
              https://github.com/osmolab-atelier/osmolab-perfumery-platform
            </div>
          </div>

          <div className="grid grid-cols-1 sm:flex items-center gap-2.5 shrink-0 w-full lg:w-auto">
            <a
              href="https://github.com/osmolab-atelier/osmolab-perfumery-platform"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="about-github-link"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Code2 className="w-4 h-4 shrink-0" />
              <span>View Project on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            {onStartTour && (
              <button
                type="button"
                onClick={onStartTour}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Open Interactive Tutorial</span>
              </button>
            )}
          </div>
      </div>

      {/* Platform Architecture & Release Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span>Precision Formulation Engine</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Supports neat and prediluted aromatic materials (1%, 10%, 50% in Ethanol, DPG, IPM, TEC), automatic 100.00% normalization, version tree diffs, and cost-per-gram batch economics.
          </p>
        </div>

        <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Symmetrical Isosceles Pyramid</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Models evaporation across 5 uniform isosceles trapezoid tiers (Top, Top-Heart Bridge, Heart, Heart-Base Bridge, Base) with next-to-tier Influence Percentage indicators and 2400×1480px PNG export.
          </p>
        </div>

        <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Scale className="w-4 h-4 text-blue-400" />
            <span>IFRA 51st & Bench Traceability</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Real-time dermal sensitization checks against IFRA 51st Amendment limits (Oakmoss, Bergaptene, Citral, Eugenol, Coumarin) plus physical batch weighing deviation logs.
          </p>
        </div>
      </div>

      {/* Comprehensive Privacy Policy & Data Protection Section */}
      <div
        data-testid="privacy-policy-section"
        className="rounded-xl bg-[#111621] border border-slate-800 p-6 space-y-5"
      >
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Privacy Policy & Intellectual Property Protection</span>
            </div>
            <h2 className="text-lg font-sans font-semibold text-white mt-0.5">
              Privacy Policy, Formula Confidentiality & Data Governance
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Effective Date: October 2026
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>1. Proprietary Formula Confidentiality</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Your fragrance formulas, accord ratios, dilution matrices, and sensory evaluation notes are treated as strictly confidential trade secrets. OsmoLab operates on a <strong>Local-First</strong> persistence model with optional authenticated cloud synchronization scoped exclusively to your personal account UID.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>2. Zero Third-Party Telemetry or Ad Tracking</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              OsmoLab does not embed third-party advertising trackers, behavioral fingerprinting scripts, or data brokers. We never sell, rent, or train external commercial models on your proprietary perfumery formulations or inventory records.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>3. Full Data Portability & Right to Erasure</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              You retain 100% ownership of your work. At any time, you can export your entire workspace snapshot as standard JSON, export formula tables as CSV, download high-resolution Olfactory Pyramid PNG schematics, or permanently purge your cloud account from the Settings tab.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-400" />
              <span>4. IFRA Regulatory & Laboratory Safety Disclaimer</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              While OsmoLab computes active allergen and sensitization percentages using published IFRA 51st Amendment guidelines, software calculations are provided for laboratory research and educational guidance. Commercial fragrance releases must undergo formal GC-MS analysis and certified safety assessment.
            </p>
          </div>
        </div>

        {/* Public Internet Release & Zero-Trust Database Policy Summary */}
        <div
          data-testid="zero-trust-policy-summary"
          className="p-4 rounded-lg bg-[#0B0E14] border border-emerald-500/30 space-y-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              5. Zero-Trust Database Isolation & Public Internet Security Policy
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              Firestore ABAC v2 · RS256 JWT · Anti-IDOR Enforced
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Every cloud operation requires a cryptographically verified Firebase Authentication JWT (<code className="text-emerald-300">email_verified == true</code>). Unauthenticated client headers (<code className="text-emerald-300">x-workspace-uid</code>) are strictly rejected. Cloud Firestore enforces a global <code className="text-emerald-300">allow read, write: if false;</code> default-deny catch-all and restricts <code className="text-emerald-300">/users/&#123;userId&#125;/...</code> subcollections exclusively to <code className="text-emerald-300">request.auth.uid == userId</code> with action-based key allowlists and server timestamp validation.
          </p>
        </div>
      </div>

      {/* Version Changelog & Release History */}
      <div className="rounded-xl bg-[#111621] border border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">
          Release Changelog & Version History
        </h2>
        <div className="space-y-3 text-xs">
          {[
            {
              ver: 'v2.4.0 (Current)',
              date: '2026-10-24',
              notes:
                'Uniform symmetrical isosceles trapezoid geometry across all 5 Olfactory Pyramid tiers (Top, Bridges, Heart, Base); Interactive Step-by-Step Guided Tour & Graphical Help Manual; About & Privacy Policy governance portal.',
            },
            {
              ver: 'v2.3.0',
              date: '2026-10-18',
              notes:
                'Added Next-to-Tier Influence Percentage indicators, vertical pyramid stacking above full-width tier cards, Empty Tier click-to-add material popover, and 2400×1480px High-Res PNG Export.',
            },
            {
              ver: 'v2.2.0',
              date: '2026-10-10',
              notes:
                'Introduced tactile Vertical Volume Faders with pointer-capture drag, wheel micro-stepping, and Bilingual English / Persian (RTL) localization.',
            },
          ].map((rel, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <span className="font-mono font-bold text-emerald-400">{rel.ver}</span>
                <span className="text-slate-500 mx-2">·</span>
                <span className="text-slate-200">{rel.notes}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 shrink-0">{rel.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
