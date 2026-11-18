import React, { useMemo, useState } from 'react';
import { Search, Download, Trash2, ArrowUpRight, Scan } from 'lucide-react';
import type { ForensicVerdict, ScanRecord } from '../types/forensics';
import { getVerdictMeta } from './ForensicReportPanel';

interface IndexArchiveViewProps {
  records: ScanRecord[];
  onOpenRecord: (record: ScanRecord) => void;
  onDeleteRecord: (id: string) => void;
  onGoToScanner: () => void;
}

type VerdictFilter = 'all' | ForensicVerdict;

const FILTER_OPTIONS: Array<{ id: VerdictFilter; label: string }> = [
  { id: 'all', label: 'All Scans' },
  { id: 'authentic', label: 'Authentic' },
  { id: 'suspicious', label: 'Suspicious' },
  { id: 'ai_synthesized', label: 'AI Synthesized' },
  { id: 'manipulated', label: 'Manipulated' },
];

export const IndexArchiveView: React.FC<IndexArchiveViewProps> = ({
  records,
  onOpenRecord,
  onDeleteRecord,
  onGoToScanner,
}) => {
  const [query, setQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((rec) => {
      if (verdictFilter !== 'all' && rec.analysis.verdict !== verdictFilter) {
        return false;
      }
      if (!q) return true;
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.sha256Short.toLowerCase().includes(q) ||
        rec.analysis.suspectedOrigin.toLowerCase().includes(q) ||
        rec.analysis.mediaCategory.toLowerCase().includes(q)
      );
    });
  }, [records, query, verdictFilter]);

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Title',
      'SHA256',
      'Source',
      'Category',
      'Verdict',
      'SyntheticProbabilityPct',
      'ConfidencePct',
      'SuspectedOrigin',
      'LaplacianVariance',
      'NoiseUniformityPct',
      'ELAHotspotsPct',
      'Timestamp',
    ];
    const rows = filtered.map((r) => [
      r.id,
      `"${r.title.replace(/"/g, '""')}"`,
      r.sha256Short,
      r.source,
      r.analysis.mediaCategory,
      r.analysis.verdict,
      Math.round(r.analysis.syntheticProbability),
      Math.round(r.analysis.confidence),
      `"${r.analysis.suspectedOrigin.replace(/"/g, '""')}"`,
      r.cvTelemetry.laplacianVariance,
      r.cvTelemetry.spatialNoiseUniformity,
      r.cvTelemetry.elaHotspotRatio,
      r.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veridex-index-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-100 [text-wrap:balance]">
            Verity Index Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cryptographic digests, computer-vision telemetry, and verification verdicts for inspected media.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {records.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-xs font-medium text-slate-100 hover:bg-white/[0.11] whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-slate-300" />
              Download CSV
            </button>
          )}
        </div>
      </div>

      {records.length === 0 ? (
        <div className="liquid-glass mt-8 flex flex-col items-center justify-center rounded-3xl px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-cyan-300">
            <Scan className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            No Indexed Media Yet
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-400">
            Capture an image with your camera or upload a file to populate your forensic verification ledger.
          </p>
          <button
            type="button"
            onClick={onGoToScanner}
            className="mt-6 min-h-[44px] rounded-xl border border-cyan-300/40 bg-cyan-400/90 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:bg-cyan-300 whitespace-nowrap shrink-0"
          >
            Open Scanner
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="liquid-glass-subtle flex flex-wrap items-center gap-1 rounded-xl p-1">
              {FILTER_OPTIONS.map((opt) => {
                const active = verdictFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVerdictFilter(opt.id)}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white/[0.12] text-cyan-300'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by title, origin, SHA-256..."
                className="h-10 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-md focus:border-cyan-400/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="liquid-glass overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-xs font-medium text-slate-400">
                  <th className="px-4 py-3">Media Asset</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3 text-right">Synthetic Prob.</th>
                  <th className="px-4 py-3 text-right">Noise Uniformity</th>
                  <th className="px-4 py-3">SHA-256 Digest</th>
                  <th className="px-4 py-3">Scanned</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((rec) => {
                  const meta = getVerdictMeta(rec.analysis.verdict);
                  const Icon = meta.Icon;
                  return (
                    <tr
                      key={rec.id}
                      className="transition-colors hover:bg-slate-900/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={rec.imageDataUrl}
                            alt={rec.title}
                            referrerPolicy="no-referrer"
                            className="h-10 w-12 shrink-0 rounded object-cover border border-slate-800 bg-slate-950"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100 truncate max-w-[220px]">
                              {rec.title}
                            </div>
                            <div className="text-xs text-slate-400 truncate max-w-[220px]">
                              {rec.analysis.suspectedOrigin}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${meta.colorClass}`}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                        {Math.round(rec.analysis.syntheticProbability)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                        {rec.cvTelemetry.spatialNoiseUniformity}%
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 tabular-nums">
                        {rec.sha256Short}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(rec.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenRecord(rec)}
                            className="min-h-[34px] inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-300 whitespace-nowrap shrink-0"
                          >
                            Inspect
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            aria-label={`Delete ${rec.title}`}
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-400"
                    >
                      No records match your current search or verdict filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
