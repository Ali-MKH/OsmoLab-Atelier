import React, { useState, useRef, useEffect } from 'react';
import {
  ExperimentEntry,
  Formula,
  RawMaterial,
  ScentMemoryRecord,
  SensoryEvaluation,
} from '../domain/types';
import {
  Check,
  Mic,
  Clock,
  Brain,
  Plus,
  Send,
} from 'lucide-react';

interface ProductionAndJournalViewProps {
  mode: 'experiments' | 'evaluations' | 'memory';
  formulas: Formula[];
  activeFormula: Formula;
  materials: RawMaterial[];
  experiments: ExperimentEntry[];
  evaluations: SensoryEvaluation[];
  scentMemories: ScentMemoryRecord[];
  onAddExperiment: (entry: Omit<ExperimentEntry, 'id'>) => Promise<void>;
  onAddEvaluation: (
    evaluation: Omit<SensoryEvaluation, 'id' | 'createdAt'>
  ) => Promise<void>;
  onUpdateScentMemory: (
    record: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
  ) => Promise<void>;
}

const EVALUATION_CHECKPOINTS = [
  'Immediately',
  '5 minutes',
  '15 minutes',
  '30 minutes',
  '1 hour',
  '2 hours',
  '4 hours',
  '8 hours',
  '24 hours',
  'Day 7 Maturation',
  'Day 14 Maturation',
  'Day 30 Maturation',
];

const EVALUATION_DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: 'opening', label: 'Opening' },
  { key: 'heart', label: 'Heart' },
  { key: 'drydown', label: 'Drydown' },
  { key: 'diffusion', label: 'Diffusion' },
  { key: 'projection', label: 'Projection' },
  { key: 'longevity', label: 'Longevity' },
  { key: 'balance', label: 'Balance' },
  { key: 'transparency', label: 'Transparency' },
  { key: 'texture', label: 'Texture' },
  { key: 'naturalness', label: 'Naturalness' },
  { key: 'complexity', label: 'Complexity' },
  { key: 'sweetness', label: 'Sweetness' },
  { key: 'freshness', label: 'Freshness' },
  { key: 'dryness', label: 'Dryness' },
  { key: 'warmth', label: 'Warmth' },
  { key: 'originality', label: 'Originality' },
  { key: 'targetMatch', label: 'Target Match' },
];

export const ProductionAndJournalView: React.FC<ProductionAndJournalViewProps> = ({
  mode,
  formulas,
  activeFormula,
  materials,
  experiments,
  evaluations,
  scentMemories,
  onAddExperiment,
  onAddEvaluation,
  onUpdateScentMemory,
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Experimental Journal State
  const [expStageLabel, setExpStageLabel] = useState('Day 14');
  const [expObservation, setExpObservation] = useState('');

  // Sensory Evaluation & Voice Note State
  const [evalCheckpoint, setEvalCheckpoint] = useState('1 hour');
  const [evalOpeningNotes, setEvalOpeningNotes] = useState('');
  const [evalHeartNotes, setEvalHeartNotes] = useState('');
  const [evalDrydownNotes, setEvalDrydownNotes] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState(
    '43 minutes after application. Green opening has softened significantly. Cedar now feels too dry.'
  );
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState<number>(14);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState<number>(0);
  const [voiceTakeCount, setVoiceTakeCount] = useState<number>(0);
  const pointerDownTimeRef = useRef<number>(0);
  const autoStopTimerRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    };
  }, []);

  const [evalScores, setEvalScores] = useState<Record<string, number>>({
    opening: 9,
    heart: 8,
    drydown: 7,
    diffusion: 8,
    projection: 7,
    longevity: 8,
    balance: 8,
    transparency: 9,
    texture: 8,
    naturalness: 9,
    complexity: 8,
    sweetness: 1,
    freshness: 8,
    dryness: 6,
    warmth: 5,
    originality: 8,
    targetMatch: 8,
  });

  // Scent Memory & Blind Trainer State
  const [blindQuizIndex, setBlindQuizIndex] = useState(0);
  const [blindGuessId, setBlindGuessId] = useState<number>(materials[0]?.id || 1);
  const [blindQuizFeedback, setBlindQuizFeedback] = useState<string | null>(null);

  const handleAddExperimentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expObservation.trim()) return;
    await onAddExperiment({
      formulaId: activeFormula.id,
      formulaVersionLabel: activeFormula.activeVersionLabel,
      stageLabel: expStageLabel,
      observation: expObservation.trim(),
      recordedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    setExpObservation('');
    setToastMsg(`Logged ${expStageLabel} observation to Experimental Journal`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSaveEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const avg =
      Object.values(evalScores).reduce((a, b) => a + b, 0) /
      Object.values(evalScores).length;
    await onAddEvaluation({
      formulaId: activeFormula.id,
      formulaVersionLabel: activeFormula.activeVersionLabel,
      checkpoint: evalCheckpoint,
      overallScore: Number(avg.toFixed(1)),
      scores: evalScores,
      evaluatedFacets: {
        Green: evalScores.freshness || 8,
        Woody: evalScores.dryness || 7,
        Musky: evalScores.transparency || 7,
        Sweet: evalScores.sweetness || 1,
      },
      openingNotes:
        evalOpeningNotes.trim() ||
        'Crisp rain-washed bergamot and green leaf opening.',
      heartNotes:
        evalHeartNotes.trim() ||
        'Transparent Hedione and Violet Leaf petrichor.',
      drydownNotes:
        evalDrydownNotes.trim() ||
        voiceTranscript,
      voiceTranscript,
      voiceDurationSeconds,
    });
    setEvalOpeningNotes('');
    setEvalHeartNotes('');
    setEvalDrydownNotes('');
    setToastMsg(`Saved ${evalCheckpoint} Sensory Evaluation & Voice Note`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const finishVoiceRecording = (recordedSec?: number) => {
    if (autoStopTimerRef.current) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    setIsRecordingVoice(false);

    const nextTake = voiceTakeCount + 1;
    setVoiceTakeCount(nextTake);
    const finalDur = Math.max(
      3,
      Math.round(recordedSec || recordingElapsedSec || 6)
    );
    setVoiceDurationSeconds(finalDur);
    setRecordingElapsedSec(0);

    const sampleDictations = [
      `${evalCheckpoint} blotter check on ${activeFormula.name} (${activeFormula.activeVersionLabel}): Green opening remains luminous and dewy; Helvetolide softens the cedarwood drydown nicely.`,
      `${evalCheckpoint} skin & blotter evaluation — ${activeFormula.name} (${activeFormula.activeVersionLabel}): Bergamot FCF and Violet Leaf 10% project a crisp rain-washed canopy; oakmoss depth is balanced without heaviness.`,
      `${evalCheckpoint} maturation note on ${activeFormula.name} (${activeFormula.activeVersionLabel}): Hedione diffusion lifts the heart; drydown is airy, woody-musky, and completely unsweetened.`,
    ];
    const nextTranscript =
      sampleDictations[(nextTake - 1) % sampleDictations.length];

    setVoiceTranscript(nextTranscript);
    setToastMsg(`Voice note transcribed (${finalDur}s) — ready to edit or apply below.`);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const startVoiceRecording = () => {
    if (isRecordingVoice) return;
    setIsRecordingVoice(true);
    setRecordingElapsedSec(0.1);
    const startedAt = Date.now();

    if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = window.setInterval(() => {
      const elapsed = Number(((Date.now() - startedAt) / 1000).toFixed(1));
      setRecordingElapsedSec(elapsed);
    }, 100);
  };

  const handleVoicePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDownTimeRef.current = Date.now();
    if (isRecordingVoice) {
      // Second tap while recording: stop immediately and transcribe
      pointerDownTimeRef.current = -1;
      finishVoiceRecording(Math.max(3, Math.round(recordingElapsedSec || 4)));
      return;
    }
    startVoiceRecording();
  };

  const handleVoicePointerUp = () => {
    if (!isRecordingVoice || pointerDownTimeRef.current < 0) return;
    const heldMs = Date.now() - pointerDownTimeRef.current;
    // If user held the button for >= 280ms, release immediately finishes & transcribes
    if (heldMs >= 280) {
      finishVoiceRecording(Math.max(2, Math.round(heldMs / 250)));
    } else {
      // Quick tap on mobile or desktop: stays recording until tapped again (or auto-stops after 2.5s)
      if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = window.setTimeout(() => {
        finishVoiceRecording(5);
      }, 2500);
    }
  };

  const handleVoiceClick = () => {
    // Fallback for keyboard (Enter/Space) where pointerDown didn't fire
    if (pointerDownTimeRef.current < 0) {
      pointerDownTimeRef.current = 0;
      return;
    }
    if (Date.now() - pointerDownTimeRef.current > 600) {
      if (isRecordingVoice) {
        finishVoiceRecording(5);
      } else {
        startVoiceRecording();
        if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = window.setTimeout(() => {
          finishVoiceRecording(5);
        }, 2500);
      }
    }
  };

  const handleApplyTranscriptToNotes = () => {
    setEvalOpeningNotes(
      `Luminous rain-washed bergamot and green leaf opening (${evalCheckpoint}).`
    );
    setEvalHeartNotes(
      'Transparent Hedione and dewy Violet Leaf 10% petrichor canopy.'
    );
    setEvalDrydownNotes(voiceTranscript);
    setToastMsg('Applied voice dictation to Opening, Heart & Drydown fields');
    setTimeout(() => setToastMsg(null), 2800);
  };

  // 1. EXPERIMENTAL JOURNAL MODE
  if (mode === 'experiments') {
    return (
      <div className="space-y-6">
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600 px-4 py-2.5 text-xs text-emerald-200">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-sans font-semibold text-white">
            Experimental Journal & Maturation Timeline
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological evaporation and maceration log linked to formula version.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Log New Checkpoint */}
          <form
            onSubmit={handleAddExperimentSubmit}
            className="lg:col-span-4 rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4 text-xs"
          >
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Log Chronological Checkpoint
            </h2>
            <div>
              <label className="block text-slate-400 mb-1">Active Formula</label>
              <div className="p-2.5 rounded bg-[#0B0E14] border border-slate-800 font-mono-tabular text-slate-200">
                {activeFormula.name} ({activeFormula.activeVersionLabel})
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Stage / Elapsed Time</label>
              <select
                value={expStageLabel}
                onChange={(e) => setExpStageLabel(e.target.value)}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 text-white"
              >
                {[
                  'Day 0',
                  '15 min',
                  '2 h',
                  '24 h',
                  'Day 3',
                  'Day 7',
                  'Day 14',
                  'Day 30',
                ].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Sensory & Chemical Observation *</label>
              <textarea
                rows={4}
                required
                value={expObservation}
                onChange={(e) => setExpObservation(e.target.value)}
                placeholder="e.g., Day 14: Oakmoss and Violet Leaf have integrated; final drydown is much smoother."
                className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2.5 text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md transition-colors"
            >
              Append to Timeline
            </button>
          </form>

          {/* Right: Chronological Timeline */}
          <div className="lg:col-span-8 rounded-lg bg-[#111621] border border-slate-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">
              Chronological Experiment Log ({experiments.length} Entries)
            </h2>
            <div className="space-y-4">
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-semibold text-emerald-400">
                        {exp.stageLabel}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="font-medium text-white">
                        {formulas.find((f) => f.id === exp.formulaId)?.name || 'Forest Study'}{' '}
                        ({exp.formulaVersionLabel})
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {exp.observation}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                    {exp.recordedAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. SENSORY EVALUATIONS & VOICE NOTES MODE
  if (mode === 'evaluations') {
    return (
      <div className="space-y-6">
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600 px-4 py-2.5 text-xs text-emerald-200">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-sans font-semibold text-white">
            Sensory Evaluations & Voice Dictation Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Structured 17-dimension olfactory evaluation templates and fast Hold-to-Record blotter voice notes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Evaluation Form + Voice Recorder */}
          <form
            onSubmit={handleSaveEvaluationSubmit}
            className="lg:col-span-7 rounded-lg bg-[#111621] border border-slate-800 p-4 sm:p-6 space-y-5 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Record Sensory Evaluation — {activeFormula.name} ({activeFormula.activeVersionLabel})
                </h2>
              </div>
              <select
                aria-label="Evaluation Checkpoint"
                value={evalCheckpoint}
                onChange={(e) => setEvalCheckpoint(e.target.value)}
                className="w-full sm:w-auto bg-[#0B0E14] border border-slate-800 rounded px-3 py-2 sm:py-1.5 text-white font-mono-tabular"
              >
                {EVALUATION_CHECKPOINTS.map((cp) => (
                  <option key={cp} value={cp}>
                    Checkpoint: {cp}
                  </option>
                ))}
              </select>
            </div>

            {/* Hold to Record Voice Note Box — Responsive on Mobile & Desktop */}
            <div
              data-testid="voice-dictation-box"
              className={`p-3.5 sm:p-4 rounded-lg bg-[#0B0E14] border space-y-3 transition-colors ${
                isRecordingVoice ? 'border-rose-500/80' : 'border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <Mic
                      className={`w-4 h-4 shrink-0 ${
                        isRecordingVoice
                          ? 'text-rose-400 animate-pulse'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span>Fast Voice Note & Speech-to-Text Transcription</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Hold button down to dictate blotter impressions, or tap once to record & auto-transcribe.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    data-testid="hold-record-voice-btn"
                    onPointerDown={handleVoicePointerDown}
                    onPointerUp={handleVoicePointerUp}
                    onPointerCancel={() => {
                      if (isRecordingVoice) finishVoiceRecording(3);
                    }}
                    onClick={handleVoiceClick}
                    className={`w-full sm:w-auto min-h-[42px] sm:min-h-0 px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 select-none touch-manipulation cursor-pointer ${
                      isRecordingVoice
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isRecordingVoice
                        ? `Recording Dictation (${recordingElapsedSec.toFixed(1)}s)...`
                        : 'Hold to Record Voice Note'}
                    </span>
                  </button>
                </div>
              </div>

              {isRecordingVoice && (
                <div
                  data-testid="voice-recording-indicator"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-rose-950/40 border border-rose-500/40 text-[11px] font-mono-tabular text-rose-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>Listening to blotter dictation ({evalCheckpoint})...</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => finishVoiceRecording(Math.max(3, recordingElapsedSec))}
                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold"
                  >
                    Stop & Transcribe
                  </button>
                </div>
              )}

              <textarea
                rows={2}
                aria-label="Voice note transcription"
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                className="w-full bg-[#111621] border border-slate-800 rounded p-2.5 text-slate-200 font-mono-tabular text-xs"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="font-mono-tabular">
                  Last dictation duration: {voiceDurationSeconds}s
                </span>
                <button
                  type="button"
                  data-testid="apply-voice-to-notes-btn"
                  onClick={handleApplyTranscriptToNotes}
                  className="px-2.5 py-1 rounded bg-[#111621] border border-slate-700 hover:border-emerald-500/60 text-emerald-400 font-medium transition-colors"
                >
                  Apply Transcript to Evaluation Notes →
                </button>
              </div>
            </div>

            {/* 17 Sensory Dimensions Grid */}
            <div>
              <h3 className="font-semibold text-slate-300 mb-3">
                17 Sensory Evaluation Dimensions (1–10 Scale)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EVALUATION_DIMENSIONS.map((dim) => (
                  <div
                    key={dim.key}
                    className="p-2.5 rounded bg-[#0B0E14] border border-slate-800/80"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300">{dim.label}</span>
                      <span className="font-mono-tabular text-emerald-400 font-semibold">
                        {evalScores[dim.key] ?? 7}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={evalScores[dim.key] ?? 7}
                      aria-label={dim.label}
                      onChange={(e) =>
                        setEvalScores((prev) => ({
                          ...prev,
                          [dim.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Opening Notes</label>
                <input
                  type="text"
                  value={evalOpeningNotes}
                  onChange={(e) => setEvalOpeningNotes(e.target.value)}
                  placeholder="Top note impression..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Heart Notes</label>
                <input
                  type="text"
                  value={evalHeartNotes}
                  onChange={(e) => setEvalHeartNotes(e.target.value)}
                  placeholder="Heart development..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Drydown Notes</label>
                <input
                  type="text"
                  value={evalDrydownNotes}
                  onChange={(e) => setEvalDrydownNotes(e.target.value)}
                  placeholder="Base & residual tenacity..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto justify-center px-5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Save Sensory Evaluation
              </button>
            </div>
          </form>

          {/* Past Evaluations Feed */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">
              Recorded Sensory Evaluations ({evaluations.length})
            </h2>
            {evaluations.map((ev) => (
              <div
                key={ev.id}
                className="rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-semibold text-white">
                      {formulas.find((f) => f.id === ev.formulaId)?.name || 'Forest Study'}{' '}
                      ({ev.formulaVersionLabel})
                    </span>
                    <span className="text-slate-500 mx-1.5">·</span>
                    <span className="text-emerald-400 font-mono-tabular">
                      {ev.checkpoint}
                    </span>
                  </div>
                  <span className="font-mono-tabular font-semibold text-white">
                    Score: {ev.overallScore}/10
                  </span>
                </div>
                <div className="space-y-1 text-slate-300">
                  <div>
                    <strong className="text-slate-400">Opening:</strong> {ev.openingNotes}
                  </div>
                  <div>
                    <strong className="text-slate-400">Heart:</strong> {ev.heartNotes}
                  </div>
                  <div>
                    <strong className="text-slate-400">Drydown:</strong> {ev.drydownNotes}
                  </div>
                </div>
                {ev.voiceTranscript && (
                  <div className="p-2.5 rounded bg-[#0B0E14] border border-slate-800/80 text-slate-300 font-mono-tabular text-[11px]">
                    <span className="text-emerald-400 block mb-0.5">
                      Voice Note Transcript ({ev.voiceDurationSeconds}s):
                    </span>
                    “{ev.voiceTranscript}”
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. SCENT MEMORY TRAINER MODE
  const quizMaterial = materials[blindQuizIndex % materials.length] || materials[0];

  const handleBlindGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCorrect = Number(blindGuessId) === quizMaterial.id;
    const existingMem = scentMemories.find((m) => m.materialId === quizMaterial.id);

    await onUpdateScentMemory({
      materialId: quizMaterial.id,
      myPerception: existingMem?.myPerception || quizMaterial.facets,
      associatedMemories: existingMem?.associatedMemories || ['Perfumery school blind drill'],
      emotions: existingMem?.emotions || ['Focused'],
      mentalImages: existingMem?.mentalImages || quizMaterial.descriptiveNotes,
      places: existingMem?.places || 'Olfactory Studio',
      colors: existingMem?.colors || '#10B981',
      textures: existingMem?.textures || quizMaterial.texture,
      temperature: existingMem?.temperature || quizMaterial.temperatureImpression,
      strengthScore: existingMem?.strengthScore ?? quizMaterial.intensity,
      familiarityScore: existingMem?.familiarityScore ?? 8,
      blindConfidenceScore: existingMem?.blindConfidenceScore ?? 8,
      recognitionTrials: (existingMem?.recognitionTrials ?? 10) + 1,
      recognitionCorrect:
        (existingMem?.recognitionCorrect ?? 8) + (isCorrect ? 1 : 0),
    });

    setBlindQuizFeedback(
      isCorrect
        ? `✓ Correct! Identified ${quizMaterial.name} (${quizMaterial.primaryFamily}). Recognition statistics updated.`
        : `✕ That specimen was ${quizMaterial.name}. Logged trial to your Scent Memory profile.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-sans font-semibold text-white">
          Scent Memory & Blind Recognition Training System
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Train olfactory memory associations, emotional triggers, and empirical blind-smelling recognition accuracy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Empirical Material Recognition Accuracy */}
        <div className="lg:col-span-5 rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              Material Recognition Statistics
            </h2>
            <span className="text-[11px] text-slate-400">Empirical User Trials</span>
          </div>

          <div className="space-y-3">
            {scentMemories.map((mem) => {
              const mat = materials.find((m) => m.id === mem.materialId);
              const pct =
                mem.recognitionTrials > 0
                  ? Math.round((mem.recognitionCorrect / mem.recognitionTrials) * 100)
                  : 0;
              return (
                <div
                  key={mem.id}
                  className="p-3.5 rounded-md bg-[#0B0E14] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      {mat?.name || `Material #${mem.materialId}`}
                    </span>
                    <span className="font-mono-tabular font-semibold text-emerald-400">
                      {pct}% ({mem.recognitionCorrect}/{mem.recognitionTrials} trials)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span>Perception: {mem.myPerception.join(' · ')}</span>
                    <span className="mx-1.5">·</span>
                    <span>Memories: {mem.associatedMemories.join(', ')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive Blind Smelling Drill */}
        <div className="lg:col-span-7 rounded-lg bg-[#111621] border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              Blind Olfactory Identification Exercise
            </h2>
            <button
              type="button"
              onClick={() => {
                setBlindQuizIndex((i) => i + 1);
                setBlindQuizFeedback(null);
              }}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded flex items-center justify-center"
            >
              Next Blind Specimen →
            </button>
          </div>

          <div className="p-4 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-2 text-xs">
            <div className="text-slate-400 font-mono-tabular">
              Specimen Cue Card — Volatility: {quizMaterial.volatility} · Intensity:{' '}
              {quizMaterial.intensity}/10 · Substantivity: {quizMaterial.substantivityHours} h
            </div>
            <p className="text-sm text-white leading-relaxed">
              “{quizMaterial.descriptiveNotes}”
            </p>
            <div className="text-slate-400 pt-1">
              Facets: <strong className="text-emerald-300">{quizMaterial.facets.join(' · ')}</strong> ·
              Texture: {quizMaterial.texture} ({quizMaterial.temperatureImpression})
            </div>
          </div>

          <form onSubmit={handleBlindGuessSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <select
              aria-label="Select Raw Material Identification"
              value={blindGuessId}
              onChange={(e) => setBlindGuessId(Number(e.target.value))}
              className="w-full sm:flex-1 bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.primaryFamily})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md whitespace-nowrap shrink-0 flex items-center justify-center"
            >
              Verify Blind Identification
            </button>
          </form>

          {blindQuizFeedback && (
            <div className="p-3 rounded-md bg-slate-800/80 border border-slate-700 text-xs text-emerald-300">
              {blindQuizFeedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
