import type {
  GeneratorSettings,
  PatternMode,
  RenderRequest,
  RenderResponse,
} from "./types";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const MONOCHROME_LEVELS = [18, 48, 82, 118, 158, 202, 238] as const;
const COLOR_PALETTE = [
  [18, 22, 34],
  [49, 91, 255],
  [255, 89, 0],
  [234, 211, 84],
  [61, 176, 148],
  [194, 87, 143],
  [236, 233, 219],
] as const;

interface DepthMapRequest {
  width: number;
  height: number;
  source?: Blob;
  fit: GeneratorSettings["imageFit"];
  invert: boolean;
}

interface PatternStripRequest {
  width: number;
  height: number;
  source: Blob;
}

interface PixelGenerationRequest {
  width: number;
  height: number;
  repeatPixels: number;
  seedWidth: number;
  maximumShiftPixels: number;
  depthMap: Uint8Array;
  customPattern?: Uint8ClampedArray;
  settings: GeneratorSettings;
  requestId: number;
}
interface RandomColorRequest {
  mode: PatternMode;
  seed: number;
  x: number;
  y: number;
}

workerScope.onmessage = (event: MessageEvent<RenderRequest>) => {
  if (event.data.type !== "render") {
    return;
  }

  void renderStereogram(event.data).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "Rendering failed.";
    postResponse({
      type: "error",
      requestId: event.data.requestId,
      message,
    });
  });
};

async function renderStereogram(request: RenderRequest): Promise<void> {
  const { settings } = request;
  validateSettings(settings, request.purpose);

  const repeatPixels = Math.round(settings.dpi * settings.repeatInches);
  const maximumShiftPixels = Math.max(
    1,
    Math.round(repeatPixels * settings.depthStrength),
  );
  const seedWidth =
    settings.viewingMode === "cross-eyed"
      ? repeatPixels + maximumShiftPixels
      : repeatPixels;
  if (repeatPixels + maximumShiftPixels >= settings.width) {
    throw new Error("Pattern separation is too large for the output width.");
  }
  if (settings.patternMode === "custom" && !request.pattern) {
    throw new Error("Choose a pattern image or select a random pattern.");
  }

  postProgress(request.requestId, 2);
  const depthMap = await createDepthMap({
    width: settings.width,
    height: settings.height,
    source: request.depthMap,
    fit: settings.imageFit,
    invert: settings.invertDepth,
  });
  const depthOverlay =
    request.purpose === "preview"
      ? await createDepthOverlay(depthMap, settings.width, settings.height)
      : undefined;

  postProgress(request.requestId, 12);
  const customPattern =
    settings.patternMode === "custom" && request.pattern
      ? await createPatternStrip({
          width: repeatPixels,
          height: settings.height,
          source: request.pattern,
        })
      : undefined;

  postProgress(request.requestId, 18);
  const pixels = generatePixels({
    width: settings.width,
    height: settings.height,
    repeatPixels,
    maximumShiftPixels,
    seedWidth,
    depthMap,
    customPattern,
    settings,
    requestId: request.requestId,
  });

  const canvas = new OffscreenCanvas(settings.width, settings.height);
  const context = getCanvasContext(canvas);
  context.putImageData(
    new ImageData(pixels, settings.width, settings.height),
    0,
    0,
  );
  if (settings.guideDots) {
    drawGuideDots(context, settings, repeatPixels);
  }

  postProgress(request.requestId, 96);
  const image = await canvas.convertToBlob({ type: "image/png" });
  postResponse({
    type: "result",
    requestId: request.requestId,
    image,
    depthOverlay,
    repeatPixels,
    maximumShiftPixels,
  });
}

function validateSettings(
  settings: GeneratorSettings,
  purpose: RenderRequest["purpose"],
): void {
  const minimumDimension = purpose === "preview" ? 32 : 256;
  if (
    !Number.isInteger(settings.width) ||
    !Number.isInteger(settings.height) ||
    settings.width < minimumDimension ||
    settings.height < minimumDimension ||
    settings.width > 8000 ||
    settings.height > 8000
  ) {
    throw new Error(
      `Output dimensions must be whole pixels from ${minimumDimension} to 8000.`,
    );
  }
  const minimumDpi = purpose === "preview" ? 1 : 72;
  if (settings.dpi < minimumDpi || settings.dpi > 600) {
    throw new Error(`Resolution must be between ${minimumDpi} and 600 DPI.`);
  }
  if (settings.repeatInches < 0.5 || settings.repeatInches > 2.5) {
    throw new Error("Pattern separation must be between 0.5 and 2.5 inches.");
  }
  if (settings.depthStrength <= 0 || settings.depthStrength > 0.35) {
    throw new Error("Depth strength must be between 1% and 35%.");
  }
}

async function createDepthMap(request: DepthMapRequest): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(request.width, request.height);
  const context = getCanvasContext(canvas);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, request.width, request.height);

  if (request.source) {
    const bitmap = await createImageBitmap(request.source);
    drawFittedImage(context, bitmap, request);
    bitmap.close();
  } else {
    drawBuiltInShirtDepth(context, request.width, request.height);
  }

  const rgba = context.getImageData(0, 0, request.width, request.height).data;
  const depth = new Uint8Array(request.width * request.height);
  for (let pixel = 0; pixel < depth.length; pixel += 1) {
    const offset = pixel * 4;
    const luminance = Math.round(
      rgba[offset] * 0.299 +
        rgba[offset + 1] * 0.587 +
        rgba[offset + 2] * 0.114,
    );
    depth[pixel] = request.invert ? 255 - luminance : luminance;
  }
  return depth;
}

async function createDepthOverlay(
  depthMap: Uint8Array,
  width: number,
  height: number,
): Promise<Blob> {
  const pixels = new Uint8ClampedArray(depthMap.length * 4);
  for (let index = 0; index < depthMap.length; index += 1) {
    const offset = index * 4;
    pixels[offset] = 255;
    pixels[offset + 1] = 89;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = depthMap[index];
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = getCanvasContext(canvas);
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

function drawFittedImage(
  context: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  request: DepthMapRequest,
): void {
  const widthScale = request.width / bitmap.width;
  const heightScale = request.height / bitmap.height;
  const scale =
    request.fit === "cover"
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  const x = (request.width - width) / 2;
  const y = (request.height - height) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, x, y, width, height);
}

function drawBuiltInShirtDepth(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = context.createLinearGradient(0, height * 0.2, 0, height * 0.82);
  gradient.addColorStop(0, "rgb(214 214 214)");
  gradient.addColorStop(0.45, "rgb(248 248 248)");
  gradient.addColorStop(1, "rgb(224 224 224)");
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(width * 0.37, height * 0.23);
  context.lineTo(width * 0.23, height * 0.29);
  context.lineTo(width * 0.13, height * 0.43);
  context.lineTo(width * 0.27, height * 0.52);
  context.lineTo(width * 0.34, height * 0.46);
  context.lineTo(width * 0.34, height * 0.79);
  context.lineTo(width * 0.66, height * 0.79);
  context.lineTo(width * 0.66, height * 0.46);
  context.lineTo(width * 0.73, height * 0.52);
  context.lineTo(width * 0.87, height * 0.43);
  context.lineTo(width * 0.77, height * 0.29);
  context.lineTo(width * 0.63, height * 0.23);
  context.quadraticCurveTo(
    width * 0.58,
    height * 0.31,
    width * 0.5,
    height * 0.31,
  );
  context.quadraticCurveTo(
    width * 0.42,
    height * 0.31,
    width * 0.37,
    height * 0.23,
  );
  context.closePath();
  context.fill();
}

async function createPatternStrip(
  request: PatternStripRequest,
): Promise<Uint8ClampedArray> {
  const canvas = new OffscreenCanvas(request.width, request.height);
  const context = getCanvasContext(canvas);
  context.fillStyle = "#f4f3ee";
  context.fillRect(0, 0, request.width, request.height);

  const bitmap = await createImageBitmap(request.source);
  const scale = request.width / bitmap.width;
  const tileHeight = Math.max(1, bitmap.height * scale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (let y = 0; y < request.height; y += tileHeight) {
    context.drawImage(bitmap, 0, y, request.width, tileHeight);
  }
  bitmap.close();

  return context.getImageData(0, 0, request.width, request.height).data;
}

function generatePixels(
  request: PixelGenerationRequest,
): Uint8ClampedArray<ArrayBuffer> {
  const output = new Uint8ClampedArray(request.width * request.height * 4);
  const progressInterval = Math.max(1, Math.floor(request.height / 72));

  for (let y = 0; y < request.height; y += 1) {
    writeSeedStrip(output, y, request);
    writeEncodedRow(output, y, request);

    if (y % progressInterval === 0) {
      postProgress(
        request.requestId,
        18 + Math.round((y / request.height) * 76),
      );
    }
  }

  return output;
}

function writeSeedStrip(
  output: Uint8ClampedArray,
  y: number,
  request: PixelGenerationRequest,
): void {
  for (let x = 0; x < request.seedWidth; x += 1) {
    const outputOffset = (y * request.width + x) * 4;
    if (request.customPattern) {
      const patternX = x % request.repeatPixels;
      const patternOffset = (y * request.repeatPixels + patternX) * 4;
      output[outputOffset] = request.customPattern[patternOffset];
      output[outputOffset + 1] = request.customPattern[patternOffset + 1];
      output[outputOffset + 2] = request.customPattern[patternOffset + 2];
      output[outputOffset + 3] = 255;
      continue;
    }

    const blockX = Math.floor(x / request.settings.dotSize);
    const blockY = Math.floor(y / request.settings.dotSize);
    const color = getRandomPatternColor({
      mode: request.settings.patternMode,
      seed: request.settings.seed,
      x: blockX,
      y: blockY,
    });
    output[outputOffset] = color[0];
    output[outputOffset + 1] = color[1];
    output[outputOffset + 2] = color[2];
    output[outputOffset + 3] = 255;
  }
}

function writeEncodedRow(
  output: Uint8ClampedArray,
  y: number,
  request: PixelGenerationRequest,
): void {
  const rowOffset = y * request.width;
  const shiftDirection = request.settings.viewingMode === "cross-eyed" ? -1 : 1;
  for (let x = request.seedWidth; x < request.width; x += 1) {
    const depth = request.depthMap[rowOffset + x] / 255;
    const shift = Math.round(depth * request.maximumShiftPixels);
    const sourceX = x - request.repeatPixels + shiftDirection * shift;
    const sourceOffset = (rowOffset + sourceX) * 4;
    const outputOffset = (rowOffset + x) * 4;

    output[outputOffset] = output[sourceOffset];
    output[outputOffset + 1] = output[sourceOffset + 1];
    output[outputOffset + 2] = output[sourceOffset + 2];
    output[outputOffset + 3] = 255;
  }
}

function getRandomPatternColor(
  request: RandomColorRequest,
): readonly [number, number, number] {
  const hash = hashCoordinates(request.seed, request.x, request.y);
  if (request.mode === "color") {
    return COLOR_PALETTE[hash % COLOR_PALETTE.length];
  }

  const level = MONOCHROME_LEVELS[hash % MONOCHROME_LEVELS.length];
  return [level, level, level];
}

function hashCoordinates(seed: number, x: number, y: number): number {
  let hash =
    seed ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function drawGuideDots(
  context: OffscreenCanvasRenderingContext2D,
  settings: GeneratorSettings,
  repeatPixels: number,
): void {
  const radius = Math.max(4, Math.round(settings.dpi * 0.025));
  const centerX = settings.width / 2;
  const y = Math.max(radius * 2.5, settings.height * 0.025);
  context.fillStyle = "#ff3344";
  for (const x of [centerX - repeatPixels / 2, centerX + repeatPixels / 2]) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function getCanvasContext(
  canvas: OffscreenCanvas,
): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("This browser cannot create a 2D rendering context.");
  }
  return context;
}

function postProgress(requestId: number, progress: number): void {
  postResponse({ type: "progress", requestId, progress });
}

function postResponse(response: RenderResponse): void {
  workerScope.postMessage(response);
}
