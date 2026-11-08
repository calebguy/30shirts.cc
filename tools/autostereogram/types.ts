export type PatternMode = "monochrome" | "color" | "custom";
export type ViewingMode = "parallel" | "cross-eyed";
export type ImageFit = "contain" | "cover";
export type RenderPurpose = "preview" | "export";

export interface GeneratorSettings {
  width: number;
  height: number;
  dpi: number;
  repeatInches: number;
  depthStrength: number;
  seed: number;
  dotSize: number;
  patternMode: PatternMode;
  viewingMode: ViewingMode;
  imageFit: ImageFit;
  invertDepth: boolean;
  guideDots: boolean;
}

export interface RenderRequest {
  type: "render";
  requestId: number;
  purpose: RenderPurpose;
  settings: GeneratorSettings;
  depthMap?: Blob;
  pattern?: Blob;
}

export interface RenderProgress {
  type: "progress";
  requestId: number;
  progress: number;
}

export interface RenderResult {
  type: "result";
  requestId: number;
  image: Blob;
  depthOverlay?: Blob;
  repeatPixels: number;
  maximumShiftPixels: number;
}

export interface RenderFailure {
  type: "error";
  requestId: number;
  message: string;
}

export type RenderResponse = RenderProgress | RenderResult | RenderFailure;
