import React, { useEffect, useState } from 'react';
import {
  Camera,
  Microscope,
  Database,
  BookOpen,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ChevronRight,
  X,
} from 'lucide-react';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { CameraScanner } from './components/CameraScanner';
import { InspectionStage } from './components/InspectionStage';
import {
  ForensicReportPanel,
  getVerdictMeta,
} from './components/ForensicReportPanel';
import { IndexArchiveView } from './components/IndexArchiveView';
import { MethodologyView } from './components/MethodologyView';
import {
  analyzeImageSignals,
  computeShortSha256,
  extractBinarySignatures,
} from './utils/cvForensics';
import type {
  AnalysisDepth,
  ForensicAnalysisResult,
  InspectionLayer,
  ScanMode,
  ScanRecord,
  ScanSource,
} from './types/forensics';

const STORAGE_KEY = 'veridex_index_v1';

const SCAN_MODES: Array<{ id: ScanMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'photograph', label: 'Photo' },
  { id: 'document', label: 'Document' },
  { id: 'graphic', label: 'Graphic' },
];

async function createCompactDataUrl(sourceUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(32, Math.round(img.width * scale));
      c.height = Math.max(32, Math.round(img.height * scale));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      } else {
        resolve(sourceUrl);
      }
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('scanner');
  const [scanMode, setScanMode] = useState<ScanMode>('auto');
  const [depth, setDepth] = useState<AnalysisDepth>('standard');

  const [records, setRecords] = useState<ScanRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ScanRecord[];
      }
    } catch {
      // Ignore storage read errors
    }
    return [];
  });

  const [activeRecordId, setActiveRecordId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ScanRecord[];
        return parsed[0]?.id ?? null;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [activeLayer, setActiveLayer] = useState<InspectionLayer>('regions');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<1 | 2>(1);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const persist = async () => {
      try {
        const compactRecords = await Promise.all(
          records.slice(0, 8).map(async (r) => ({
            ...r,
            imageDataUrl:
              r.imageDataUrl.length > 180000
                ? await createCompactDataUrl(r.imageDataUrl)
                : r.imageDataUrl,
          }))
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compactRecords));
      } catch {
        // Ignore storage quota limitations cleanly
      }
    };
    void persist();
  }, [records]);

  const activeRecord =
    records.find((r) => r.id === activeRecordId) ?? records[0] ?? null;

  const runForensicPipeline = async (
    imageDataUrl: string,
    title: string,
    source: ScanSource,
    rawBuffer?: ArrayBuffer
  ) => {
    setErrorMessage(null);
    setSelectedSignalId(null);
    setPendingPreviewUrl(imageDataUrl);
    setPipelineStep(1);

    try {
      setPipelineStage('Extracting bitstream & computer-vision signal maps...');
      const signatures = rawBuffer
        ? await extractBinarySignatures(rawBuffer)
        : ['Mobile Optical Stream (Live Capture)'];

      const [{ cvTelemetry, uploadBase64, uploadMimeType }, sha256Short] =
        await Promise.all([
          analyzeImageSignals(imageDataUrl, signatures),
          computeShortSha256(imageDataUrl),
        ]);

      setPipelineStep(2);
      setPipelineStage(
        'Analyzing pixel residuals for GAN, diffusion, and structural distortions...'
      );

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: uploadBase64,
          mimeType: uploadMimeType,
          scanMode,
          source,
          depth,
          cvMetrics: {
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
        }),
      });

      const payload = (await response.json()) as ForensicAnalysisResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || `Server returned HTTP ${response.status}`
        );
      }

      const newRecord: ScanRecord = {
        id: `vdx-${Date.now().toString(36)}`,
        title,
        source,
        scanMode,
        depth,
        imageDataUrl,
        cvTelemetry,
        analysis: payload,
        createdAt: new Date().toISOString(),
        sha256Short,
      };

      setRecords((prev) => [newRecord, ...prev]);
      setActiveRecordId(newRecord.id);
      setActiveLayer('regions');
      setActiveTab('lab');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to complete forensic inspection.';
      setErrorMessage(msg);
    } finally {
      setPipelineStage(null);
      setPendingPreviewUrl(null);
    }
  };

  const handleOpenRecord = (record: ScanRecord) => {
    setActiveRecordId(record.id);
    setSelectedSignalId(null);
    setActiveLayer('regions');
    setActiveTab('lab');
    setMobilePanelOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeRecordId === id) {
        setActiveRecordId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const isAnalyzing = pipelineStage !== null;

  const controlRailContent = (
    <>
      <div className="liquid-glass rounded-3xl p-5 space-y-5">
        <div>
          <h1 className="font-display text-base font-semibold text-slate-100">
            Verity + Index
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Verify image, document, and graphic authenticity.
          </p>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-slate-300">
            Inspection Target
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.08] bg-black/30 p-1">
            {SCAN_MODES.map((m) => {
              const active = scanMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScanMode(m.id)}
                  className={`min-h-[34px] rounded-lg px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white/[0.12] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-slate-300">
            Analysis Depth
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setDepth('standard')}
              className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                depth === 'standard'
                  ? 'bg-white/[0.12] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setDepth('deep')}
              className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                depth === 'deep'
                  ? 'bg-white/[0.12] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Deep Forensic
            </button>
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <div className="liquid-glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Recent Index
            </h2>
            <button
              type="button"
              onClick={() => {
                setMobilePanelOpen(false);
                setActiveTab('archive');
              }}
              className="text-xs font-medium text-cyan-300 hover:text-cyan-200 whitespace-nowrap"
            >
              View All
            </button>
          </div>
          <div className="mt-2 divide-y divide-white/[0.06]">
            {records.slice(0, 4).map((rec) => {
              const meta = getVerdictMeta(rec.analysis.verdict);
              const isCurrent =
                activeTab === 'lab' && activeRecord?.id === rec.id;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleOpenRecord(rec)}
                  className={`flex w-full items-center justify-between gap-2 py-2.5 px-2.5 -mx-2.5 rounded-xl text-left transition-colors ${
                    isCurrent ? 'bg-white/[0.10]' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-200">
                      {rec.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className={meta.colorClass}>{meta.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(rec.analysis.syntheticProbability)}%
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {rec.sha256Short.slice(0, 6)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col text-slate-100 pb-16 md:pb-0">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewScan={() => {
          setErrorMessage(null);
          setActiveTab('scanner');
        }}
      />

      {errorMessage && (
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6">
          <div
            role="alert"
            className="liquid-glass flex items-start justify-between gap-4 rounded-2xl border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div>
                <div className="font-medium text-rose-100">
                  Forensic Inspection Interrupted
                </div>
                <p className="mt-0.5 text-xs text-rose-200/85">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-medium text-rose-200 hover:text-white whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06090F]/75 backdrop-blur-xl px-4"
        >
          <div className="liquid-glass w-full max-w-sm rounded-3xl p-6 text-center">
            {pendingPreviewUrl && (
              <div className="mx-auto mb-4 h-24 w-32 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
                <img
                  src={pendingPreviewUrl}
                  alt="Media under forensic inspection"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover opacity-85"
                />
              </div>
            )}

            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>

            <div className="font-mono text-xs text-cyan-300 tabular-nums">
              Step {pipelineStep} of 2
            </div>
            <h2 className="mt-1 font-display text-base font-semibold text-slate-100">
              Inspecting Media Pixels
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              {pipelineStage}
            </p>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-300 ease-out"
                style={{ width: pipelineStep === 1 ? '42%' : '88%' }}
              />
            </div>
          </div>
        </div>
      )}

      {mobilePanelOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Verity and Index controls"
        >
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMobilePanelOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[85vw] max-w-[330px] flex-col gap-5 overflow-y-auto border-r border-white/[0.12] bg-[#06090F]/90 p-4 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-display text-sm font-semibold text-slate-100">
                Console & Index
              </span>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                aria-label="Close left panel"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {controlRailContent}
          </div>
        </div>
      )}

      <div className="flex-1">
        {(activeTab === 'scanner' || activeTab === 'lab') && (
          <main className="mx-auto max-w-[1440px] px-4 py-4 sm:py-6 sm:px-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Desktop Control Rail */}
              <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-5">
                {controlRailContent}
              </aside>

              {/* Primary Viewport Stage */}
              <section className="lg:col-span-8 xl:col-span-9 space-y-6">
                {activeTab === 'scanner' && (
                  <CameraScanner
                    scanMode={scanMode}
                    isAnalyzing={isAnalyzing}
                    onCaptureImage={(dataUrl, title, source, rawBuffer) =>
                      void runForensicPipeline(
                        dataUrl,
                        title,
                        source,
                        rawBuffer
                      )
                    }
                  />
                )}

                {activeTab === 'lab' &&
                  (activeRecord ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>Active Case</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {activeRecord.source}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(
                                activeRecord.createdAt
                              ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-100">
                            {activeRecord.title}
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('scanner')}
                          className="min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/[0.11] whitespace-nowrap shrink-0"
                        >
                          <Camera className="h-3.5 w-3.5 text-cyan-300" />
                          Scan Another
                        </button>
                      </div>

                      <InspectionStage
                        record={activeRecord}
                        activeLayer={activeLayer}
                        onChangeLayer={setActiveLayer}
                        selectedSignalId={selectedSignalId}
                        onSelectSignal={setSelectedSignalId}
                      />

                      <ForensicReportPanel
                        record={activeRecord}
                        selectedSignalId={selectedSignalId}
                        onSelectSignal={(id) => {
                          setSelectedSignalId(id);
                          if (
                            id &&
                            activeLayer !== 'regions' &&
                            activeLayer !== 'source'
                          ) {
                            setActiveLayer('regions');
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="liquid-glass flex flex-col items-center justify-center rounded-3xl px-6 py-20 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-cyan-300">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <h2 className="font-display text-lg font-semibold text-slate-100">
                        Forensic Lab Empty
                      </h2>
                      <p className="mt-1.5 max-w-md text-sm text-slate-400">
                        Capture media with your camera or upload a file to inspect pixel residuals and neural artifact findings.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('scanner')}
                        className="mt-6 min-h-[44px] rounded-xl border border-cyan-300/40 bg-cyan-400/90 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:bg-cyan-300 whitespace-nowrap shrink-0"
                      >
                        Go to Scanner
                      </button>
                    </div>
                  ))}
              </section>
            </div>
          </main>
        )}

        {activeTab === 'archive' && (
          <IndexArchiveView
            records={records}
            onOpenRecord={handleOpenRecord}
            onDeleteRecord={handleDeleteRecord}
            onGoToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'methodology' && <MethodologyView />}
      </div>

      <footer className="hidden md:block border-t border-white/[0.06] py-5">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 text-xs text-slate-500">
          <span>Veridex by Ed</span>
          <span>Verity + Index Forensic Media Verification</span>
        </div>
      </footer>

      {/* Mobile Left-Center Arrow-Only Console Trigger */}
      {(activeTab === 'scanner' || activeTab === 'lab') && !mobilePanelOpen && (
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          aria-label="Open Verity + Index and Recent Index panel"
          className="liquid-glass fixed left-0 top-1/2 -translate-y-1/2 z-30 flex min-h-[52px] w-7 items-center justify-center rounded-r-2xl border-l-0 text-cyan-300/90 transition-colors hover:bg-white/[0.10] hover:text-cyan-200 active:scale-[0.96] lg:hidden"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Mobile Bottom Thumb Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-4 border-t border-white/[0.10] bg-[#06090F]/80 backdrop-blur-2xl md:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'scanner' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <Camera className="h-5 w-5" />
          <span>Scanner</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lab')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'lab' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <Microscope className="h-5 w-5" />
          <span>Lab</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'archive' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <Database className="h-5 w-5" />
          <span>Index</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('methodology')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'methodology' ? 'text-cyan-300' : 'text-slate-400'
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span>Method</span>
        </button>
      </nav>
    </div>
  );
}
