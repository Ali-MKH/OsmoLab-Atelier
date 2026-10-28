import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { RegulatoryVerificationStatus } from '../domain/types';
import { formatVerificationStatusLabel } from '../domain/safety-engine';

interface DualRegulatorySliderProps {
  materialName: string;
  currentPercent?: number | null; // Optional: pass null/undefined in Material Detail view outside a formula context
  ifraLimitPercent: number | null; // e.g. 0.10 (% maximum allowed)
  euLimitPercent: number | null; // e.g. 0.10 (% EU Annex III threshold)
  ifraCategory?: string;
  euRegulationReference?: string;
  isEuAllergen?: boolean;
  leaveOnThresholdPct?: number | null;
  rinseOffThresholdPct?: number | null;
  verificationStatus?: RegulatoryVerificationStatus;
  sourceDocument?: string;
  sourceUrl?: string | null;
  compact?: boolean;
  className?: string;
}

export const DualRegulatorySlider: React.FC<DualRegulatorySliderProps> = ({
  materialName,
  currentPercent = null,
  ifraLimitPercent,
  euLimitPercent,
  ifraCategory = 'Cat 4 (Fine Fragrance)',
  euRegulationReference = 'EU Cosmetics Reg. (EC 1223/2009)',
  isEuAllergen = false,
  leaveOnThresholdPct = 0.001,
  rinseOffThresholdPct = 0.01,
  verificationStatus,
  sourceDocument,
  sourceUrl,
  compact = false,
  className = '',
}) => {
  const hasFormulaUsageContext = currentPercent !== null && currentPercent !== undefined;
  const effectiveCurrentPct = hasFormulaUsageContext ? currentPercent : 0;

  const hasIfra = ifraLimitPercent !== null && ifraLimitPercent !== undefined;
  const hasEu = euLimitPercent !== null && euLimitPercent !== undefined;

  const validLimits = [
    hasIfra ? ifraLimitPercent! : 0,
    hasEu ? euLimitPercent! : 0,
    effectiveCurrentPct,
  ];
  const maxBenchmark = Math.max(...validLimits, 0.001);
  const scaleMax = maxBenchmark > 50 ? 100 : Math.max(0.1, maxBenchmark * 1.35);

  const currentPosPct = hasFormulaUsageContext
    ? Math.min(100, Math.max(0, (effectiveCurrentPct / scaleMax) * 100))
    : 0;
  const ifraPosPct = hasIfra ? Math.min(100, Math.max(0, (ifraLimitPercent! / scaleMax) * 100)) : null;
  const euPosPct = hasEu ? Math.min(100, Math.max(0, (euLimitPercent! / scaleMax) * 100)) : null;

  const isLookupRequired = !hasIfra || verificationStatus === 'LOOKUP_REQUIRED';
  const isProhibited = (hasIfra && ifraLimitPercent === 0) || (hasEu && euLimitPercent === 0);

  const ifraUtilization =
    hasFormulaUsageContext && hasIfra && ifraLimitPercent! > 0
      ? (effectiveCurrentPct / ifraLimitPercent!) * 100
      : hasFormulaUsageContext && hasIfra && ifraLimitPercent === 0 && effectiveCurrentPct > 0
      ? 100
      : 0;
  const euUtilization =
    hasFormulaUsageContext && hasEu && euLimitPercent! > 0
      ? (effectiveCurrentPct / euLimitPercent!) * 100
      : hasFormulaUsageContext && hasEu && euLimitPercent === 0 && effectiveCurrentPct > 0
      ? 100
      : 0;
  const maxUtilization = Math.max(ifraUtilization, euUtilization);

  const isIfraExceeded =
    hasFormulaUsageContext && hasIfra && (ifraLimitPercent === 0 || effectiveCurrentPct > ifraLimitPercent!);
  const isIfraHighWarning =
    hasFormulaUsageContext && hasIfra && !isIfraExceeded && ifraUtilization > 80 && ifraLimitPercent! < 100;
  const isIfraCaution =
    hasFormulaUsageContext &&
    hasIfra &&
    !isIfraExceeded &&
    !isIfraHighWarning &&
    ifraUtilization >= 50 &&
    ifraLimitPercent! < 100;

  const isEuExceeded =
    hasFormulaUsageContext && hasEu && (euLimitPercent === 0 || effectiveCurrentPct > euLimitPercent!);
  const isEuHighWarning =
    hasFormulaUsageContext && hasEu && !isEuExceeded && euUtilization > 80 && euLimitPercent! < 100;
  const isEuCaution =
    hasFormulaUsageContext &&
    hasEu &&
    !isEuExceeded &&
    !isEuHighWarning &&
    euUtilization >= 50 &&
    euLimitPercent! < 100;

  const isOverallExceededOrHighWarning =
    isProhibited || isIfraExceeded || isEuExceeded || isIfraHighWarning || isEuHighWarning;
  const isOverallCaution =
    !isOverallExceededOrHighWarning && !isLookupRequired && (isIfraCaution || isEuCaution);

  const resolvedVerificationStatus: RegulatoryVerificationStatus =
    verificationStatus || (isLookupRequired ? 'LOOKUP_REQUIRED' : 'PARTIALLY_VERIFIED');
  const verificationStatusLabel = formatVerificationStatusLabel(resolvedVerificationStatus);

  // Compact variant for tables, line items, and micro-cards
  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`} data-testid={`dual-regulatory-slider-compact-${materialName}`}>
        {/* Dual Progress Meter Bar */}
        <div className="relative w-full h-3 bg-slate-900 rounded-full border border-slate-700/80 overflow-visible">
          {hasFormulaUsageContext && (
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
          )}

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
            {hasFormulaUsageContext ? `Curr: ${effectiveCurrentPct.toFixed(3)}%` : 'Reference Limits'}
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

  // Full detailed card view for Material Profile (Reference Mode) and Safety Reports (Formula Context Mode)
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
              EU Allergen Declarable (&gt;{(leaveOnThresholdPct ?? 0.001).toFixed(3)}% leave-on / &gt;{(rinseOffThresholdPct ?? 0.01).toFixed(2)}% rinse-off)
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
          ) : !hasFormulaUsageContext ? (
            <span
              data-testid="regulatory-verification-status-badge"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                resolvedVerificationStatus === 'VERIFIED_OFFICIAL'
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                  : resolvedVerificationStatus === 'PARTIALLY_VERIFIED'
                  ? 'bg-sky-500/20 border border-sky-500/50 text-sky-300'
                  : 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
              }`}
            >
              {verificationStatusLabel}
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

            {/* Current Concentration Fill Bar (ONLY rendered in active Formula context) */}
            {hasFormulaUsageContext && (
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
            )}

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

            {/* Current Concentration Fill Bar (ONLY rendered in active Formula context) */}
            {hasFormulaUsageContext && (
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
            )}

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

      {/* Summary Footer with Reference Mode or Formula Usage Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
        {hasFormulaUsageContext ? (
          <div className="font-mono-tabular text-slate-300 flex items-center gap-2">
            <span className="text-slate-400">Finished Consumer Product Usage:</span>
            <span className="px-2 py-0.5 rounded bg-[#111621] border border-slate-700 text-white font-bold">
              {effectiveCurrentPct.toFixed(4)}%
            </span>
          </div>
        ) : (
          <div className="text-slate-300 flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Verification Status:</span>
            <span className="px-2 py-0.5 rounded bg-[#111621] border border-slate-700 text-slate-200 font-medium">
              {verificationStatusLabel}
            </span>
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{sourceDocument || euRegulationReference}</span>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
            >
              <span>Official Source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

