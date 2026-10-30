import React, { useState } from 'react';
import {
  Bot,
  FlaskConical,
  Send,
  Sparkles,
} from 'lucide-react';
import { OlfactoryMentorView as BaseOlfactoryMentorView } from '../../components/MentorAndSearchModal';
import type {
  AccordDefinition,
  Formula,
  FormulaLineItem,
  MaterialRegulatoryLimit,
  RawMaterial,
  SensoryEvaluation,
} from '../../domain/types';

export interface OlfactoryMentorViewProps {
  activeFormula: Formula | null;
  materials: RawMaterial[];
  evaluations?: SensoryEvaluation[];
  accords?: AccordDefinition[];
  regulatoryLimits?: MaterialRegulatoryLimit[];
  authHeaders?: Record<string, string>;
  getAuthHeaders?: () => Promise<Record<string, string>>;
  onUpdateFormulaItems?: (items: FormulaLineItem[]) => void;
  onNavigateToWheel?: () => void;
  onInspectMaterial?: (id: number) => void;
  onOpenFormulaLab?: () => void;
  onCreateExperimentalBranch?: (
    branchLabel: string,
    branchNotes: string,
    modifiedItems: FormulaLineItem[]
  ) => Promise<void>;
}

interface GenericMentorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const GENERIC_PROMPTS = [
  'How do I build a classic Bergamot–Hedione–Iso E Super radiative backbone?',
  'What is the difference between Top-Heart (TH) and Heart-Base (HB) bridge notes?',
  'How are IFRA Category 4 limits calculated from concentrate vs. finished product %?',
  'Which materials on My Shelf work best as a clean musky fixative?',
];

export const OlfactoryMentorView: React.FC<OlfactoryMentorViewProps> = ({
  activeFormula,
  materials,
  evaluations = [],
  accords = [],
  authHeaders = {},
  getAuthHeaders,
  onUpdateFormulaItems,
  onNavigateToWheel,
  onInspectMaterial,
  onOpenFormulaLab,
  onCreateExperimentalBranch,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<GenericMentorMessage[]>([
    {
      id: 'welcome-generic',
      role: 'assistant',
      content:
        'Welcome to the Olfactory Mentor (Generic Perfumery Consultation Mode). No active formula is currently selected. Ask about raw material volatility, accord proportions, IFRA / EU regulatory calculations, or create a formula in Formula Lab for formula-specific structural diagnostics.',
      timestamp: 'Ready',
    },
  ]);

  if (activeFormula) {
    return (
      <BaseOlfactoryMentorView
        activeFormula={activeFormula}
        materials={materials}
        evaluations={evaluations}
        accords={accords}
        authHeaders={authHeaders}
        onUpdateFormulaItems={onUpdateFormulaItems}
        onNavigateToWheel={onNavigateToWheel}
        onInspectMaterial={onInspectMaterial}
        onOpenFormulaLab={onOpenFormulaLab}
        onCreateExperimentalBranch={
          onCreateExperimentalBranch ||
          (async () => {
            // no-op fallback
          })
        }
      />
    );
  }

  const handleSendGenericPrompt = async (textToSubmit?: string) => {
    const query = (textToSubmit ?? prompt).trim();
    if (!query || loading) return;

    const userMsg: GenericMentorMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSubmit) setPrompt('');
    setLoading(true);

    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : {};
      let replyText = '';
      if (headers.Authorization) {
        const res = await fetch('/api/mentor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            prompt: query,
            context: {
              mode: 'generic',
              activeFormula: null,
              shelfCount: materials.length,
              accordCount: accords.length,
            },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (data.text) {
            replyText = data.text;
          }
        }
      }

      if (!replyText) {
        replyText =
          `### Generic Perfumery Guidance\n\n` +
          `- **Query**: "${query}"\n` +
          `- **Volatility & Bridge Architecture**: Balance Top (15–25%), Top-Heart / Heart (30–45%), and Heart-Base / Base (35–50%) so evaporation transitions smoothly without a hollow mid-stage.\n` +
          `- **Regulatory Guardrail**: IFRA Category 4 limits always apply to the **finished consumer product percentage** (e.g., at 20% EdP concentration, 10% in fragrance concentrate equals 2.0% in the finished product). Unlisted materials must be treated as \`LOOKUP_REQUIRED\`.\n` +
          `- **Shelf Context**: You currently have **${materials.length}** materials on My Shelf and **${accords.length}** accords available. Create a formula in Formula Lab to run live ingredient-level diagnostics.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          content:
            'Generic consultation tip: Start by selecting or creating a formula in Formula Lab, or browse the 815-material Catalog to add ingredients to My Shelf.',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="mentor-generic-mode" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-sans font-semibold text-white">
              Olfactory Mentor & Architecture Critique
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-emerald-400 text-[11px] font-mono-tabular">
              Generic Mode (No Active Formula)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Consult on raw material pairings, volatility bridges, and IFRA/EU safety calculations. Create a formula in Formula Lab for formula-specific diagnostics.
          </p>
        </div>

        {onOpenFormulaLab && (
          <button
            type="button"
            data-testid="mentor-open-formula-lab-btn"
            onClick={onOpenFormulaLab}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 self-start md:self-center shrink-0"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Create / Select Formula →</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Suggested Perfumery Topics</span>
          </div>
          <div className="space-y-2">
            {GENERIC_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleSendGenericPrompt(q)}
                className="w-full text-left p-3 rounded-lg bg-[#0B0E14] border border-slate-800 hover:border-emerald-500/50 text-slate-200 transition-colors leading-relaxed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 rounded-xl bg-[#111621] border border-slate-800 p-5 flex flex-col min-h-[420px] justify-between space-y-4 text-xs">
          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl border ${
                  msg.role === 'user'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-white ml-8'
                    : 'bg-[#0B0E14] border-slate-800 text-slate-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    {msg.role === 'assistant' && <Bot className="w-3.5 h-3.5" />}
                    {msg.role === 'user' ? 'Perfumer' : 'Olfactory Mentor'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendGenericPrompt();
            }}
            className="flex items-center gap-2 pt-3 border-t border-slate-800"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask a perfumery, accord, or regulatory question..."
              className="flex-1 bg-[#0B0E14] border border-slate-800 rounded-lg px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Thinking...' : 'Ask'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
