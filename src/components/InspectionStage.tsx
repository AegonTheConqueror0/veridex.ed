import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ImageOff } from 'lucide-react';
import type {
  ArtifactSignal,
  InspectionLayer,
  ScanRecord,
  SeverityLevel,
} from '../types/forensics';

interface InspectionStageProps {
  record: ScanRecord;
  activeLayer: InspectionLayer;
  onChangeLayer: (layer: InspectionLayer) => void;
  selectedSignalId: string | null;
  onSelectSignal: (id: string | null) => void;
}

const LAYER_TABS: Array<{ id: InspectionLayer; label: string }> = [
  { id: 'source', label: 'Source' },
  { id: 'regions', label: 'Artifact Regions' },
  { id: 'ela', label: 'ELA Compression' },
  { id: 'noise', label: 'Laplacian Noise' },
];

function getSeverityStroke(severity: SeverityLevel): string {
  switch (severity) {
    case 'critical':
      return 'border-rose-500 bg-rose-500/12';
    case 'moderate':
      return 'border-amber-400 bg-amber-400/12';
    case 'low':
      return 'border-cyan-400 bg-cyan-400/10';
    default:
      return 'border-emerald-400 bg-emerald-400/10';
  }
}

export const InspectionStage: React.FC<InspectionStageProps> = ({
  record,
  activeLayer,
  onChangeLayer,
  selectedSignalId,
  onSelectSignal,
}) => {
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState(false);

  const displayedSrc =
    activeLayer === 'ela'
      ? record.cvTelemetry.elaDataUrl
      : activeLayer === 'noise'
        ? record.cvTelemetry.noiseDataUrl
        : record.imageDataUrl;

  const showBoxes = activeLayer === 'regions' || activeLayer === 'source';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCoords({ x: Math.round(x), y: Math.round(y) });
  };

  return (
    <div className="liquid-glass flex flex-col rounded-3xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 bg-white/[0.03]">
        <div
          role="tablist"
          aria-label="Forensic inspection layers"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-black/30 p-1"
        >
          {LAYER_TABS.map((tab) => {
            const active = activeLayer === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeLayer(tab.id)}
                className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white/[0.12] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-mono text-xs text-slate-400 tabular-nums">
            {coords ? `X ${String(coords.x).padStart(2, '0')}% · Y ${String(coords.y).padStart(2, '0')}%` : `${record.cvTelemetry.width} × ${record.cvTelemetry.height} px`}
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.05] px-2.5 text-xs font-mono text-slate-200 hover:bg-white/[0.10] whitespace-nowrap shrink-0"
            aria-label={zoom === 1 ? 'Zoom in 2x' : 'Reset zoom to 1x'}
          >
            {zoom === 1 ? (
              <span className="inline-flex items-center gap-1.5">
                <ZoomIn className="h-3.5 w-3.5" /> 2×
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ZoomOut className="h-3.5 w-3.5" /> 1×
              </span>
            )}
          </button>
          {selectedSignalId && (
            <button
              type="button"
              onClick={() => onSelectSignal(null)}
              className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-white/[0.12] bg-white/[0.05] px-2.5 text-xs text-slate-200 hover:bg-white/[0.10] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear Focus
            </button>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-center overflow-auto bg-black/35 p-3 sm:p-5 min-h-[300px] max-h-[540px]">
        {imgError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
            <ImageOff className="h-8 w-8" />
            <span className="text-sm">{record.title}</span>
          </div>
        ) : (
          <div
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setCoords(null)}
            className="relative inline-block cursor-crosshair select-none transition-transform duration-200 ease-out origin-center"
            style={{
              transform: `scale(${zoom})`,
            }}
          >
            <img
              src={displayedSrc}
              alt={`${record.title} — ${activeLayer} forensic view`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="block max-h-[460px] w-auto max-w-full rounded object-contain"
            />

            {showBoxes &&
              record.analysis.artifactSignals.map((sig: ArtifactSignal, index: number) => {
                const isSelected = selectedSignalId === sig.id;
                const dimmed = selectedSignalId !== null && !isSelected;
                const { x, y, w, h } = sig.boundingBox;
                const clampedX = Math.max(0, Math.min(94, x));
                const clampedY = Math.max(0, Math.min(94, y));
                const clampedW = Math.max(6, Math.min(100 - clampedX, w));
                const clampedH = Math.max(6, Math.min(100 - clampedY, h));

                return (
                  <button
                    key={sig.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSignal(isSelected ? null : sig.id);
                    }}
                    title={`${sig.regionLabel} (${sig.severity})`}
                    style={{
                      left: `${clampedX}%`,
                      top: `${clampedY}%`,
                      width: `${clampedW}%`,
                      height: `${clampedH}%`,
                    }}
                    className={`absolute border transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${getSeverityStroke(
                      sig.severity
                    )} ${isSelected ? 'border-2 ring-2 ring-cyan-400/50 z-20' : 'z-10'} ${
                      dimmed ? 'opacity-25' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span className="absolute -top-5 left-0 bg-[#090C12]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-100 whitespace-nowrap border border-slate-700/80">
                      #{index + 1} {sig.regionLabel}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {activeLayer === 'ela' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#0B0F17] px-4 py-2 text-xs text-slate-400">
          <span>Error Level Analysis (88% JPEG recompression residual · 14× gain)</span>
          <span className="font-mono tabular-nums text-slate-300">
            Blue: uniform · Amber/Crimson: elevated compression delta
          </span>
        </div>
      )}

      {activeLayer === 'noise' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#0B0F17] px-4 py-2 text-xs text-slate-400">
          <span>3×3 Laplacian High-Pass Noise Floor Extraction</span>
          <span className="font-mono tabular-nums text-slate-300">
            Uniformity: {record.cvTelemetry.spatialNoiseUniformity}% · Variance: {record.cvTelemetry.laplacianVariance}
          </span>
        </div>
      )}
    </div>
  );
};
