export type ScanSource = 'camera' | 'upload' | 'sample';

export type ScanMode = 'auto' | 'photograph' | 'document' | 'graphic';

export type AnalysisDepth = 'standard' | 'deep';

export type ForensicVerdict =
  | 'authentic'
  | 'suspicious'
  | 'ai_synthesized'
  | 'manipulated';

export type SeverityLevel = 'none' | 'low' | 'moderate' | 'critical';

export type InspectionLayer = 'source' | 'ela' | 'noise' | 'regions';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArtifactSignal {
  id: string;
  category:
    | 'GAN Grid'
    | 'Diffusion Texture'
    | 'Lighting & Physics'
    | 'Typography & Document'
    | 'Compression & Edge';
  severity: SeverityLevel;
  regionLabel: string;
  observation: string;
  boundingBox: BoundingBox;
}

export interface CvTelemetry {
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
  elaDataUrl: string;
  noiseDataUrl: string;
}

export interface ForensicSubScores {
  ganCheckerboard: number;
  diffusionTexture: number;
  lightingGeometry: number;
  typographyStructure: number;
  compressionIntegrity: number;
}

export interface ForensicAnalysisResult {
  verdict: ForensicVerdict;
  confidence: number;
  syntheticProbability: number;
  mediaCategory: 'photograph' | 'document' | 'graphic' | 'screen_capture';
  suspectedOrigin: string;
  summary: string;
  mobileCaptureAssessment: string;
  subScores: ForensicSubScores;
  artifactSignals: ArtifactSignal[];
  modelUsed: string;
  analyzedAt: string;
}

export interface ScanRecord {
  id: string;
  title: string;
  source: ScanSource;
  scanMode: ScanMode;
  depth: AnalysisDepth;
  imageDataUrl: string;
  cvTelemetry: CvTelemetry;
  analysis: ForensicAnalysisResult;
  createdAt: string;
  sha256Short: string;
}
