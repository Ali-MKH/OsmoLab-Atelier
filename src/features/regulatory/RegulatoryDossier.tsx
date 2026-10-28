import React, { useEffect, useState } from 'react';
import {
   fetchMaterialRegulatoryDossierApi,
  type MaterialRegulatoryDossierDto,
} from '../../api/client';
import { RegulatoryBadge } from './RegulatoryBadge';
import { FileText, ShieldCheck } from 'lucide-react';

interface RegulatoryDossierProps {
  materialId: number;
  materialName: string;
}

/**
 * Fetches `/api/catalog/:materialId/regulatory` on demand so the main catalog list
 * stays lightweight while the Regulatory sub-view displays full IFRA / EU records
 * and constituent allergen declarations.
 */
export const RegulatoryDossier: React.FC<RegulatoryDossierProps> = ({
  materialId,
  materialName,
}) => {
  const [dossier, setDossier] = useState<MaterialRegulatoryDossierDto | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMaterialRegulatoryDossierApi(materialId)
      .then((res) => {
        if (!cancelled) {
          setDossier(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  if (loading && !dossier) {
    return (
      <div className="rounded-lg bg-[#111621] border border-slate-800 p-4 text-xs text-slate-400">
        Loading on-demand regulatory dossier for {materialName}...
      </div>
    );
  }

  if (!dossier) return null;

  return (
    <div
      data-testid="on-demand-regulatory-dossier"
      className="rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <h4 className="text-sm font-semibold text-white">
            Structured Regulatory Records (IFRA &amp; EU 1223/2009)
          </h4>
        </div>
        <RegulatoryBadge status={dossier.verificationStatus} />
      </div>

      {dossier.regulatoryRecords.length === 0 ? (
        <p className="text-slate-400">
          No separate authority records registered. Treat as LOOKUP_REQUIRED.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2 pr-3">Authority</th>
                <th className="py-2 px-3">Rule Type</th>
                <th className="py-2 px-3">Status / Annex</th>
                <th className="py-2 px-3 text-right">Max Limit (%)</th>
                <th className="py-2 pl-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {dossier.regulatoryRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-900/40">
                  <td className="py-2 pr-3 font-mono-tabular font-semibold text-white">
                    {rec.authority} ({rec.jurisdiction})
                  </td>
                  <td className="py-2 px-3 font-mono-tabular text-slate-300">
                    {rec.ruleType}
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    {rec.status}
                    {rec.standardOrAnnex ? ` · ${rec.standardOrAnnex}` : ''}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular text-emerald-400">
                    {rec.maxFinishedProductPct !== null &&
                    rec.maxFinishedProductPct !== undefined
                      ? `${rec.maxFinishedProductPct}%`
                      : rec.maxReadyForUsePct !== null &&
                        rec.maxReadyForUsePct !== undefined
                      ? `${rec.maxReadyForUsePct}%`
                      : '—'}
                  </td>
                  <td className="py-2 pl-3 text-slate-300 max-w-md">
                    {rec.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dossier.constituents.length > 0 && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Regulated Constituents &amp; Allergen Breakdown (
              {dossier.constituents.length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dossier.constituents.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded bg-[#0B0E14] border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">
                    {c.constituentName}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular">
                    CAS {c.constituentCas || 'Listed'} · {c.riskNote || 'Declarable constituent'}
                  </div>
                </div>
                <span className="font-mono-tabular text-emerald-400 font-semibold shrink-0">
                  {c.typicalPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
