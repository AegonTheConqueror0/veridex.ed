import type { CvTelemetry } from '../types/forensics';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Inspects raw file bytes (JPEG APP markers & PNG tEXt/iTXt chunks) for
 * embedded generator signatures, C2PA manifests, or camera EXIF headers.
 */
export async function extractBinarySignatures(buffer: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buffer);
  const signatures: string[] = [];
  const sampleLimit = Math.min(bytes.length, 256 * 1024);
  const decoder = new TextDecoder('latin1');
  const textSlice = decoder.decode(bytes.subarray(0, sampleLimit));

  const knownMarkers: Array<[RegExp, string]> = [
    [/c2pa|jumbf/i, 'C2PA / Content Credentials Marker'],
    [/Stable Diffusion|AUTOMATIC1111|ComfyUI/i, 'Stable Diffusion / ComfyUI Parameter Chunk'],
    [/Midjourney/i, 'Midjourney Generator Metadata'],
    [/DALL-E|OpenAI/i, 'DALL-E / OpenAI Metadata'],
    [/Adobe Firefly|Adobe Photoshop/i, 'Adobe Editing / Firefly Signature'],
    [/Canon|NIKON|SONY|FUJIFILM|Apple|Samsung|Google/i, 'Camera Hardware EXIF String'],
    [/Exif\0\0/i, 'EXIF APP1 Header Present'],
    [/ICC_PROFILE/i, 'Embedded ICC Color Profile'],
  ];

  for (const [pattern, label] of knownMarkers) {
    if (pattern.test(textSlice) && !signatures.includes(label)) {
      signatures.push(label);
    }
  }

  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    signatures.unshift('JPEG Bitstream');
  } else if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    signatures.unshift('PNG Lossless Raster');
  } else if (bytes.length > 12 && decoder.decode(bytes.subarray(0, 4)) === 'RIFF') {
    signatures.unshift('WebP Container');
  }

  return signatures.length > 0 ? signatures : ['Raw Canvas Capture (Stripped EXIF)'];
}

export async function computeShortSha256(dataUrl: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataUrl.slice(0, 120000));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 16).toUpperCase();
  } catch {
    return '0000000000000000';
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image into optical canvas'));
    img.src = src;
  });
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/**
 * Runs real browser-side Computer Vision signal processing on the target media:
 * 1. Error Level Analysis (JPEG recompression differential)
 * 2. 3x3 Laplacian high-pass noise floor extraction & spatial uniformity
 * 3. Radial RGB chromatic aberration edge divergence
 * 4. 8x8 DCT boundary blockiness metric
 */
export async function analyzeImageSignals(
  sourceDataUrl: string,
  metadataSignatures: string[]
): Promise<{ cvTelemetry: CvTelemetry; uploadBase64: string; uploadMimeType: string }> {
  const img = await loadImage(sourceDataUrl);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Normalize analysis canvas up to 640px longest side for responsive DSP speed
  const maxDspDim = 640;
  const dspScale = Math.min(1, maxDspDim / Math.max(origW, origH));
  const w = Math.max(32, Math.round(origW * dspScale));
  const h = Math.max(32, Math.round(origH * dspScale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) {
    throw new Error('2D Canvas context unavailable');
  }
  srcCtx.drawImage(img, 0, 0, w, h);
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const px = srcData.data;

  // --- 1. Error Level Analysis (ELA) ---
  const reencodedUrl = srcCanvas.toDataURL('image/jpeg', 0.88);
  const reencodedImg = await loadImage(reencodedUrl);
  const reCanvas = document.createElement('canvas');
  reCanvas.width = w;
  reCanvas.height = h;
  const reCtx = reCanvas.getContext('2d', { willReadFrequently: true })!;
  reCtx.drawImage(reencodedImg, 0, 0, w, h);
  const rePx = reCtx.getImageData(0, 0, w, h).data;

  const elaCanvas = document.createElement('canvas');
  elaCanvas.width = w;
  elaCanvas.height = h;
  const elaCtx = elaCanvas.getContext('2d')!;
  const elaImgData = elaCtx.createImageData(w, h);
  const elaOut = elaImgData.data;

  let elaSum = 0;
  let elaHotspots = 0;
  const totalPixels = w * h;

  for (let i = 0; i < px.length; i += 4) {
    const dr = Math.abs(px[i] - rePx[i]);
    const dg = Math.abs(px[i + 1] - rePx[i + 1]);
    const db = Math.abs(px[i + 2] - rePx[i + 2]);
    const meanDiff = (dr + dg + db) / 3;
    elaSum += meanDiff;
    if (meanDiff > 8.5) elaHotspots++;

    // False-color scientific visualization (cyan-to-amber-to-crimson)
    const amp = Math.min(255, meanDiff * 14);
    if (amp < 70) {
      elaOut[i] = 8;
      elaOut[i + 1] = clampByte(amp * 2.2);
      elaOut[i + 2] = clampByte(40 + amp * 2.5);
    } else if (amp < 165) {
      elaOut[i] = clampByte((amp - 70) * 2.6);
      elaOut[i + 1] = clampByte(180 + (amp - 70) * 0.4);
      elaOut[i + 2] = clampByte(210 - (amp - 70) * 1.9);
    } else {
      elaOut[i] = 244;
      elaOut[i + 1] = clampByte(220 - (amp - 165) * 2.1);
      elaOut[i + 2] = 63;
    }
    elaOut[i + 3] = 255;
  }
  elaCtx.putImageData(elaImgData, 0, 0);

  // --- 2. Laplacian High-Frequency Noise Residual & Spatial Uniformity ---
  const luma = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    luma[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = w;
  noiseCanvas.height = h;
  const noiseCtx = noiseCanvas.getContext('2d')!;
  const noiseImgData = noiseCtx.createImageData(w, h);
  const noiseOut = noiseImgData.data;

  // Divide image into 4x4 grid regions to compute local noise floor variance
  const gridCols = 4;
  const gridRows = 4;
  const cellSums = new Float64Array(gridCols * gridRows);
  const cellCounts = new Uint32Array(gridCols * gridRows);

  let lapSum = 0;
  let lapSqSum = 0;
  let edgeCount = 0;
  let chromaDivergeSum = 0;

  for (let y = 1; y < h - 1; y++) {
    const gy = Math.min(gridRows - 1, Math.floor((y / h) * gridRows));
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const center = luma[idx];
      const lap =
        4 * center -
        luma[idx - 1] -
        luma[idx + 1] -
        luma[idx - w] -
        luma[idx + w];

      const absLap = Math.abs(lap);
      lapSum += absLap;
      lapSqSum += lap * lap;

      const gx = Math.min(gridCols - 1, Math.floor((x / w) * gridCols));
      const cellIdx = gy * gridCols + gx;
      cellSums[cellIdx] += absLap;
      cellCounts[cellIdx]++;

      // Chromatic divergence near edges (R vs B horizontal gradient mismatch)
      if (absLap > 18) {
        const pi = idx * 4;
        const piRight = (idx + 1) * 4;
        const rGrad = Math.abs(px[piRight] - px[pi]);
        const bGrad = Math.abs(px[piRight + 2] - px[pi + 2]);
        chromaDivergeSum += Math.abs(rGrad - bGrad);
        edgeCount++;
      }

      // Render crisp green/cyan forensic residual map
      const mag = clampByte(absLap * 4.5);
      const outIdx = idx * 4;
      noiseOut[outIdx] = mag > 180 ? 245 : 14;
      noiseOut[outIdx + 1] = clampByte(24 + mag * 0.92);
      noiseOut[outIdx + 2] = clampByte(32 + mag * 0.85);
      noiseOut[outIdx + 3] = 255;
    }
  }
  noiseCtx.putImageData(noiseImgData, 0, 0);

  const interiorPixels = Math.max(1, (w - 2) * (h - 2));
  const lapMean = lapSum / interiorPixels;
  const lapVariance = Math.max(0, lapSqSum / interiorPixels - lapMean * lapMean);

  // Spatial noise uniformity across 16 grid cells (low coefficient of variation = synthetic uniformity)
  const cellMeans: number[] = [];
  for (let c = 0; c < gridCols * gridRows; c++) {
    if (cellCounts[c] > 0) cellMeans.push(cellSums[c] / cellCounts[c]);
  }
  const meanOfCells = cellMeans.reduce((a, b) => a + b, 0) / Math.max(1, cellMeans.length);
  const stdOfCells = Math.sqrt(
    cellMeans.reduce((a, b) => a + (b - meanOfCells) ** 2, 0) / Math.max(1, cellMeans.length)
  );
  const cov = meanOfCells > 0 ? stdOfCells / meanOfCells : 0;
  const spatialNoiseUniformity = Math.round(Math.max(0, Math.min(100, (1 - cov) * 100)));

  // --- 3. 8x8 DCT Boundary Energy Ratio ---
  let boundaryEnergy = 0;
  let boundarySamples = 0;
  let nonBoundaryEnergy = 0;
  let nonBoundarySamples = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const diff = Math.abs(luma[y * w + x] - luma[y * w + (x - 1)]);
      if (x % 8 === 0) {
        boundaryEnergy += diff;
        boundarySamples++;
      } else {
        nonBoundaryEnergy += diff;
        nonBoundarySamples++;
      }
    }
  }
  const bMean = boundaryEnergy / Math.max(1, boundarySamples);
  const nbMean = nonBoundaryEnergy / Math.max(1, nonBoundarySamples);
  const dctBlockiness = Number((nbMean > 0 ? bMean / nbMean : 1).toFixed(2));

  const chromaticDivergence = Number(
    (edgeCount > 0 ? chromaDivergeSum / edgeCount : 0).toFixed(2)
  );

  // --- 4. Prepare High-Detail Upload Payload for Gemini Vision (max 1440px) ---
  const maxAiDim = 1440;
  const aiScale = Math.min(1, maxAiDim / Math.max(origW, origH));
  const aiW = Math.max(64, Math.round(origW * aiScale));
  const aiH = Math.max(64, Math.round(origH * aiScale));
  const aiCanvas = document.createElement('canvas');
  aiCanvas.width = aiW;
  aiCanvas.height = aiH;
  const aiCtx = aiCanvas.getContext('2d')!;
  aiCtx.drawImage(img, 0, 0, aiW, aiH);
  const aiJpegDataUrl = aiCanvas.toDataURL('image/jpeg', 0.92);
  const uploadBase64 = aiJpegDataUrl.split(',')[1] || '';

  const divisor = gcd(origW, origH);
  const aspectRatio = `${origW / divisor}:${origH / divisor}`;

  return {
    cvTelemetry: {
      width: origW,
      height: origH,
      aspectRatio,
      elaMeanDelta: Number((elaSum / totalPixels).toFixed(2)),
      elaHotspotRatio: Number(((elaHotspots / totalPixels) * 100).toFixed(2)),
      laplacianVariance: Number(lapVariance.toFixed(1)),
      spatialNoiseUniformity,
      chromaticDivergence,
      dctBlockiness,
      metadataSignatures,
      elaDataUrl: elaCanvas.toDataURL('image/png'),
      noiseDataUrl: noiseCanvas.toDataURL('image/png'),
    },
    uploadBase64,
    uploadMimeType: 'image/jpeg',
  };
}
