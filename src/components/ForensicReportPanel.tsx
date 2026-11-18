import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ScanEye,
  Download,
} from 'lucide-react';
import type {
  ForensicVerdict,
  ScanRecord,
  SeverityLevel,
} from '../types/forensics';
import { RadarCalibrationChart } from './RadarCalibrationChart';

interface ForensicReportPanelProps {
  record: ScanRecord;
  selectedSignalId: string | null;
  onSelectSignal: (id: string | null) => void;
}

export function getVerdictMeta(verdict: ForensicVerdict): {
  label: string;
  colorClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (verdict) {
    case 'authentic':
      return {
        label: 'Authentic Media',
        colorClass: 'text-emerald-400',
        Icon: ShieldCheck,
      };
    case 'suspicious':
      return {
        label: 'Suspicious Anomalies',
        colorClass: 'text-amber-400',
        Icon: AlertTriangle,
      };
    case 'manipulated':
      return {
        label: 'Manipulated / Edited',
        colorClass: 'text-rose-400',
        Icon: ShieldAlert,
      };
    case 'ai_synthesized':
      return {
        label: 'AI Synthesized',
        colorClass: 'text-rose-400',
        Icon: ScanEye,
      };
  }
}

function getSeverityTextClass(severity: SeverityLevel): {
  label: string;
  textClass: string;
} {
  switch (severity) {
    case 'critical':
      return { label: 'Critical', textClass: 'text-rose-400' };
    case 'moderate':
      return { label: 'Moderate', textClass: 'text-amber-400' };
    case 'low':
      return { label: 'Low', textClass: 'text-cyan-400' };
    default:
      return { label: 'Nominal', textClass: 'text-emerald-400' };
  }
}

export const ForensicReportPanel: React.FC<ForensicReportPanelProps> = ({
  record,
  selectedSignalId,
  onSelectSignal,
}) => {
  const { analysis, cvTelemetry } = record;
  const verdictMeta = getVerdictMeta(analysis.verdict);
  const VerdictIcon = verdictMeta.Icon;

  const handleExportReport = () => {
    const payload = {
      platform: 'VERIDEX (Verity + Index)',
      recordId: record.id,
      title: record.title,
      sha256Short: record.sha256Short,
      capturedAt: record.createdAt,
      source: record.source,
      scanMode: record.scanMode,
      cvTelemetry: {
        width: cvTelemetry.width,
        height: cvTelemetry.height,
        aspectRatio: cvTelemetry.aspectRatio,
        elaMeanDelta: cvTelemetry.elaMeanDelta,
        elaHotspotRatio: cvTelemetry.elaHotspotRatio,
        laplacianVariance: cvTelemetry.laplacianVariance,
        spatialNoiseUniformity: cvTelemetry.spatialNoiseUniformity,
        chromaticDivergence: cvTelemetry.chromaticDivergence,
        dctBlockiness: cvTelemetry.dctBlockiness,
        metadataSignatures: cvTelemetry.metadataSignatures,
      },
      forensicAnalysis: analysis,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veridex-report-${record.sha256Short.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="liquid-glass rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <VerdictIcon className={`h-5 w-5 ${verdictMeta.colorClass}`} />
              <span className={verdictMeta.colorClass}>{verdictMeta.label}</span>
            </div>
            <h2 className="mt-1.5 font-display text-xl font-semibold text-slate-100 [text-wrap:balance]">
              {analysis.suspectedOrigin}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{analysis.mediaCategory.replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                SHA-256 {record.sha256Short}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {cvTelemetry.width}×{cvTelemetry.height}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportReport}
            className="min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/[0.11] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-slate-300" />
            Export JSON
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-xs text-slate-400">Synthetic Probability</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {Math.round(analysis.syntheticProbability)}
              <span className="ml-1 text-xs font-normal text-slate-400">%</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Model Confidence</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {Math.round(analysis.confidence)}
              <span className="ml-1 text-xs font-normal text-slate-400">%</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Noise Uniformity</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {cvTelemetry.spatialNoiseUniformity}
              <span className="ml-1 text-xs font-normal text-slate-400">%</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">ELA Hotspots</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {cvTelemetry.elaHotspotRatio}
              <span className="ml-1 text-xs font-normal text-slate-400">%</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
          <p>{analysis.summary}</p>
          <p className="text-xs text-slate-400">
            <strong className="font-medium text-slate-200">Capture Assessment:</strong>{' '}
            {analysis.mobileCaptureAssessment}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="liquid-glass xl:col-span-5 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Neural Distortion Profile
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Anomaly likelihood across GAN, diffusion, and structural axes.
            </p>
          </div>
          <div className="my-4">
            <RadarCalibrationChart subScores={analysis.subScores} />
          </div>
          <div className="border-t border-white/[0.08] pt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Laplacian Noise Variance</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {cvTelemetry.laplacianVariance}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Chromatic Edge Divergence</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {cvTelemetry.chromaticDivergence} px-grad
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>8×8 DCT Block Ratio</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {cvTelemetry.dctBlockiness}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-400 pt-1">
              <span className="shrink-0">Bitstream Markers</span>
              <span className="font-mono text-slate-300 text-right truncate">
                {cvTelemetry.metadataSignatures.join(' · ')}
              </span>
            </div>
          </div>
        </div>

        <div className="liquid-glass xl:col-span-7 rounded-3xl p-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Localized Artifact Findings
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Select any finding to isolate its region on the optical stage.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {analysis.artifactSignals.length} regions
            </span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.07]">
            {analysis.artifactSignals.map((sig, idx) => {
              const isSelected = selectedSignalId === sig.id;
              const sev = getSeverityTextClass(sig.severity);
              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() =>
                    onSelectSignal(isSelected ? null : sig.id)
                  }
                  className={`w-full text-left py-3 px-3 -mx-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSelected
                      ? 'bg-cyan-400/10'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                      <span className="font-mono text-xs text-cyan-300 tabular-nums">
                        #{idx + 1}
                      </span>
                      <span>{sig.regionLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{sig.category}</span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className={`font-medium ${sev.textClass}`}>
                        {sev.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {sig.observation}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
