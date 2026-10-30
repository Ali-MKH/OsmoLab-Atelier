import React, { useState } from 'react';
import {
  ClipboardCheck,
  FlaskConical,
  NotebookPen,
  Sparkles,
  Check,
} from 'lucide-react';
import { ProductionAndJournalView as BaseEvaluationAndJournalView } from '../../components/ProductionAndJournalView';
import type {
  ExperimentEntry,
  Formula,
  RawMaterial,
  ScentMemoryRecord,
  SensoryEvaluation,
} from '../../domain/types';

export interface EvaluationAndJournalViewProps {
  mode: 'experiments' | 'evaluations' | 'memory';
  activeFormula: Formula | null;
  formulas?: Formula[];
  materials: RawMaterial[];
  experiments: ExperimentEntry[];
  evaluations: SensoryEvaluation[];
  scentMemories: ScentMemoryRecord[];
  onAddExperiment: (payload: Omit<ExperimentEntry, 'id'>) => Promise<void>;
  onAddEvaluation: (
    payload: Omit<SensoryEvaluation, 'id' | 'createdAt'>
  ) => Promise<void>;
  onSaveScentMemory?: (
    payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
  ) => Promise<void>;
  onUpdateScentMemory?: (
    payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
  ) => Promise<void>;
  onSelectFormula?: (formulaId: number) => void;
  onOpenFormulaLab?: () => void;
  onOpenCatalog?: () => void;
}

export const EvaluationAndJournalView: React.FC<EvaluationAndJournalViewProps> = ({
  mode,
  activeFormula,
  formulas = [],
  materials,
  experiments,
  evaluations,
  scentMemories,
  onAddExperiment,
  onAddEvaluation,
  onSaveScentMemory,
  onUpdateScentMemory,
  onSelectFormula,
  onOpenFormulaLab,
  onOpenCatalog,
}) => {
  const [selectedMemMatId, setSelectedMemMatId] = useState<number | null>(
    materials[0]?.id ?? null
  );
  const [firstImpression, setFirstImpression] = useState('');
  const [evolutionNotes, setEvolutionNotes] = useState('');
  const [personalAssociation, setPersonalAssociation] = useState('');
  const [emotionalTagsStr, setEmotionalTagsStr] = useState('Calm, Luminous');
  const [strengthScore, setStrengthScore] = useState(7);
  const [familiarityScore, setFamiliarityScore] = useState(8);
  const [blindConfidence, setBlindConfidence] = useState(7);
  const [memToast, setMemToast] = useState<string | null>(null);

  const saveMemoryHandler = onSaveScentMemory || onUpdateScentMemory;

  // 1. Zero-Formula safety for Evaluations and Experiments modes
  if (!activeFormula && (mode === 'evaluations' || mode === 'experiments')) {
    const isEval = mode === 'evaluations';
    return (
      <div
        data-testid="evaluate-zero-formula-empty-state"
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-white">
              {isEval
                ? 'Sensory Evaluation & Blotter Scoring'
                : 'Maceration & Experiment Journal'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isEval
                ? 'Evaluate opening, heart, drydown, diffusion, and longevity checkpoints for an active formula.'
                : 'Log maturation observations, batch trials, and olfactory shifts over time.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#111621] border border-slate-800 p-8 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            {isEval ? (
              <ClipboardCheck className="w-6 h-6" />
            ) : (
              <NotebookPen className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-white">
              {formulas.length === 0
                ? 'No Formula Available for Evaluation'
                : 'Select a Formula to Begin Evaluation'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
              {formulas.length === 0
                ? 'Sensory evaluations and maceration logs link directly to a saved Formula version. Create your first Formula in Formula Lab to record blotter checkpoints and experiment observations.'
                : 'Choose one of your saved Formulas below or open Formula Lab to create a new formulation study.'}
            </p>
          </div>

          {formulas.length > 0 && onSelectFormula && (
            <div className="pt-2 max-w-md mx-auto space-y-2 text-left">
              <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 block">
                Available Formulas ({formulas.length})
              </span>
              {formulas.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFormula(f.id)}
                  className="w-full p-3 rounded-lg bg-[#0B0E14] border border-slate-800 hover:border-emerald-500/50 text-left flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <div className="font-semibold text-white">{f.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {f.activeVersionLabel} · {f.intendedProduct}
                    </div>
                  </div>
                  <span className="text-emerald-400 font-medium">Select →</span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            {onOpenFormulaLab && (
              <button
                type="button"
                data-testid="evaluate-open-formula-lab-btn"
                onClick={onOpenFormulaLab}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                <span>
                  {formulas.length === 0
                    ? 'Create First Formula in Formula Lab →'
                    : 'Open Formula Lab →'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Scent Memory Trainer mode when materials list is empty or activeFormula is null
  if (mode === 'memory' && (materials.length === 0 || !activeFormula)) {
    const activeMat =
      materials.find((m) => m.id === selectedMemMatId) || materials[0] || null;

    if (!activeMat) {
      return (
        <div
          data-testid="memory-empty-materials-state"
          className="space-y-6"
        >
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-sans font-semibold text-white">
              Scent Memory Trainer & Blind Recognition
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Build personal odor associations, evaporation notes, and blind recognition confidence for materials on My Shelf.
            </p>
          </div>
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-8 text-center max-w-xl mx-auto space-y-4">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
            <h2 className="text-base font-semibold text-white">
              Add Materials to My Shelf to Train Scent Memory
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your Shelf currently has no materials loaded. Browse the 815-material Catalog and add ingredients to My Shelf to begin recording personal scent memories.
            </p>
            {onOpenCatalog && (
              <button
                type="button"
                onClick={onOpenCatalog}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Browse Material Catalog →
              </button>
            )}
          </div>
        </div>
      );
    }

    const handleMemorySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!saveMemoryHandler) return;
      await saveMemoryHandler({
        materialId: activeMat.id,
        myPerception: [
          firstImpression.trim() || 'Clean radiative opening on blotter.',
          evolutionNotes.trim() || 'Maintains character through heart into drydown.',
        ],
        associatedMemories: [
          personalAssociation.trim() || 'Atelier reference study.',
        ],
        emotions: emotionalTagsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mentalImages: evolutionNotes.trim(),
        places: '',
        colors: '',
        textures: activeMat.texture || '',
        temperature: activeMat.temperatureImpression || 'Neutral',
        strengthScore,
        familiarityScore,
        blindConfidenceScore: blindConfidence,
        recognitionTrials: 1,
        recognitionCorrect: 1,
      });
      setFirstImpression('');
      setEvolutionNotes('');
      setPersonalAssociation('');
      setMemToast(`Saved scent memory for ${activeMat.name}`);
      setTimeout(() => setMemToast(null), 3000);
    };

    return (
      <div className="space-y-6">
        {memToast && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600 px-4 py-2.5 text-xs text-emerald-200 shadow-xl">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{memToast}</span>
          </div>
        )}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-sans font-semibold text-white">
            Scent Memory Trainer & Personal Associations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Record blotter impressions, personal scent memories, and familiarity scores for your Shelf materials.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleMemorySubmit}
            className="lg:col-span-6 rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-4 text-xs"
          >
            <h2 className="text-sm font-semibold text-white">
              Log Material Scent Memory
            </h2>
            <div>
              <label className="block text-slate-400 mb-1">Material</label>
              <select
                value={activeMat.id}
                onChange={(e) => setSelectedMemMatId(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 text-white"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.primaryFamily} · {m.volatility})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">First Impression (0–15 min)</label>
              <input
                type="text"
                value={firstImpression}
                onChange={(e) => setFirstImpression(e.target.value)}
                placeholder="Immediate top-note character on blotter..."
                className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Drydown Evolution</label>
              <input
                type="text"
                value={evolutionNotes}
                onChange={(e) => setEvolutionNotes(e.target.value)}
                placeholder="How the material evolves after 1–4 hours..."
                className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Personal Association / Memory</label>
              <input
                type="text"
                value={personalAssociation}
                onChange={(e) => setPersonalAssociation(e.target.value)}
                placeholder="Personal memory anchor..."
                className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Strength ({strengthScore}/10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={strengthScore}
                  onChange={(e) => setStrengthScore(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Familiarity ({familiarityScore}/10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={familiarityScore}
                  onChange={(e) => setFamiliarityScore(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Confidence ({blindConfidence}/10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={blindConfidence}
                  onChange={(e) => setBlindConfidence(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Save Scent Memory
            </button>
          </form>

          <div className="lg:col-span-6 rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-white">
              Recorded Scent Memories ({scentMemories.length})
            </h2>
            {scentMemories.length === 0 ? (
              <p className="text-slate-400">
                No scent memories recorded yet. Save your first blotter impression on the left.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {scentMemories.map((mem) => {
                  const mat = materials.find((m) => m.id === mem.materialId);
                  return (
                    <div
                      key={mem.id}
                      className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {mat?.name || `Material #${mem.materialId}`}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-emerald-400">
                          Confidence {mem.blindConfidenceScore}/10
                        </span>
                      </div>
                      <p className="text-slate-300">
                        {mem.associatedMemories.join(' · ')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {mem.myPerception.join(' · ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <BaseEvaluationAndJournalView
      mode={mode}
      formulas={formulas}
      activeFormula={activeFormula!}
      materials={materials}
      experiments={experiments}
      evaluations={evaluations}
      scentMemories={scentMemories}
      onAddExperiment={onAddExperiment}
      onAddEvaluation={onAddEvaluation}
      onUpdateScentMemory={
        saveMemoryHandler ||
        (async () => {
          // no-op fallback if neither provided
        })
      }
    />
  );
};
