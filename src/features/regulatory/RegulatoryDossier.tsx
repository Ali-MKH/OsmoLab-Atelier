import React, { useEffect, useState } from 'react';
import { ExternalLink, FileCheck2, HelpCircle, ShieldCheck } from 'lucide-react';
import {
  fetchMaterialRegulatoryDossierApi,
  validateRegulatoryDossierResponse,
  type MaterialRegulatoryDossier,
} from '../../api/client';
import { RegulatoryBadge } from './RegulatoryBadge';

export interface RegulatoryDossierProps {
  materialId: number;
  getAuthHeaders?: () => Promise<Record<string, string>>;
  initialDossier?: MaterialRegulatoryDossier | null;
}

/**
 * Lazy-loaded Regulatory Dossier panel:
 * Fetches `/api/catalog/:id/regulatory` only when opened or rendered for a selected material,
 * keeping default catalog list queries lightweight.
 * Never fabricates regulatory facts — missing evidence is explicitly surfaced as LOOKUP_REQUIRED.
 */
export const RegulatoryDossier: React.FC<RegulatoryDossierProps> = ({
  materialId,
  getAuthHeaders,
  initialDossier = null,
}) => {
  const [dossier, setDossier] = useState<MaterialRegulatoryDossier | null>(() => {
    if (!initialDossier) return null;
    try {
      return validateRegulatoryDossierResponse(initialDossier);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(!initialDossier);
  const [error, setError] = useState<string | null>(() => {
    if (!initialDossier) return null;
    try {
      validateRegulatoryDossierResponse(initialDossier);
      return null;
    } catch (err: unknown) {
      return err instanceof Error
        ? err.message
        : 'Regulatory dossier unavailable — LOOKUP_REQUIRED.';
    }
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = getAuthHeaders ? await getAuthHeaders() : {};
        const data = await fetchMaterialRegulatoryDossierApi(materialId, headers);
        if (!cancelled) {
          setDossier(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setDossier(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Regulatory dossier unavailable — LOOKUP_REQUIRED.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [materialId, getAuthHeaders]);

  if (loading && !dossier) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 animate-pulse">
        Loading regulatory authority records & constituent declarations...
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {error || 'No regulatory dossier loaded — LOOKUP_REQUIRED.'}
        </span>
        <RegulatoryBadge status="LOOKUP_REQUIRED" />
      </div>
    );
  }

  const regulatoryRecords = Array.isArray(dossier.regulatoryRecords)
    ? dossier.regulatoryRecords
    : [];
  const constituents = Array.isArray(dossier.constituents)
    ? dossier.constituents
    : [];
  const limit = dossier.regulatoryLimit ?? null;

  return (
    <div className="space-y-3 rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">
            Normalized Regulatory Evidence ({regulatoryRecords.length} records)
          </h4>
        </div>
        <RegulatoryBadge
          status={limit?.verificationStatus || 'LOOKUP_REQUIRED'}
        />
      </div>

      {regulatoryRecords.length === 0 ? (
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400">
          LOOKUP_REQUIRED — No structured authority records stored for this material.
        </div>
      ) : (
        <div className="space-y-2">
          {regulatoryRecords.map((rec, idx) => (
            <div
              key={rec.id || idx}
              className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex flex-col gap-1 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">
                  {rec.authority} · {rec.ruleType} ({rec.status || 'LOOKUP_REQUIRED'})
                </span>
                <RegulatoryBadge status={rec.verificationStatus || 'LOOKUP_REQUIRED'} />
              </div>
              {rec.summary && <p className="text-slate-400 text-[11px]">{rec.summary}</p>}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500 mt-1">
                {rec.maxFinishedProductPct !== null && (
                  <span>Max Finished Product: {rec.maxFinishedProductPct}%</span>
                )}
                {rec.sourceDocument && (
                  <span className="inline-flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3" />
                    {rec.sourceDocument}
                  </span>
                )}
                {rec.sourceUrl && (
                  <a
                    href={rec.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                  >
                    Source <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {constituents.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Declarable Constituents ({constituents.length})
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {constituents.map((c, idx) => (
              <div
                key={c.id || idx}
                className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/70 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-slate-200">{c.constituentName}</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    CAS: {c.constituentCas || 'LOOKUP_REQUIRED'}
                  </div>
                </div>
                <span className="font-mono text-amber-300 font-semibold">
                  {c.typicalPct !== null && c.typicalPct !== undefined
                    ? `${c.typicalPct}%`
                    : 'LOOKUP_REQUIRED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
