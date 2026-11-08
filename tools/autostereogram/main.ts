import type {
  GeneratorSettings,
  ImageFit,
  PatternMode,
  RenderPurpose,
  RenderRequest,
  RenderResponse,
  ViewingMode,
} from "./types";

const PREVIEW_MAX_WIDTH = 1000;
const SETTINGS_STORAGE_KEY = "30shirts.autostereogram.settings";
const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_HEADER_LENGTH = 33;
const CRC_TABLE = createCrcTable();

const controls = getElement<HTMLFormElement>("controls");
const depthMapInput = getElement<HTMLInputElement>("depth-map");
const imageFitInput = getElement<HTMLSelectElement>("image-fit");
const invertDepthInput = getElement<HTMLInputElement>("invert-depth");
const patternModeInput = getElement<HTMLSelectElement>("pattern-mode");
const patternFileControl = getElement<HTMLElement>("pattern-file-control");
const patternFileInput = getElement<HTMLInputElement>("pattern-file");
const dotSizeInput = getElement<HTMLInputElement>("dot-size");
const seedInput = getElement<HTMLInputElement>("seed");
const viewingModeInput = getElement<HTMLSelectElement>("viewing-mode");
const widthInput = getElement<HTMLInputElement>("output-width");
const heightInput = getElement<HTMLInputElement>("output-height");
const dpiInput = getElement<HTMLInputElement>("dpi");
const repeatInchesInput = getElement<HTMLInputElement>("repeat-inches");
const depthStrengthInput = getElement<HTMLInputElement>("depth-strength");
const guideDotsInput = getElement<HTMLInputElement>("guide-dots");
const randomizeSeedButton = getElement<HTMLButtonElement>("randomize-seed");
const previewButton = getElement<HTMLButtonElement>("render-preview");
const exportButton = getElement<HTMLButtonElement>("export-png");
const printSummary = getElement<HTMLOutputElement>("print-summary");
const renderStats = getElement<HTMLOutputElement>("render-stats");
const previewPlaceholder = getElement<HTMLElement>("preview-placeholder");
const previewImage = getElement<HTMLImageElement>("preview-image");
const previewComposite = getElement<HTMLElement>("preview-composite");
const depthOverlayInput = getElement<HTMLInputElement>("show-depth-overlay");
const depthOverlayImage = getElement<HTMLImageElement>("depth-overlay-image");
const progress = getElement<HTMLProgressElement>("render-progress");
const status = getElement<HTMLOutputElement>("status");
const viewingHelp = getElement<HTMLElement>("viewing-help");

let activeWorker: Worker | undefined;
let activeRequestId = 0;
let previewUrl: string | undefined;
let depthOverlayUrl: string | undefined;

restoreSettings();
syncInterface();

controls.addEventListener("input", () => {
  persistSettings();
  syncInterface();
});
patternModeInput.addEventListener("change", syncInterface);
depthOverlayInput.addEventListener("input", () => {
  previewComposite.classList.toggle(
    "is-overlay-visible",
    depthOverlayInput.checked,
  );
});
randomizeSeedButton.addEventListener("click", () => {
  seedInput.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
  persistSettings();
});
previewButton.addEventListener("click", () => void startRender("preview"));
exportButton.addEventListener("click", () => void startRender("export"));
window.addEventListener("beforeunload", () => {
  activeWorker?.terminate();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
  if (depthOverlayUrl) {
    URL.revokeObjectURL(depthOverlayUrl);
  }
});

void startRender("preview");


async function startRender(kind: RenderPurpose): Promise<void> {
  try {
    if (!controls.checkValidity()) {
      controls.reportValidity();
      throw new Error("Correct the highlighted print settings before rendering.");
    }
    const outputSettings = readSettings();
    const settings =
      kind === "preview" ? createPreviewSettings(outputSettings) : outputSettings;
    const depthMap = depthMapInput.files?.[0];
    const pattern = patternFileInput.files?.[0];
    if (settings.patternMode === "custom" && !pattern) {
      throw new Error("Choose a pattern image before rendering.");
    }

    activeWorker?.terminate();
    activeRequestId += 1;
    const requestId = activeRequestId;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    activeWorker = worker;
    setBusy(true, kind === "preview" ? "Rendering preview" : "Rendering full PNG");

    worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      if (event.data.requestId !== requestId) {
        return;
      }
      if (event.data.type === "progress") {
        progress.value = event.data.progress;
        return;
      }
      if (event.data.type === "error") {
        finishWithError(event.data.message);
        worker.terminate();
        return;
      }

      void finishRender({
        kind,
        image: event.data.image,
        depthOverlay: event.data.depthOverlay,
        settings,
        outputSettings,
        repeatPixels: event.data.repeatPixels,
        maximumShiftPixels: event.data.maximumShiftPixels,
      })
        .catch((cause: unknown) => {
          finishWithError(
            cause instanceof Error ? cause.message : "Finishing the render failed.",
          );
        })
        .finally(() => worker.terminate());
    };
    worker.onerror = (event) => {
      finishWithError(event.message || "The render worker stopped unexpectedly.");
      worker.terminate();
    };

    const request: RenderRequest = {
      type: "render",
      purpose: kind,
      requestId,
      settings,
      depthMap,
      pattern: settings.patternMode === "custom" ? pattern : undefined,
    };
    worker.postMessage(request);
  } catch (cause: unknown) {
    finishWithError(cause instanceof Error ? cause.message : "Rendering failed.");
  }
}

interface FinishedRender {
  kind: RenderPurpose;
  image: Blob;
  depthOverlay?: Blob;
  settings: GeneratorSettings;
  outputSettings: GeneratorSettings;
  repeatPixels: number;
  maximumShiftPixels: number;
}

async function finishRender(render: FinishedRender): Promise<void> {
  progress.value = 100;
  renderStats.value = `${render.settings.width}×${render.settings.height} · repeat ${render.repeatPixels}px · shift ${render.maximumShiftPixels}px`;

  if (render.kind === "preview") {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (depthOverlayUrl) {
      URL.revokeObjectURL(depthOverlayUrl);
    }
    previewUrl = URL.createObjectURL(render.image);
    depthOverlayUrl = render.depthOverlay
      ? URL.createObjectURL(render.depthOverlay)
      : undefined;
    previewImage.src = previewUrl;
    depthOverlayImage.src = depthOverlayUrl ?? "";
    previewComposite.hidden = false;
    previewPlaceholder.hidden = true;
    previewComposite.classList.toggle(
      "is-overlay-visible",
      depthOverlayInput.checked && Boolean(depthOverlayUrl),
    );
    setBusy(false, "Preview ready");
    return;
  }

  setStatus("Embedding print resolution");
  const printableImage = await embedPngResolution(
    render.image,
    render.outputSettings.dpi,
  );
  downloadBlob(
    printableImage,
    `autostereogram-${render.outputSettings.width}x${render.outputSettings.height}-${render.outputSettings.seed}.png`,
  );
  setBusy(false, "PNG downloaded");
}

function readSettings(): GeneratorSettings {
  return {
    width: readInteger(widthInput, "Width"),
    height: readInteger(heightInput, "Height"),
    dpi: readNumber(dpiInput, "Resolution"),
    repeatInches: readNumber(repeatInchesInput, "Pattern separation"),
    depthStrength: readNumber(depthStrengthInput, "Depth strength") / 100,
    seed: readInteger(seedInput, "Seed") >>> 0,
    dotSize: readInteger(dotSizeInput, "Dot size"),
    patternMode: patternModeInput.value as PatternMode,
    viewingMode: viewingModeInput.value as ViewingMode,
    imageFit: imageFitInput.value as ImageFit,
    invertDepth: invertDepthInput.checked,
    guideDots: guideDotsInput.checked,
  };
}

function createPreviewSettings(settings: GeneratorSettings): GeneratorSettings {
  const scale = Math.min(
    1,
    PREVIEW_MAX_WIDTH / settings.width,
    PREVIEW_MAX_WIDTH / settings.height,
  );
  return {
    ...settings,
    width: Math.max(32, Math.round(settings.width * scale)),
    height: Math.max(32, Math.round(settings.height * scale)),
    dpi: settings.dpi * scale,
    dotSize: Math.max(1, Math.round(settings.dotSize * scale)),
  };
}

function readInteger(input: HTMLInputElement, label: string): number {
  const value = readNumber(input, label);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return value;
}

function readNumber(input: HTMLInputElement, label: string): number {
  const value = input.valueAsNumber;
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  if (!input.checkValidity()) {
    throw new Error(`${label} is outside its allowed range.`);
  }
  return value;
}

function syncInterface(): void {
  patternFileControl.classList.toggle(
    "is-hidden",
    patternModeInput.value !== "custom",
  );

  const width = widthInput.valueAsNumber;
  const height = heightInput.valueAsNumber;
  const dpi = dpiInput.valueAsNumber;
  const repeatInches = repeatInchesInput.valueAsNumber;
  if ([width, height, dpi, repeatInches].every(Number.isFinite) && dpi > 0) {
    const printWidth = width / dpi;
    const printHeight = height / dpi;
    const repeatPixels = Math.round(dpi * repeatInches);
    printSummary.value = `${printWidth.toFixed(1)} × ${printHeight.toFixed(1)} in · ${repeatPixels}px repeat · ${(width * height / 1_000_000).toFixed(1)} megapixels`;
  } else {
    printSummary.value = "Check the print settings.";
  }

  const isParallel = viewingModeInput.value === "parallel";
  viewingHelp.innerHTML = isParallel
    ? "<strong>Parallel viewing</strong><span>Relax your focus beyond the image until adjacent repeats merge.</span>"
    : "<strong>Cross-eyed viewing</strong><span>Converge in front of the image until adjacent repeats merge.</span>";
}

function persistSettings(): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(readSettings()));
  } catch {
    // Invalid in-progress fields and unavailable storage should not block editing.
  }
}

function restoreSettings(): void {
  const value = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!value) {
    return;
  }

  try {
    const settings = JSON.parse(value) as unknown;
    if (!isStoredSettings(settings)) {
      return;
    }
    widthInput.value = String(settings.width);
    heightInput.value = String(settings.height);
    dpiInput.value = String(settings.dpi);
    repeatInchesInput.value = String(settings.repeatInches);
    depthStrengthInput.value = String(settings.depthStrength * 100);
    seedInput.value = String(settings.seed);
    dotSizeInput.value = String(settings.dotSize);
    patternModeInput.value =
      settings.patternMode === "custom" ? "monochrome" : settings.patternMode;
    viewingModeInput.value = settings.viewingMode;
    imageFitInput.value = settings.imageFit;
    invertDepthInput.checked = settings.invertDepth;
    guideDotsInput.checked = settings.guideDots;
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }
}

function isStoredSettings(value: unknown): value is GeneratorSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const settings = value as Partial<GeneratorSettings>;
  return (
    typeof settings.width === "number" &&
    typeof settings.height === "number" &&
    typeof settings.dpi === "number" &&
    typeof settings.repeatInches === "number" &&
    typeof settings.depthStrength === "number" &&
    typeof settings.seed === "number" &&
    typeof settings.dotSize === "number" &&
    ["monochrome", "color", "custom"].includes(String(settings.patternMode)) &&
    ["parallel", "cross-eyed"].includes(String(settings.viewingMode)) &&
    ["contain", "cover"].includes(String(settings.imageFit)) &&
    typeof settings.invertDepth === "boolean" &&
    typeof settings.guideDots === "boolean"
  );
}

function setBusy(busy: boolean, message: string): void {
  previewButton.disabled = busy;
  exportButton.disabled = busy;
  randomizeSeedButton.disabled = busy;
  if (!busy) {
    activeWorker = undefined;
  }
  setStatus(message);
}

function setStatus(message: string): void {
  status.value = message;
  status.dataset.error = "false";
}

function finishWithError(message: string): void {
  progress.value = 0;
  setBusy(false, message);
  status.dataset.error = "true";
}

async function embedPngResolution(image: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  const hasPngSignature = PNG_SIGNATURE.every(
    (byte, index) => bytes[index] === byte,
  );
  if (!hasPngSignature || bytes.length < PNG_HEADER_LENGTH) {
    throw new Error("The renderer returned an invalid PNG.");
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  chunkView.setUint32(8, pixelsPerMeter);
  chunkView.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  chunkView.setUint32(17, calculateCrc32(chunk.subarray(4, 17)));

  return new Blob(
    [bytes.slice(0, PNG_HEADER_LENGTH), chunk, bytes.slice(PNG_HEADER_LENGTH)],
    { type: "image/png" },
  );
}


function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getElement<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing interface element #${id}.`);
  }
  return element as ElementType;
}
