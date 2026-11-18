import React from 'react';

export const MethodologyView: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 space-y-8">
      <div className="border-b border-white/[0.08] pb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 [text-wrap:balance]">
          Veridex by Ed — Verification Architecture
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Verity + Index pairs deterministic pixel-level computer vision signal extraction in your browser with neural artifact inspection to authenticate photographs, printed or digital documents, and graphics.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-100">
            01. Client-Side Computer Vision Signal Extraction
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Every captured frame or uploaded file is decoded onto an offscreen canvas before leaving your device to extract objective frequency and compression metrics:
          </p>
          <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-300">
            <li>
              <strong className="text-slate-100">Error Level Analysis (ELA):</strong> Re-encodes the frame at 88% JPEG quality and maps 14× amplified luminance residuals to reveal pasted regions, inpainted patches, and edited document fields.
            </li>
            <li>
              <strong className="text-slate-100">3×3 Laplacian Noise Floor:</strong> High-pass spatial convolution isolates sensor grain versus unnaturally smooth diffusion denoising across 16 image quadrants.
            </li>
            <li>
              <strong className="text-slate-100">Radial Chromatic Divergence:</strong> Measures R–B channel gradient dispersion along sharp edges—real optical glass introduces subtle lateral aberration whereas generative models render uniformly aligned color edges.
            </li>
            <li>
              <strong className="text-slate-100">Bitstream & EXIF Inspection:</strong> Scans raw JPEG APP1 and PNG tEXt headers for C2PA manifests, hardware camera tags, or generative tool chunks.
            </li>
          </ul>
        </div>

        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-100">
            02. Neural Artifact Vision Analysis
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The visual frame and extracted CV telemetry are jointly evaluated by the forensic vision engine, trained specifically to distinguish mobile rephotography effects from true synthetic distortion:
          </p>
          <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-300">
            <li>
              <strong className="text-slate-100">GAN Distortions:</strong> Spectral checkerboard grids in smooth gradients, bilateral symmetry locks in eyes/jewelry, and hairline blending halos.
            </li>
            <li>
              <strong className="text-slate-100">Diffusion Model Signatures:</strong> Poreless waxy micro-textures paired with hyper-sharp strands, irregular anatomical structures, inconsistent specular catchlights, and melted background glyphs.
            </li>
            <li>
              <strong className="text-slate-100">Document & Graphic Integrity:</strong> Baseline wobble, kerning drift on altered numerals, flattened paper grain around forged dates, and impossible shadow/reflection geometry.
            </li>
            <li>
              <strong className="text-slate-100">Mobile Screen Calibration:</strong> Separates LCD moiré grid interference and lens perspective keystone from underlying generative anomalies inside the photographed subject.
            </li>
          </ul>
        </div>
      </section>

      <section className="liquid-glass rounded-3xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-100">
          Mobile Camera Capture Protocol
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3 text-xs leading-relaxed text-slate-300">
          <div>
            <div className="font-medium text-cyan-300">Minimize Specular Glare</div>
            <p className="mt-1 text-slate-400">
              Tilt the phone 10–15° off-axis when scanning glossy paper IDs or glass displays so flash hotspots do not mask compression boundaries.
            </p>
          </div>
          <div>
            <div className="font-medium text-cyan-300">Fill the Alignment Reticle</div>
            <p className="mt-1 text-slate-400">
              Frame faces, signatures, or numeric tables inside the center brackets so high-frequency Laplacian and typography checks retain full pixel resolution.
            </p>
          </div>
          <div>
            <div className="font-medium text-cyan-300">Use Deep Forensic Mode</div>
            <p className="mt-1 text-slate-400">
              Enable Deep Forensic depth in the scanner console when inspecting high-stakes financial invoices, contracts, or subtle face-swap composites.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
