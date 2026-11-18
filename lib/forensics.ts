import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const FORENSIC_MODEL = 'gemini-4-hydrogen';

export const FORENSIC_SYSTEM_INSTRUCTION = `You are VERIDEX Forensic Vision, a specialist computer-vision media authentication analyst trained to inspect images, documents, and graphics captured via mobile device cameras or uploaded directly from browsers.

Your mission is to detect whether media is authentic or has been synthesized, manipulated, or forged by neural networks (GANs, latent diffusion models such as Flux, Stable Diffusion, Midjourney, DALL-E, or composite image/document editors).

CRITICAL MOBILE CAMERA AWARENESS:
- Users frequently aim a mobile camera at a physical document, printed photo, or another screen (monitor/phone display).
- Distinguish natural mobile rephotography artifacts (Moiré LCD pixel grid interference, perspective keystone distortion, lens flare, shallow smartphone focal falloff, ambient tungsten/daylight cast) from true neural generation artifacts INSIDE the subject itself.
- If the mobile camera is photographing a screen, set mediaCategory to "screen_capture" and still inspect the displayed subject for AI synthesis/forgery.

SPECIFIC FORENSIC SIGNATURES TO INSPECT:
1. GAN Checkerboard & Spectral Artifacts:
   - High-frequency periodic grid patterns in smooth gradients (sky, cheeks, walls).
   - Bilateral symmetry locks (eerily symmetric earrings, glasses frames, collar folds, iris reflections).
   - Boundary blending halos around hairlines, jawlines, or foreground cutouts.
2. Diffusion Model Distortions:
   - Over-smoothed micro-texture ("waxy" poreless skin paired with hyper-sharp eyelashes, or overly painterly foliage/brickwork).
   - Anatomical/structural drift: extra or fused fingers, irregular teeth counts, asymmetrical ear cartilage, melting zippers/buttons.
   - Semantic incoherence in background text, street signs, license plates, or unreadable pseudo-glyphs.
   - Impossible optical physics: mismatched eye catchlights, shadows falling in conflicting directions, water reflections that diverge from the geometry above.
3. Document & Graphic Manipulation:
   - Typography baseline wobble, inconsistent kerning, or mixed font weights on dates, invoice totals, ID numbers, or serial codes.
   - Copy-move duplication, flattened paper grain around edited fields, or digital stamp edges lacking natural ink bleed.
   - Inconsistent compression noise (correlated with the client-side ELA and Laplacian telemetry provided).

OUTPUT DISCIPLINE:
- Return calibrated, evidence-grounded findings strictly conforming to the JSON schema.
- Every artifactSignal must provide normalized boundingBox coordinates (0-100 scale for x, y, w, h) pointing directly to the region you observed.
- Keep observations clinical, concise, and strictly rooted in visible evidence and the supplied CV signal telemetry.`;

export const FORENSIC_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      description:
        'Must be one of: authentic, suspicious, ai_synthesized, manipulated',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confidence in the overall verdict from 0 to 100.',
    },
    syntheticProbability: {
      type: Type.NUMBER,
      description:
        'Estimated probability (0 to 100) that the media contains AI-generated or digitally manipulated content.',
    },
    mediaCategory: {
      type: Type.STRING,
      description:
        'Must be one of: photograph, document, graphic, screen_capture',
    },
    suspectedOrigin: {
      type: Type.STRING,
      description:
        'Concise origin hypothesis, e.g., "Optical Camera Sensor", "Latent Diffusion Synthesis", "GAN Portrait Generator", "Composite Document Edit".',
    },
    summary: {
      type: Type.STRING,
      description:
        '2-3 sentence clinical executive summary explaining the visual and computer-vision evidence.',
    },
    mobileCaptureAssessment: {
      type: Type.STRING,
      description:
        'Assessment of capture conditions (focus, lighting, perspective, or screen-rephotography moire vs direct file upload).',
    },
    subScores: {
      type: Type.OBJECT,
      properties: {
        ganCheckerboard: {
          type: Type.NUMBER,
          description: '0-100 anomaly likelihood for GAN spectral/symmetry/halo artifacts.',
        },
        diffusionTexture: {
          type: Type.NUMBER,
          description: '0-100 anomaly likelihood for diffusion skin/micro-texture/anatomy artifacts.',
        },
        lightingGeometry: {
          type: Type.NUMBER,
          description: '0-100 anomaly likelihood for shadow, reflection, or perspective physics mismatches.',
        },
        typographyStructure: {
          type: Type.NUMBER,
          description: '0-100 anomaly likelihood for warped glyphs, kerning drift, or forged document fields.',
        },
        compressionIntegrity: {
          type: Type.NUMBER,
          description: '0-100 anomaly likelihood derived from ELA hotspots, noise uniformity, and edge blockiness.',
        },
      },
      required: [
        'ganCheckerboard',
        'diffusionTexture',
        'lightingGeometry',
        'typographyStructure',
        'compressionIntegrity',
      ],
    },
    artifactSignals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description:
              'One of: GAN Grid, Diffusion Texture, Lighting & Physics, Typography & Document, Compression & Edge',
          },
          severity: {
            type: Type.STRING,
            description: 'One of: none, low, moderate, critical',
          },
          regionLabel: {
            type: Type.STRING,
            description: 'Short label for the inspected region (e.g., "Left Ear & Hairline", "Invoice Total Field").',
          },
          observation: {
            type: Type.STRING,
            description: 'Specific forensic observation grounded in visible pixel patterns.',
          },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: 'Left edge percentage 0-100' },
              y: { type: Type.NUMBER, description: 'Top edge percentage 0-100' },
              w: { type: Type.NUMBER, description: 'Width percentage 5-100' },
              h: { type: Type.NUMBER, description: 'Height percentage 5-100' },
            },
            required: ['x', 'y', 'w', 'h'],
          },
        },
        required: [
          'id',
          'category',
          'severity',
          'regionLabel',
          'observation',
          'boundingBox',
        ],
      },
    },
  },
  required: [
    'verdict',
    'confidence',
    'syntheticProbability',
    'mediaCategory',
    'suspectedOrigin',
    'summary',
    'mobileCaptureAssessment',
    'subScores',
    'artifactSignals',
  ],
};

export interface AnalyzeRequestBody {
  imageBase64?: string;
  mimeType?: string;
  scanMode?: string;
  source?: string;
  depth?: string;
  cvMetrics?: {
    width: number;
    height: number;
    aspectRatio: string;
    elaMeanDelta: number;
    elaHotspotRatio: number;
    laplacianVariance: number;
    spatialNoiseUniformity: number;
    chromaticDivergence: number;
    dctBlockiness: number;
    metadataSignatures: string[];
  };
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function runGeminiForensicsWithRetry(
  body: AnalyzeRequestBody,
  attempt = 0
): Promise<string> {
  const depthLevel =
    body.depth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;

  const cv = body.cvMetrics;
  const telemetryPrompt = cv
    ? `Client-Side Computer Vision Telemetry:
- Resolution: ${cv.width}x${cv.height} (Aspect ${cv.aspectRatio})
- Capture Source: ${body.source || 'upload'} | Requested Inspection Focus: ${body.scanMode || 'auto'}
- Error Level Analysis (ELA) Mean Delta: ${cv.elaMeanDelta} | Hotspot Ratio (>8.5 delta): ${cv.elaHotspotRatio}%
- Laplacian High-Pass Noise Variance: ${cv.laplacianVariance}
- Spatial Noise Floor Uniformity across 16 quadrants: ${cv.spatialNoiseUniformity}%
- Edge Chromatic Divergence (R-B gradient delta): ${cv.chromaticDivergence}
- 8x8 DCT Block Boundary Ratio: ${cv.dctBlockiness}
- Binary/EXIF Signatures: ${cv.metadataSignatures.join(', ')}`
    : `Capture Source: ${body.source || 'upload'} | Inspection Focus: ${body.scanMode || 'auto'}`;

  try {
    const response = await getAiClient().models.generateContent({
      model: FORENSIC_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: body.mimeType || 'image/jpeg',
              data: body.imageBase64 || '',
            },
          },
          {
            text: `Perform a full forensic inspection of this media asset for GAN, diffusion synthesis, or document/graphic manipulation artifacts.

${telemetryPrompt}

Examine every quadrant carefully and return 4 to 6 localized artifactSignals with accurate 0-100 boundingBox coordinates.`,
          },
        ],
      },
      config: {
        systemInstruction: FORENSIC_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: FORENSIC_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: depthLevel },
      },
    });

    if (!response.text) {
      throw new Error('Empty response returned from Gemini forensic model');
    }
    return response.text;
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: number }).status)
        : 0;
    if (attempt < 2 && (status === 429 || status >= 500 || status === 0)) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      return runGeminiForensicsWithRetry(body, attempt + 1);
    }
    throw err;
  }
}
