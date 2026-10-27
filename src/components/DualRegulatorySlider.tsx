import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, Check } from 'lucide-react';

interface DualRegulatorySliderProps {
  materialName: string;
  currentPercent: number; // e.g. 0.08 (% in finished product or formula)
  ifraLimitPercent: number | null; // e.g. 0.10 (% maximum allowed)
  euLimitPercent: number | null; // e.g. 0.10 (% EU Annex III threshold)
  ifraCategory?: string;
  euRegulationReference?: string;
  isEuAllergen?: boolean;
  compact?: boolean;
  className?: string;
}

export const DualRegulatorySlider: React.FC<DualRegulatorySliderProps> = ({
  materialName,
  currentPercent,
  ifraLimitPercent,
  euLimitPercent,
  ifraCategory = 'Cat 4 (Fine Fragrance)',
  euRegulationReference = 'EU Cosmetics Reg. (EC 1223/2009)',
  isEuAllergen = false,
  compact = false,
  className = '',
}) => {
  // Determine scale maximum for visual progress bar (at least 25% larger than the max value, or 100%)
  const hasIfra = ifraLimitPercent !== null && ifraLimitPercent !== undefined;
  const hasEu = euLimitPercent !== null && euLimitPercent !== undefined;

  const validLimits = [
    hasIfra ? ifraLimitPercent! : 0,
    hasEu ? euLimitPercent! : 0,
    currentPercent,
  ];
  const maxBenchmark = Math.max(...validLimits, 0.001);
  const scaleMax = maxBenchmark > 50 ? 100 : Math.max(0.1, maxBenchmark * 1.35);

  const currentPosPct = Math.min(100, Math.max(0, (currentPercent / scaleMax) * 100));
  const ifraPosPct = hasIfra ? Math.min(100, Math.max(0, (ifraLimitPercent! / scaleMax) * 100)) : null;
  const euPosPct = hasEu ? Math.min(100, Math.max(0, (euLimitPercent! / scaleMax) * 100)) : null;

  // Status checks & Regulatory Heatmap (<50% Emerald #10B981, 50%-80% Amber #F59E0B, >80% Rose #EF4444, Lookup Required #64748B, Prohibited Crimson)
  const isLookupRequired = !hasIfra;
  const isProhibited = (hasIfra && ifraLimitPercent === 0) || (hasEu && euLimitPercent === 0);

  const ifraUtilization =
    hasIfra && ifraLimitPercent! > 0
      ? (currentPercent / ifraLimitPercent!) * 100
      : hasIfra && ifraLimitPercent === 0 && currentPercent > 0
      ? 100
      : 0;
  const euUtilization =
    hasEu && euLimitPercent! > 0
      ? (currentPercent / euLimitPercent!) * 100
      : hasEu && euLimitPercent === 0 && currentPercent > 0
      ? 100
      : 0;
  const maxUtilization = Math.max(ifraUtilization, euUtilization);

  const isIfraExceeded = hasIfra && (ifraLimitPercent === 0 || currentPercent > ifraLimitPercent!);
  const isIfraHighWarning = hasIfra && !isIfraExceeded && ifraUtilization > 80 && ifraLimitPercent! < 100;
  const isIfraCaution = hasIfra && !isIfraExceeded && !isIfraHighWarning && ifraUtilization >= 50 && ifraLimitPercent! < 100;

  const isEuExceeded = hasEu && (euLimitPercent === 0 || currentPercent > euLimitPercent!);
  const isEuHighWarning = hasEu && !isEuExceeded && euUtilization > 80 && euLimitPercent! < 100;
  const isEuCaution = hasEu && !isEuExceeded && !isEuHighWarning && euUtilization >= 50 && euLimitPercent! < 100;

  const isOverallExceededOrHighWarning =
    isProhibited || isIfraExceeded || isEuExceeded || isIfraHighWarning || isEuHighWarning;
  const isOverallCaution =
    !isOverallExceededOrHighWarning && !isLookupRequired && (isIfraCaution || isEuCaution);

  // Compact variant for tables, line items, and micro-cards
  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`} data-testid={`dual-regulatory-slider-compact-${materialName}`}>
        {/* Dual Progress Meter Bar */}
        <div className="relative w-full h-3 bg-slate-900 rounded-full border border-slate-700/80 overflow-visible">
          {/* Active fill */}
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isProhibited || isIfraExceeded || isEuExceeded || isIfraHighWarning || isEuHighWarning
                ? 'bg-rose-500'
                : isLookupRequired
                ? 'bg-slate-500'
                : isOverallCaution
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${currentPosPct}%` }}
          />

          {/* IFRA Limit Pin Marker */}
          {ifraPosPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-10"
              style={{ left: `${ifraPosPct}%` }}
              title={`IFRA Limit: ${ifraLimitPercent?.toFixed(3)}%`}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 ring-1 ring-black" />
            </div>
          )}

          {/* EU Limit Pin Marker */}
          {euPosPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${euPosPct}%` }}
              title={`EU Limit: ${euLimitPercent?.toFixed(3)}%`}
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-black" />
            </div>
          )}
        </div>

        {/* Labels row */}
        <div className="flex items-center justify-between text-[10px] font-mono-tabular">
          <span className="text-white font-medium">
            Curr: {currentPercent.toFixed(3)}%
          </span>
          <div className="flex items-center gap-2">
            {hasIfra ? (
              <span
                className={
                  isIfraExceeded || isIfraHighWarning
                    ? 'text-rose-400 font-semibold'
                    : isIfraCaution
                    ? 'text-amber-400 font-medium'
                    : 'text-emerald-400'
                }
              >
                IFRA: {ifraLimitPercent! >= 100 ? '100%' : `${ifraLimitPercent!.toFixed(2)}%`}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-slate-700/80 border border-slate-500 text-slate-200 font-semibold">
                LOOKUP_REQUIRED
              </span>
            )}
            {hasEu && (
              <span
                className={
                  isEuExceeded || isEuHighWarning
                    ? 'text-rose-400 font-semibold'
                    : isEuCaution
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }
              >
                EU: {euLimitPercent! >= 100 ? '100%' : `${euLimitPercent!.toFixed(2)}%`}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full detailed card view for Material Profile and Safety Reports
  return (
    <div
      data-testid={`dual-regulatory-slider-full-${materialName}`}
      className={`rounded-xl bg-[#0B0E14] border border-slate-800 p-4 space-y-4 ${className}`}
    >
      {/* Header with dual standards & status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          {isProhibited || isIfraExceeded || isEuExceeded || isIfraHighWarning || isEuHighWarning ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : isLookupRequired ? (
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
          ) : isOverallCaution ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-white">
            Dual Safety Standards: IFRA 51st & EU Cosmetics Regulation
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEuAllergen && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 border border-amber-500/40 text-amber-300">
              EU Allergen Declarable (&gt;0.001% leave-on / &gt;0.01% rinse-off)
            </span>
          )}
          {isProhibited ? (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 border border-rose-400 text-white shadow-sm">
              PROHIBITED — BLOCKING ALERT
            </span>
          ) : isLookupRequired ? (
            <span
              data-testid="lookup-required-badge"
              className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold uppercase tracking-wider bg-slate-700/90 border border-slate-500 text-slate-100"
            >
              LOOKUP_REQUIRED
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                isIfraExceeded || isEuExceeded || isIfraHighWarning || isEuHighWarning
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                  : isOverallCaution
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                  : 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
              }`}
            >
              {isIfraExceeded || isEuExceeded
                ? 'Limit Exceeded (>100%)'
                : isIfraHighWarning || isEuHighWarning
                ? `Warning (>80% Limit · ${maxUtilization.toFixed(0)}%)`
                : isOverallCaution
                ? `Caution (50–80% Limit · ${maxUtilization.toFixed(0)}%)`
                : 'Safe (<50% Limit Utilization)'}
            </span>
          )}
        </div>
      </div>

      {/* Dual Comparative Visual Gauge Slider */}
      <div className="space-y-4">
        {/* 1. IFRA 51st Track */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>IFRA 51st Amendment ({ifraCategory} — Finished Product %)</span>
            </span>
            <span className="font-mono-tabular text-slate-300 shrink-0">
              Limit:{' '}
              <strong
                className={
                  isIfraExceeded || isIfraHighWarning
                    ? 'text-rose-400'
                    : isLookupRequired
                    ? 'text-slate-300'
                    : isIfraCaution
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {hasIfra
                  ? ifraLimitPercent! >= 100
                    ? '100% (No quantitative limit)'
                    : `${ifraLimitPercent!.toFixed(2)}%`
                  : 'LOOKUP_REQUIRED'}
              </strong>
            </span>
          </div>

          <div className="relative w-full h-4 mt-5 bg-slate-900 rounded-md border border-slate-800 overflow-visible">
            {/* Background ticks */}
            <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-20">
              <span className="h-full border-r border-white text-[8px] flex items-end">0%</span>
              <span className="h-full border-r border-white text-[8px] flex items-end">{(scaleMax / 2).toFixed(1)}%</span>
              <span className="h-full border-r border-white text-[8px] flex items-end">{scaleMax.toFixed(1)}%</span>
            </div>

            {/* Current Concentration Fill Bar */}
            <div
              className={`h-full rounded-md transition-all duration-300 ${
                isIfraExceeded || isIfraHighWarning
                  ? 'bg-rose-500/80 border-r-2 border-rose-400'
                  : isLookupRequired
                  ? 'bg-slate-600/70 border-r-2 border-slate-400'
                  : isIfraCaution
                  ? 'bg-amber-500/80 border-r-2 border-amber-300'
                  : 'bg-emerald-500/75 border-r-2 border-emerald-300'
              }`}
              style={{ width: `${currentPosPct}%` }}
            />

            {/* IFRA Limit Marker Pin */}
            {ifraPosPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-sky-400 z-10 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                style={{ left: `${ifraPosPct}%` }}
              >
                <div
                  className={`absolute -top-5 text-[9px] font-mono-tabular font-bold text-sky-300 bg-slate-900 px-1.5 py-0.5 rounded border border-sky-400 whitespace-nowrap shadow-xs ${
                    ifraPosPct < 14
                      ? 'left-0 translate-x-0'
                      : ifraPosPct > 86
                      ? 'right-0 left-auto translate-x-0'
                      : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  IFRA {ifraLimitPercent!.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. EU Cosmetics Regulation Track */}
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>EU Cosmetic Regulation EC 1223/2009 (Annex III Concentration Limit)</span>
            </span>
            <span className="font-mono-tabular text-slate-300 shrink-0">
              Limit:{' '}
              <strong
                className={
                  isEuExceeded || isEuHighWarning
                    ? 'text-rose-400'
                    : isEuCaution
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }
              >
                {hasEu
                  ? euLimitPercent! >= 100
                    ? '100% (No Annex III cap)'
                    : `${euLimitPercent!.toFixed(2)}%`
                  : 'LOOKUP_REQUIRED'}
              </strong>
            </span>
          </div>

          <div className="relative w-full h-4 mt-5 bg-slate-900 rounded-md border border-slate-800 overflow-visible">
            {/* Background ticks */}
            <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-20">
              <span className="h-full border-r border-white text-[8px] flex items-end">0%</span>
              <span className="h-full border-r border-white text-[8px] flex items-end">{(scaleMax / 2).toFixed(1)}%</span>
              <span className="h-full border-r border-white text-[8px] flex items-end">{scaleMax.toFixed(1)}%</span>
            </div>

            {/* Current Concentration Fill Bar */}
            <div
              className={`h-full rounded-md transition-all duration-300 ${
                isEuExceeded || isEuHighWarning
                  ? 'bg-rose-500/80 border-r-2 border-rose-400'
                  : isEuCaution
                  ? 'bg-amber-400/80 border-r-2 border-amber-300'
                  : 'bg-emerald-500/70 border-r-2 border-emerald-300'
              }`}
              style={{ width: `${currentPosPct}%` }}
            />

            {/* EU Limit Marker Pin */}
            {euPosPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                style={{ left: `${euPosPct}%` }}
              >
                <div
                  className={`absolute -top-5 text-[9px] font-mono-tabular font-bold text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-amber-400 whitespace-nowrap shadow-xs ${
                    euPosPct < 14
                      ? 'left-0 translate-x-0'
                      : euPosPct > 86
                      ? 'right-0 left-auto translate-x-0'
                      : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  EU {euLimitPercent!.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Footer with Current Concentration Marker & Regulatory Notes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
        <div className="font-mono-tabular text-slate-300 flex items-center gap-2">
          <span className="text-slate-400">Finished Consumer Product Usage:</span>
          <span className="px-2 py-0.5 rounded bg-[#111621] border border-slate-700 text-white font-bold">
            {currentPercent.toFixed(4)}%
          </span>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{euRegulationReference} · ScenTree CC BY-NC 4.0</span>
        </div>
      </div>
    </div>
  );
};
