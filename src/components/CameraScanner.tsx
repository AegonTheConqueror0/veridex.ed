import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  FlipHorizontal,
  Flashlight,
  Upload,
  Aperture,
  AlertTriangle,
} from 'lucide-react';
import type { ScanMode, ScanSource } from '../types/forensics';

interface CameraScannerProps {
  scanMode: ScanMode;
  isAnalyzing: boolean;
  onCaptureImage: (
    dataUrl: string,
    title: string,
    source: ScanSource,
    rawBuffer?: ArrayBuffer
  ) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  scanMode,
  isAnalyzing,
  onCaptureImage,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<
    'idle' | 'starting' | 'active' | 'denied' | 'unavailable'
  >('idle');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setCameraError(
          'Live camera API is unavailable here. Use device capture or upload an image.'
        );
        return;
      }

      stopStream();
      setCameraState('starting');
      setCameraError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
          };
          setTorchSupported(Boolean(caps.torch));
        }
        setCameraState('active');
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraState('denied');
          setCameraError(
            'Camera permission declined. Allow camera access or capture via upload below.'
          );
        } else {
          setCameraState('unavailable');
          setCameraError(
            'No live optical sensor detected. Use mobile capture or upload an image.'
          );
        }
      }
    },
    [stopStream]
  );

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const handleToggleCamera = () => {
    if (cameraState === 'active') {
      stopStream();
      setCameraState('idle');
    } else {
      void startCamera(facingMode);
    }
  };

  const handleFlipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraState === 'active') {
      void startCamera(next);
    }
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || cameraState !== 'active' || isAnalyzing) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vw, vh);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    const stamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    stopStream();
    setCameraState('idle');
    onCaptureImage(dataUrl, `Camera Capture ${stamp}`, 'camera');
  };

  const processFile = async (file: File, source: ScanSource) => {
    if (!file.type.startsWith('image/')) {
      setCameraError('Select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    const rawBuffer = await file.arrayBuffer();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCaptureImage(reader.result, file.name, source, rawBuffer);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file, 'upload');
    }
  };

  const reticleHint =
    scanMode === 'document'
      ? 'Align document inside frame'
      : scanMode === 'photograph'
        ? 'Center subject face or textures'
        : scanMode === 'graphic'
          ? 'Frame graphic edges cleanly'
          : 'Hold steady to scan';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`liquid-glass relative overflow-hidden rounded-3xl transition-colors ${
        dragOver ? 'border-cyan-400/70 bg-cyan-500/[0.08]' : ''
      }`}
    >
      <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${
            cameraState === 'active' ? 'block' : 'hidden'
          }`}
        />

        {cameraState === 'active' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-100">
              <span className="rounded-xl border border-white/15 bg-black/45 px-3 py-1 backdrop-blur-md">
                {facingMode === 'environment' ? 'REAR LENS' : 'FRONT LENS'}
              </span>
              <span className="rounded-xl border border-white/15 bg-black/45 px-3 py-1 backdrop-blur-md tabular-nums">
                {scanMode.toUpperCase()}
              </span>
            </div>

            <div className="relative mx-auto h-3/5 w-4/5 max-w-md">
              <span className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-cyan-300/90 rounded-tl-md" />
              <span className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-cyan-300/90 rounded-tr-md" />
              <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-cyan-300/90 rounded-bl-md" />
              <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-cyan-300/90 rounded-br-md" />
            </div>

            <div className="mx-auto rounded-xl border border-white/15 bg-black/45 px-3.5 py-1 text-xs text-slate-100 backdrop-blur-md">
              {reticleHint}
            </div>
          </div>
        )}

        {cameraState !== 'active' && (
          <div className="flex max-w-md flex-col items-center px-6 py-10 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
              <Camera className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold text-slate-100 [text-wrap:balance]">
              Scan Media or Capture Live
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Use your device camera or drop an image to inspect for GAN, diffusion, and document manipulation artifacts.
            </p>

            {cameraError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-left text-xs text-amber-200 backdrop-blur-md">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={cameraState === 'starting' || isAnalyzing}
                onClick={handleToggleCamera}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/90 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-all hover:bg-cyan-300 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Camera className="h-4 w-4" />
                {cameraState === 'starting' ? 'Connecting...' : 'Live Camera'}
              </button>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => mobileCameraInputRef.current?.click()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-100 backdrop-blur-md transition-colors hover:bg-white/[0.10] whitespace-nowrap shrink-0 sm:hidden"
              >
                <Aperture className="h-4 w-4 text-cyan-300" />
                Device Camera
              </button>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md transition-colors hover:bg-white/[0.11] whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4 text-slate-300" />
                Upload Image
              </button>
            </div>
          </div>
        )}
      </div>

      {cameraState === 'active' && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-white/[0.03] px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFlipCamera}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-white/[0.11] whitespace-nowrap shrink-0"
            >
              <FlipHorizontal className="h-4 w-4 text-slate-300" />
              Flip Lens
            </button>

            {torchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                  torchOn
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                    : 'border-white/15 bg-white/[0.06] text-slate-100 hover:bg-white/[0.11]'
                }`}
              >
                <Flashlight className="h-4 w-4" />
                {torchOn ? 'Light On' : 'Light Off'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleCamera}
              className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.09] whitespace-nowrap shrink-0"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleShutter}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/90 px-5 py-2 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:bg-cyan-300 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Aperture className="h-4 w-4" />
              Capture & Scan
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processFile(f, 'upload');
          e.target.value = '';
        }}
      />

      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processFile(f, 'camera');
          e.target.value = '';
        }}
      />
    </div>
  );
};
