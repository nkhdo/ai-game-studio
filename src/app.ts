import {
  checkHealth,
  commitSpriteUpload,
  createAnimation,
  deleteAnimation,
  deleteProject,
  discardSpriteUpload,
  generateSprite,
  generateMotionVideo,
  generateMovementFrames,
  getCurrentProject,
  getImageModels,
  getVideoModels,
  listProjects,
  loadProject,
  newProject,
  prepareSpriteUpload,
  removeStyleGuide,
  saveProject,
  saveSelection,
  type StyleGuideImageView,
  uploadStyleGuide,
  updateAnimation,
} from "./lib/api";
import { Store, createInitialState, hydrateFromView } from "./lib/state";
import {
  parseNavigation,
  stepName,
  stepNumber,
  withNavigation,
  type WorkflowStep,
} from "./lib/navigation";
import { composeSpritesheet, loadImage } from "./lib/spritesheet";
import {
  chevronIcon,
  folderIcon,
  frameIcon,
  plusIcon,
  saveIcon,
  sparkleIcon,
  trashIcon,
} from "./components/icons";

const EMPTY_PLACEHOLDER_SLOTS = 8;
const SELECTION_DEBOUNCE_MS = 700;
const MAX_STYLE_GUIDE_IMAGES = 3;

export function mountApp(root: HTMLElement) {
  const store = new Store(createInitialState());
  const initialNavigation = parseNavigation(new URL(window.location.href));
  let activeStep = initialNavigation.step ? stepNumber(initialNavigation.step) : 1;
  let lastView: import("./lib/api").ProjectView | null = null;
  let cleanUpdatedAt: string | null = null;
  let hasUnsavedInput = false;
  let applyingNavigation = false;
  root.innerHTML = renderShell();

  const toast = createToast(root);

  // ---- Refs ----
  const promptInput = root.querySelector<HTMLTextAreaElement>("#sprite-prompt")!;
  const generateModeBtn = root.querySelector<HTMLButtonElement>("#mode-generate")!;
  const uploadModeBtn = root.querySelector<HTMLButtonElement>("#mode-upload")!;
  const generatePanel = root.querySelector<HTMLDivElement>("#generate-panel")!;
  const uploadPanel = root.querySelector<HTMLDivElement>("#upload-panel")!;
  const uploadDropzone = root.querySelector<HTMLLabelElement>("#upload-dropzone")!;
  const uploadInput = root.querySelector<HTMLInputElement>("#sprite-upload")!;
  const spriteModelSelect = root.querySelector<HTMLSelectElement>("#sprite-model")!;
  const spritePaletteLockInput = root.querySelector<HTMLInputElement>("#sprite-palette-lock")!;
  const generateSpriteBtn = root.querySelector<HTMLButtonElement>("#btn-generate-sprite")!;
  const spritePreview = root.querySelector<HTMLDivElement>("#sprite-preview")!;
  const spriteCaption = root.querySelector<HTMLDivElement>("#sprite-caption")!;
  const spriteStatus = root.querySelector<HTMLDivElement>("#sprite-status")!;
  const apiKeyWarning = root.querySelector<HTMLDivElement>("#api-key-warning")!;
  const backgroundWarning = root.querySelector<HTMLDivElement>("#background-warning")!;
  const fillWarning = root.querySelector<HTMLDivElement>("#fill-warning")!;
  const targetSizeSelect = root.querySelector<HTMLSelectElement>("#target-size")!;
  const subjectFillSelect = root.querySelector<HTMLSelectElement>("#subject-fill")!;
  const colorCountSelect = root.querySelector<HTMLSelectElement>("#color-count")!;
  const imageSizeStrategy = root.querySelector<HTMLDivElement>("#image-size-strategy")!;
  const styleGuideDropzone = root.querySelector<HTMLLabelElement>("#style-guide-dropzone")!;
  const styleGuideInput = root.querySelector<HTMLInputElement>("#style-guide-input")!;
  const styleGuideCount = root.querySelector<HTMLSpanElement>("#style-guide-count")!;
  const styleGuideList = root.querySelector<HTMLDivElement>("#style-guide-list")!;
  const styleGuideNotice = root.querySelector<HTMLDivElement>("#style-guide-notice")!;
  const styleGuideStatus = root.querySelector<HTMLDivElement>("#style-guide-status")!;
  const styleGuidesInactive = root.querySelector<HTMLDivElement>("#style-guides-inactive")!;

  const motionInput = root.querySelector<HTMLTextAreaElement>("#motion-prompt")!;
  const motionModelSelect = root.querySelector<HTMLSelectElement>("#motion-model")!;
  const videoModelGuidance = root.querySelector<HTMLDivElement>("#video-model-guidance")!;
  const paletteLockInput = root.querySelector<HTMLInputElement>("#palette-lock")!;
  const hardAlphaEdgesInput = root.querySelector<HTMLInputElement>("#hard-alpha-edges")!;
  const paletteDiagnostics = root.querySelector<HTMLDivElement>("#palette-diagnostics")!;
  const generateVideoBtn = root.querySelector<HTMLButtonElement>("#btn-generate-video")!;
  const generateFramesBtn = root.querySelector<HTMLButtonElement>("#btn-generate-frames")!;
  const videoStatus = root.querySelector<HTMLDivElement>("#video-status")!;
  const videoSettingsNotice = root.querySelector<HTMLDivElement>("#video-settings-notice")!;
  const frameOptionsNotice = root.querySelector<HTMLDivElement>("#frame-options-notice")!;
  const framesGrid = root.querySelector<HTMLDivElement>("#frames-grid")!;
  const framesHeading = root.querySelector<HTMLDivElement>("#frames-heading")!;
  const selectAllFramesBtn = root.querySelector<HTMLButtonElement>("#btn-select-all-frames")!;
  const deselectAllFramesBtn = root.querySelector<HTMLButtonElement>("#btn-deselect-all-frames")!;
  const framesStatus = root.querySelector<HTMLDivElement>("#frames-status")!;
  const motionVideoPreview = root.querySelector<HTMLDivElement>("#motion-video-preview")!;
  const quickPreviewStage = root.querySelector<HTMLDivElement>("#quick-preview-stage")!;
  const quickPreviewCount = root.querySelector<HTMLSpanElement>("#quick-preview-count")!;
  const quickPreviewPosition = root.querySelector<HTMLSpanElement>("#quick-preview-position")!;
  const quickPreviewToggle = root.querySelector<HTMLButtonElement>("#btn-toggle-preview")!;
  const zoomOutBtn = root.querySelector<HTMLButtonElement>("#btn-preview-zoom-out")!;
  const zoomResetBtn = root.querySelector<HTMLButtonElement>("#btn-preview-zoom-reset")!;
  const zoomInBtn = root.querySelector<HTMLButtonElement>("#btn-preview-zoom-in")!;
  const animationNameInput = root.querySelector<HTMLInputElement>("#animation-name")!;
  const animationFpsInput = root.querySelector<HTMLInputElement>("#animation-fps")!;
  const saveAnimationBtn = root.querySelector<HTMLButtonElement>("#btn-save-animation")!;
  const updateAnimationBtn = root.querySelector<HTMLButtonElement>("#btn-update-animation")!;
  const newAnimationBtn = root.querySelector<HTMLButtonElement>("#btn-new-animation")!;
  const animationsList = root.querySelector<HTMLDivElement>("#animations-list")!;
  const animationStatus = root.querySelector<HTMLDivElement>("#animation-status")!;

  const projectLabel = root.querySelector<HTMLSpanElement>("#project-label")!;
  const newBtn = root.querySelector<HTMLButtonElement>("#btn-new-project")!;
  const saveBtn = root.querySelector<HTMLButtonElement>("#btn-save-project")!;
  const loadBtn = root.querySelector<HTMLButtonElement>("#btn-load-project")!;
  const loadMenu = root.querySelector<HTMLDivElement>("#load-menu")!;
  const accordionItems = [
    ...root.querySelectorAll<HTMLElement>("[data-accordion-step]"),
  ];

  function writeNavigation(
    mode: "push" | "replace",
    project: string | null,
    step: WorkflowStep = stepName(activeStep),
  ) {
    const next = withNavigation(new URL(window.location.href), {
      project,
      step,
      animation: store.get().activeAnimationId,
    });
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", next);
  }

  function openAccordionStep(step: number, syncUrl = true) {
    activeStep = step;
    for (const item of accordionItems) {
      const isOpen = Number(item.dataset.accordionStep) === step;
      item.classList.toggle("is-open", isOpen);
      item.querySelector<HTMLButtonElement>(".accordion-trigger")
        ?.setAttribute("aria-expanded", String(isOpen));
    }
    if (syncUrl) {
      const name = store.get().currentProjectName;
      writeNavigation("replace", name === "latest" ? null : name);
    }
  }

  for (const item of accordionItems) {
    item.querySelector<HTMLButtonElement>(".accordion-trigger")?.addEventListener("click", () => {
      openAccordionStep(Number(item.dataset.accordionStep));
    });
  }

  // ---- Event handlers ----
  promptInput.addEventListener("input", () => {
    hasUnsavedInput = true;
    store.set({ spritePrompt: promptInput.value });
  });

  spriteModelSelect.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ spriteModel: spriteModelSelect.value });
  });

  spritePaletteLockInput.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ spritePaletteLock: spritePaletteLockInput.checked });
  });

  generateModeBtn.addEventListener("click", () => {
    store.set({ spriteAcquisitionMode: "generate" });
  });

  uploadModeBtn.addEventListener("click", () => {
    store.set({ spriteAcquisitionMode: "upload" });
  });

  targetSizeSelect.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ frameSize: Number(targetSizeSelect.value) });
  });

  subjectFillSelect.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ subjectFillPct: Number(subjectFillSelect.value) });
  });

  colorCountSelect.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({
      colorCount: colorCountSelect.value === "off" ? null : Number(colorCountSelect.value),
    });
  });

  styleGuideInput.addEventListener("change", () => {
    const files = [...(styleGuideInput.files ?? [])];
    if (files.length > 0) void uploadStyleGuideFiles(files);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    styleGuideDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (!styleGuideInput.disabled) styleGuideDropzone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    styleGuideDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      styleGuideDropzone.classList.remove("is-dragging");
    });
  }
  styleGuideDropzone.addEventListener("drop", (event) => {
    if (styleGuideInput.disabled) return;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length > 0) void uploadStyleGuideFiles(files);
  });

  async function uploadStyleGuideFiles(files: File[]) {
    const available = MAX_STYLE_GUIDE_IMAGES - store.get().styleGuides.length;
    if (files.length > available) {
      setStatus(
        styleGuideStatus,
        `Choose ${available} or fewer images (${MAX_STYLE_GUIDE_IMAGES} maximum).`,
        "error",
      );
      styleGuideInput.value = "";
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setStatus(
          styleGuideStatus,
          `Style Guide Image '${escapeHtml(file.name)}' is too large (maximum 10 MB).`,
          "error",
        );
        styleGuideInput.value = "";
        return;
      }
      if (
        file.type &&
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setStatus(
          styleGuideStatus,
          `Style Guide Image '${escapeHtml(file.name)}' must be PNG, JPEG, or WebP.`,
          "error",
        );
        styleGuideInput.value = "";
        return;
      }
    }

    store.set({ status: "uploading-style-guide", errorMessage: null });
    setStatus(styleGuideStatus, `${spinner()}Adding Style Guide Images…`);
    try {
      for (const file of files) {
        applyView(await uploadStyleGuide(file));
      }
      setStatus(
        styleGuideStatus,
        `${files.length} Style Guide Image${files.length === 1 ? "" : "s"} added.`,
        "success",
      );
      toast("Style guides updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add Style Guide Image";
      setStatus(styleGuideStatus, escapeHtml(message), "error");
    } finally {
      store.set({ status: "idle" });
      styleGuideInput.value = "";
    }
  }

  styleGuideList.addEventListener("click", async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-remove-style-guide]",
    );
    if (!target) return;
    store.set({ status: "uploading-style-guide", errorMessage: null });
    setStatus(styleGuideStatus, `${spinner()}Removing Style Guide Image…`);
    try {
      applyView(await removeStyleGuide(target.dataset.removeStyleGuide!));
      setStatus(styleGuideStatus, "Style Guide Image removed.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove Style Guide Image";
      setStatus(styleGuideStatus, escapeHtml(message), "error");
    } finally {
      store.set({ status: "idle" });
    }
  });

  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    if (file) void uploadReferenceSprite(file);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    uploadDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadDropzone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    uploadDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadDropzone.classList.remove("is-dragging");
    });
  }
  uploadDropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files[0];
    if (file) void uploadReferenceSprite(file);
  });

  async function uploadReferenceSprite(file: File) {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (file.size > 10 * 1024 * 1024) {
      setStatus(spriteStatus, "Image is too large (maximum 10 MB).", "error");
      uploadInput.value = "";
      return;
    }
    if (file.type && !allowedTypes.has(file.type)) {
      setStatus(spriteStatus, "Use a PNG, JPEG, or WebP image.", "error");
      uploadInput.value = "";
      return;
    }

    const promptDraft = store.get().spritePrompt;
    const geometry = {
      frameSize: store.get().frameSize,
      subjectFillPct: store.get().subjectFillPct,
      colorCount: store.get().colorCount,
    };
    store.set({ status: "uploading-image", errorMessage: null });
    setStatus(spriteStatus, `${spinner()}Preparing reference sprite…`);
    try {
      const prepared = await prepareSpriteUpload(file, geometry);
      if (
        prepared.requiresConfirmation &&
        !window.confirm(
          "Replace the Reference Sprite? Existing video, Movement Frames, and saved Animations will be removed.",
        )
      ) {
        await discardSpriteUpload();
        store.set({ status: "idle" });
        setStatus(spriteStatus, "Upload cancelled.");
        return;
      }
      const view = await commitSpriteUpload(prepared.uploadId);
      lastView = view;
      hasUnsavedInput = true;
      frozenDraftFrames = null;
      animationNameInput.value = "";
      const patch = hydrateFromView(view);
      store.set({ ...patch, activeAnimationId: null, spritePrompt: promptDraft, status: "idle", errorMessage: null });
      promptInput.value = promptDraft;
      motionInput.value = view.motionPrompt;
      setStatus(spriteStatus, "Reference sprite uploaded.", "success");
      setStatus(videoStatus, "");
      setStatus(framesStatus, "");
      toast("Reference sprite uploaded");
      openAccordionStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload image";
      store.set({ status: "error", errorMessage: message });
      setStatus(spriteStatus, message, "error");
    } finally {
      uploadInput.value = "";
    }
  }

  motionInput.addEventListener("input", () => {
    hasUnsavedInput = true;
    store.set({ motionPrompt: motionInput.value });
  });

  motionModelSelect.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ motionModel: motionModelSelect.value });
  });
  paletteLockInput.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ paletteLock: paletteLockInput.checked });
  });
  hardAlphaEdgesInput.addEventListener("change", () => {
    hasUnsavedInput = true;
    store.set({ hardAlphaEdges: hardAlphaEdgesInput.checked });
  });

  generateSpriteBtn.addEventListener("click", async () => {
    const prompt = store.get().spritePrompt.trim();
    if (!prompt) {
      setStatus(spriteStatus, "Enter a sprite prompt first.", "error");
      return;
    }
    if (
      store.get().animations.length > 0 &&
      !window.confirm("Replace the Reference Sprite? All saved Animations will be removed.")
    ) return;
    store.set({ status: "generating-image", errorMessage: null });
    setStatus(spriteStatus, `${spinner()}Generating reference sprite…`);
    try {
      const state = store.get();
      const result = await generateSprite(prompt, state.spriteModel, {
        frameSize: state.frameSize,
        subjectFillPct: state.subjectFillPct,
        colorCount: state.colorCount,
      }, state.spritePaletteLock);
      lastView = result.view;
      hasUnsavedInput = true;
      frozenDraftFrames = null;
      animationNameInput.value = "";
      const img = await loadImage(result.dataUrl);
      const patch = hydrateFromView(result.view);
      store.set({
        ...patch,
        activeAnimationId: null,
        status: "idle",
        errorMessage: null,
        spriteSrc: result.dataUrl,
        spriteDimensions: { w: img.naturalWidth, h: img.naturalHeight },
      });
      setStatus(spriteStatus, "Reference sprite ready.", "success");
      setStatus(videoStatus, "");
      setStatus(framesStatus, "");
      toast("Reference sprite generated");
      openAccordionStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate sprite";
      store.set({ status: "error", errorMessage: message });
      setStatus(spriteStatus, message, "error");
    }
  });

  generateVideoBtn.addEventListener("click", async () => {
    const state = store.get();
    if (!state.spriteSrc) {
      setStatus(videoStatus, "Generate a reference sprite first.", "error");
      return;
    }
    const text = state.motionPrompt.trim();
    if (!text) {
      setStatus(videoStatus, "Enter a movement prompt first.", "error");
      return;
    }
    if (
      (state.frames.length > 0 || state.spritesheetSrc) &&
      !window.confirm(
        "Generate a new video? Existing frames, frame selection, spritesheet, and preview will be removed after the new video succeeds.",
      )
    ) {
      return;
    }
    store.set({ status: "generating-video", errorMessage: null });
    const selectedModel = state.videoModels.find((model) => model.id === state.motionModel);
    const appliedSize = state.appliedFrameSize;
    const minimum = Math.max(
      selectedModel?.minInputWidth ?? 0,
      selectedModel?.minInputHeight ?? 0,
    );
    const multiplier = appliedSize && minimum > appliedSize
      ? Math.ceil(minimum / appliedSize)
      : 1;
    const submittedSize = appliedSize ? appliedSize * multiplier : null;
    setStatus(
      videoStatus,
      appliedSize && submittedSize && submittedSize !== appliedSize
        ? `${spinner()}Preparing ${selectedModel?.label ?? "video"} input: ${appliedSize} × ${appliedSize} → ${submittedSize} × ${submittedSize}…`
        : `${spinner()}Generating motion video…`,
    );
    try {
      const view = await generateMotionVideo(text, state.motionModel);
      lastView = view;
      hasUnsavedInput = true;
      frozenDraftFrames = null;
      animationNameInput.value = "";
      store.set({ ...hydrateFromView(view), activeAnimationId: null, status: "done", errorMessage: null });
      setStatus(videoStatus, "Video ready — choose frame options in step 2.2.", "success");
      setStatus(framesStatus, "Choose frame options, then generate frames.");
      toast("Movement video generated");
      openAccordionStep(3);
      generateFramesBtn.focus({ preventScroll: true });
      generateFramesBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate video";
      store.set({ status: "error", errorMessage: message });
      setStatus(videoStatus, message, "error");
    }
  });

  generateFramesBtn.addEventListener("click", async () => {
    const state = store.get();
    if (!state.motionVideoSrc) {
      setStatus(framesStatus, "Generate a video in step 2.1 first.", "error");
      return;
    }
    store.set({ status: "extracting-frames", errorMessage: null });
    setStatus(framesStatus, `${spinner()}Generating frames from the video…`);
    try {
      const view = await generateMovementFrames(state.paletteLock, state.hardAlphaEdges);
      lastView = view;
      hasUnsavedInput = true;
      frozenDraftFrames = null;
      animationNameInput.value = "";
      const patch = hydrateFromView(view);
      store.set({ ...patch, activeAnimationId: null, status: "done", errorMessage: null });
      setStatus(framesStatus, `Generated ${view.frames.length} frames.`, "success");
      toast("Frames generated");
      framesHeading.focus({ preventScroll: true });
      framesHeading.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate frames";
      store.set({ status: "error", errorMessage: message });
      setStatus(framesStatus, message, "error");
    }
  });

  framesGrid.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const tile = target.closest<HTMLElement>(".frame-tile");
    if (!tile) return;
    const idxStr = tile.dataset.index;
    if (idxStr === undefined) return;
    const index = Number(idxStr);
    const state = store.get();
    if (index >= state.frames.length) return;
    const next = new Set(state.selectedFrameIndices);
    frozenDraftFrames = null;
    if (next.has(index)) next.delete(index);
    else next.add(index);
    hasUnsavedInput = true;
    store.set({ selectedFrameIndices: next });
    scheduleSelectionPersist();
  });

  selectAllFramesBtn.addEventListener("click", () => {
    const state = store.get();
    if (state.frames.length === 0) return;
    hasUnsavedInput = true;
    frozenDraftFrames = null;
    store.set({
      selectedFrameIndices: new Set(state.frames.map((_, i) => i)),
    });
    scheduleSelectionPersist();
  });

  deselectAllFramesBtn.addEventListener("click", () => {
    if (store.get().selectedFrameIndices.size === 0) return;
    hasUnsavedInput = true;
    frozenDraftFrames = null;
    store.set({ selectedFrameIndices: new Set<number>() });
    scheduleSelectionPersist();
  });

  let quickPreviewTimer: number | undefined;
  let quickPreviewKey = "";
  let quickPreviewPlaying = false;
  let quickPreviewZoom = 1;
  let frozenDraftFrames: string[] | null = null;
  quickPreviewToggle.textContent = quickPreviewPlaying ? "Pause" : "Play";

  function currentDraftIndices() {
    if (frozenDraftFrames && store.get().activeAnimationId) {
      const active = store.get().animations.find(
        (animation) => animation.id === store.get().activeAnimationId,
      );
      if (active) return [...active.frameIndices];
    }
    return [...store.get().selectedFrameIndices].sort((a, b) => a - b);
  }

  function currentDraftFrames() {
    if (frozenDraftFrames) return frozenDraftFrames;
    const state = store.get();
    return currentDraftIndices().flatMap((index) => state.frames[index] ? [state.frames[index]] : []);
  }

  function renderQuickPreview() {
    const state = store.get();
    const frames = currentDraftFrames();
    quickPreviewCount.textContent = `${frames.length} frame${frames.length === 1 ? "" : "s"}`;
    const key = `${frames.join("|")}|${state.animationFps}|${quickPreviewPlaying}`;
    if (key === quickPreviewKey) return;
    quickPreviewKey = key;
    if (quickPreviewTimer) window.clearInterval(quickPreviewTimer);
    quickPreviewTimer = undefined;
    if (frames.length === 0) {
      quickPreviewPosition.textContent = "0 / 0";
      quickPreviewStage.innerHTML = '<span class="gif-preview__placeholder">Select frames to preview immediately</span>';
      return;
    }
    quickPreviewPosition.textContent = `1 / ${frames.length}`;
    quickPreviewStage.innerHTML = `<img src="${escapeAttr(frames[0])}" alt="Quick animation preview" />`;
    applyQuickPreviewZoom();
    if (!quickPreviewPlaying || frames.length === 1) return;
    let index = 0;
    quickPreviewTimer = window.setInterval(() => {
      index = (index + 1) % frames.length;
      const image = quickPreviewStage.querySelector<HTMLImageElement>("img");
      if (image) image.src = frames[index];
      quickPreviewPosition.textContent = `${index + 1} / ${frames.length}`;
    }, Math.max(16, Math.round(1000 / state.animationFps)));
  }

  quickPreviewToggle.addEventListener("click", () => {
    quickPreviewPlaying = !quickPreviewPlaying;
    quickPreviewToggle.textContent = quickPreviewPlaying ? "Pause" : "Play";
    quickPreviewKey = "";
    renderQuickPreview();
  });

  function applyQuickPreviewZoom() {
    const image = quickPreviewStage.querySelector<HTMLImageElement>("img");
    if (image) image.style.transform = `scale(${quickPreviewZoom})`;
    zoomResetBtn.textContent = `${Math.round(quickPreviewZoom * 100)}%`;
    zoomOutBtn.disabled = quickPreviewZoom <= 0.5;
    zoomInBtn.disabled = quickPreviewZoom >= 4;
  }

  zoomOutBtn.addEventListener("click", () => {
    quickPreviewZoom = Math.max(0.5, quickPreviewZoom - 0.25);
    applyQuickPreviewZoom();
  });
  zoomResetBtn.addEventListener("click", () => {
    quickPreviewZoom = 1;
    applyQuickPreviewZoom();
  });
  zoomInBtn.addEventListener("click", () => {
    quickPreviewZoom = Math.min(4, quickPreviewZoom + 0.25);
    applyQuickPreviewZoom();
  });

  animationFpsInput.addEventListener("change", () => {
    const fps = Math.max(1, Math.min(60, Math.round(Number(animationFpsInput.value) || 12)));
    animationFpsInput.value = String(fps);
    hasUnsavedInput = true;
    store.set({ animationFps: fps });
  });

  function activateAnimation(id: string | null, syncUrl = true) {
    const animation = id
      ? store.get().animations.find((candidate) => candidate.id === id)
      : undefined;
    if (!animation) {
      frozenDraftFrames = null;
      animationNameInput.value = "";
      store.set({ activeAnimationId: null, spritesheetSrc: null, previewGifSrc: null });
    } else {
      frozenDraftFrames = animation.frameUrls;
      animationNameInput.value = animation.name;
      animationFpsInput.value = String(animation.fps);
      store.set({
        activeAnimationId: animation.id,
        animationFps: animation.fps,
        selectedFrameIndices: new Set(animation.frameIndices),
        spritesheetSrc: animation.spritesheetUrl,
        spritesheetCols: animation.frameUrls.length,
        previewGifSrc: animation.previewGifUrl,
      });
    }
    quickPreviewKey = "";
    renderQuickPreview();
    if (syncUrl) {
      const project = store.get().currentProjectName;
      writeNavigation("replace", project === "latest" ? null : project);
    }
  }

  newAnimationBtn.addEventListener("click", () => {
    activateAnimation(null);
  });

  async function persistAnimation(mode: "create" | "update") {
    const state = store.get();
    const name = animationNameInput.value.trim();
    if (!name) {
      setStatus(animationStatus, "Enter an Animation name.", "error");
      return;
    }
    const indices = currentDraftIndices();
    const frames = currentDraftFrames();
    if (frames.length === 0) {
      setStatus(animationStatus, "Select at least one frame.", "error");
      return;
    }
    try {
      setStatus(animationStatus, `${spinner()}Saving Animation…`);
      const sheet = await composeSpritesheet({
        frameSrcs: frames,
        cellSize: state.appliedFrameSize ?? state.frameSize,
      });
      const view = mode === "create"
        ? await createAnimation({
            name,
            frameIndices: indices,
            fps: state.animationFps,
            dataUrl: sheet.dataUrl,
            sourceAnimationId: frozenDraftFrames ? state.activeAnimationId ?? undefined : undefined,
          })
        : await updateAnimation(state.activeAnimationId!, {
            name,
            frameIndices: indices,
            fps: state.animationFps,
            dataUrl: sheet.dataUrl,
            sourceAnimationId: frozenDraftFrames ? state.activeAnimationId ?? undefined : undefined,
          });
      lastView = view;
      const animations = hydrateFromView(view).animations ?? [];
      const saved = mode === "create"
        ? animations.find((animation) => animation.name.toLocaleLowerCase() === name.toLocaleLowerCase())
        : animations.find((animation) => animation.id === state.activeAnimationId);
      frozenDraftFrames = saved?.frameUrls ?? null;
      store.set({
        animations,
        activeAnimationId: saved?.id ?? null,
        spritesheetSrc: saved?.spritesheetUrl ?? sheet.dataUrl,
        spritesheetCols: frames.length,
        previewGifSrc: saved?.previewGifUrl ?? null,
      });
      const project = store.get().currentProjectName;
      writeNavigation("replace", project === "latest" ? null : project);
      hasUnsavedInput = true;
      setStatus(animationStatus, `Animation '${escapeHtml(name)}' saved.`, "success");
      toast(`Saved Animation '${name}'`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Animation save failed";
      setStatus(animationStatus, escapeHtml(message), "error");
    }
  }

  saveAnimationBtn.addEventListener("click", () => void persistAnimation("create"));
  updateAnimationBtn.addEventListener("click", () => void persistAnimation("update"));

  animationsList.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-animation-id]");
    if (!row) return;
    const animation = store.get().animations.find((candidate) => candidate.id === row.dataset.animationId);
    if (!animation) return;
    if (target.closest("[data-animation-delete]")) {
      if (!window.confirm(`Delete Animation '${animation.name}'?`)) return;
      try {
        const view = await deleteAnimation(animation.id);
        lastView = view;
        const animations = hydrateFromView(view).animations ?? [];
        const wasActive = store.get().activeAnimationId === animation.id;
        if (wasActive) {
          frozenDraftFrames = null;
          animationNameInput.value = "";
        }
        store.set({
          animations,
          activeAnimationId: wasActive ? null : store.get().activeAnimationId,
          spritesheetSrc: wasActive ? null : store.get().spritesheetSrc,
          previewGifSrc: wasActive ? null : store.get().previewGifSrc,
        });
        const project = store.get().currentProjectName;
        writeNavigation("replace", project === "latest" ? null : project);
        hasUnsavedInput = true;
        toast(`Deleted Animation '${animation.name}'`);
      } catch (err) {
        setStatus(animationStatus, escapeHtml(err instanceof Error ? err.message : "Delete failed"), "error");
      }
      return;
    }
    if (target.closest("[data-animation-export]")) {
      const link = document.createElement("a");
      link.href = animation.spritesheetUrl;
      link.download = `${animation.name}.png`;
      link.click();
      return;
    }
    activateAnimation(animation.id);
  });

  // ---- New / Save / Load wiring ----
  function hasMeaningfulWork() {
    const state = store.get();
    return state.spriteSrc !== null ||
      state.frames.length > 0 ||
      state.spritePrompt.trim().length > 0 ||
      state.styleGuides.length > 0 ||
      state.motionPrompt.trim().length > 0;
  }

  function isDirty() {
    if (hasUnsavedInput) return true;
    const state = store.get();
    if (state.currentProjectName === "latest") return hasMeaningfulWork();
    return lastView !== null && lastView.updatedAt !== cleanUpdatedAt;
  }

  function confirmDiscard() {
    return !isDirty() || window.confirm(
      "Discard unsaved changes and switch projects? Unsaved work will be lost.",
    );
  }

  newBtn.addEventListener("click", async () => {
    if (!confirmDiscard()) return;
    try {
      const view = await newProject();
      applyView(view);
      frozenDraftFrames = null;
      animationNameInput.value = "";
      store.set({ activeAnimationId: null });
      cleanUpdatedAt = null;
      hasUnsavedInput = false;
      openAccordionStep(1, false);
      writeNavigation("push", null);
      setStatus(spriteStatus, "", "info");
      setStatus(videoStatus, "", "info");
      setStatus(framesStatus, "", "info");
      toast("Started a new project");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start new project";
      toast(message);
    }
  });

  saveBtn.addEventListener("click", async () => {
    const suggested = store.get().currentProjectName === "latest" ? "" : store.get().currentProjectName;
    const raw = window.prompt(
      "Save project as (letters, numbers, hyphen, underscore — max 40 chars):",
      suggested,
    );
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;

    const existing = store.get().savedProjects.find((p) => p.name === name);
    if (existing && !window.confirm(`Project '${name}' exists. Overwrite?`)) {
      return;
    }

    try {
      const view = await saveProject(name);
      applyView(view);
      cleanUpdatedAt = view.updatedAt;
      hasUnsavedInput = false;
      store.set({
        savedProjects: await listProjects(),
      });
      writeNavigation("replace", view.name);
      toast(`Saved as '${name}'`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast(message);
    }
  });

  loadBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const open = loadMenu.classList.toggle("is-open");
    if (open) {
      try {
        const projects = await listProjects();
        store.set({ savedProjects: projects });
      } catch (err) {
        console.warn("[client] listProjects failed", err);
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!loadMenu.contains(e.target as Node) && e.target !== loadBtn) {
      loadMenu.classList.remove("is-open");
    }
  });

  loadMenu.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest<HTMLElement>("[data-load-name]");
    const del = target.closest<HTMLElement>("[data-delete-name]");

    if (del) {
      e.stopPropagation();
      const name = del.dataset.deleteName!;
      if (!window.confirm(`Delete saved project '${name}'? This can't be undone.`)) return;
      try {
        await deleteProject(name);
        store.set({ savedProjects: await listProjects() });
        if (store.get().currentProjectName === name) {
          store.set({ currentProjectName: "latest" });
          cleanUpdatedAt = null;
          hasUnsavedInput = true;
          writeNavigation("replace", null);
        }
        toast(`Deleted '${name}'`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        toast(message);
      }
      return;
    }

    if (item) {
      const name = item.dataset.loadName!;
      loadMenu.classList.remove("is-open");
      if (!confirmDiscard()) return;
      try {
        const view = await loadProject(name);
        applyView(view);
        frozenDraftFrames = null;
        animationNameInput.value = "";
        store.set({ activeAnimationId: null });
        cleanUpdatedAt = view.updatedAt;
        hasUnsavedInput = false;
        openAccordionStep(view.sourceVideoUrl ? 3 : view.spriteUrl ? 2 : 1, false);
        writeNavigation("push", name);
        toast(`Loaded '${name}'`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Load failed";
        toast(message);
      }
    }
  });

  // ---- Debounced selection persistence ----
  let selectionTimer: number | undefined;
  function scheduleSelectionPersist() {
    if (selectionTimer) window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(() => {
      const indices = [...store.get().selectedFrameIndices].sort((a, b) => a - b);
      saveSelection(indices).catch((err) => {
        console.warn("[client] failed to persist selection", err);
      });
    }, SELECTION_DEBOUNCE_MS);
  }

  // ---- Apply a server view into local state ----
  function applyView(view: import("./lib/api").ProjectView) {
    lastView = view;
    const patch = hydrateFromView(view);
    if (
      store.get().activeAnimationId &&
      !view.animations.some((animation) => animation.id === store.get().activeAnimationId)
    ) {
      patch.activeAnimationId = null;
      frozenDraftFrames = null;
      animationNameInput.value = "";
    }
    store.set(patch);
    promptInput.value = view.spritePrompt;
    motionInput.value = view.motionPrompt;
    setStatus(videoStatus, "");
    setStatus(framesStatus, "");
  }

  let lastImageModelOptionsKey = "";
  let lastVideoModelOptionsKey = "";
  let renderedMotionVideoSrc: string | null | undefined;

  // ---- Render reactivity ----
  store.subscribe((state) => {
    const busy =
      state.status === "generating-image" ||
      state.status === "uploading-style-guide" ||
      state.status === "uploading-image" ||
      state.status === "generating-video" ||
      state.status === "extracting-frames";

    const selectedImageModel = state.imageModels.find(
      (model) => model.id === state.spriteModel,
    );
    const selectedVideoModel = state.videoModels.find(
      (model) => model.id === state.motionModel,
    );
    const generateMode = state.spriteAcquisitionMode === "generate";
    const styleGuideLimit = Math.min(
      MAX_STYLE_GUIDE_IMAGES,
      selectedImageModel?.maxStyleGuideImages ?? 0,
    );
    const incompatibleStyleGuides =
      state.styleGuides.length > 0 && state.styleGuides.length > styleGuideLimit;

    imageSizeStrategy.hidden = !generateMode || !selectedImageModel;
    if (selectedImageModel) {
      imageSizeStrategy.textContent =
        selectedImageModel.sizeStrategy === "target-size"
          ? `Generated directly at ${state.frameSize} × ${state.frameSize}.`
          : `Generated at the model's native size, optimized and resized to ${state.frameSize} × ${state.frameSize}.`;
    }
    if (selectedVideoModel) {
      const mode = selectedVideoModel.inputMode === "first-frame"
        ? "Exact first frame"
        : "Reference guidance";
      const constraints = [
        selectedVideoModel.minInputWidth
          ? `${selectedVideoModel.minInputWidth} px minimum width`
          : null,
        selectedVideoModel.minInputHeight
          ? `${selectedVideoModel.minInputHeight} px minimum height`
          : null,
      ].filter(Boolean);
      videoModelGuidance.textContent = constraints.length > 0
        ? `${mode} · ${constraints.join(" · ")} · smaller inputs are enlarged`
        : mode;
    } else {
      videoModelGuidance.textContent = "";
    }

    generateSpriteBtn.disabled = busy || !state.hasApiKey || incompatibleStyleGuides;
    generateModeBtn.disabled = busy;
    uploadModeBtn.disabled = busy;
    uploadInput.disabled = busy;
    styleGuideInput.disabled = busy || state.styleGuides.length >= styleGuideLimit;
    styleGuideDropzone.classList.toggle("is-disabled", styleGuideInput.disabled);
    styleGuideDropzone.setAttribute("aria-disabled", String(styleGuideInput.disabled));
    targetSizeSelect.disabled = busy;
    subjectFillSelect.disabled = busy;
    colorCountSelect.disabled = busy;
    generateVideoBtn.disabled = busy || !state.spriteSrc || !state.hasApiKey;
    generateFramesBtn.disabled = busy || !state.motionVideoSrc;
    const extractionOptionsChanged =
      state.paletteLock !== state.appliedPaletteLock ||
      state.hardAlphaEdges !== state.appliedHardAlphaEdges;
    selectAllFramesBtn.disabled =
      busy || state.selectedFrameIndices.size === state.frames.length;
    deselectAllFramesBtn.disabled = busy || state.selectedFrameIndices.size === 0;
    saveAnimationBtn.disabled = busy || state.selectedFrameIndices.size === 0;
    updateAnimationBtn.disabled = busy || !state.activeAnimationId;
    newAnimationBtn.disabled = busy;
    newBtn.disabled = busy;
    saveBtn.disabled = busy;
    loadBtn.disabled = busy;

    generatePanel.hidden = !generateMode;
    uploadPanel.hidden = generateMode;
    generateModeBtn.classList.toggle("is-active", generateMode);
    uploadModeBtn.classList.toggle("is-active", !generateMode);
    generateModeBtn.setAttribute("aria-pressed", String(generateMode));
    uploadModeBtn.setAttribute("aria-pressed", String(!generateMode));
    apiKeyWarning.hidden = state.hasApiKey || !generateMode;
    spritePaletteLockInput.disabled = busy || state.styleGuides.length === 0;
    spritePaletteLockInput.checked = state.spritePaletteLock;
    paletteLockInput.disabled = busy || !state.motionVideoSrc;
    paletteLockInput.checked = state.paletteLock;
    hardAlphaEdgesInput.disabled = busy || !state.motionVideoSrc;
    hardAlphaEdgesInput.checked = state.hardAlphaEdges;
    const diagnosticParts = [
      state.preservedOffPalettePixels !== null
        ? `${state.preservedOffPalettePixels.toLocaleString()} uncertain-color pixels preserved`
        : null,
      state.removedLowAlphaPixels !== null
        ? `${state.removedLowAlphaPixels.toLocaleString()} low-alpha pixels removed`
        : null,
      state.removedChromaFringePixels !== null
        ? `${state.removedChromaFringePixels.toLocaleString()} chroma-fringe pixels removed`
        : null,
    ].filter(Boolean);
    paletteDiagnostics.textContent = diagnosticParts.length
      ? `Current frames: ${diagnosticParts.join(" · ")}`
      : "";
    paletteDiagnostics.hidden = diagnosticParts.length === 0;
    const videoSettingsChanged =
      Boolean(state.motionVideoSrc) &&
      (state.motionPrompt.trim() !== state.appliedMotionPrompt ||
        state.motionModel !== state.appliedMotionModel);
    setStatus(
      videoSettingsNotice,
      !state.hasApiKey
        ? "OPENROUTER_API_KEY is required to generate video. Existing videos can still be processed below."
        : videoSettingsChanged
          ? "Settings changed — generate a new video to apply."
          : "",
      !state.hasApiKey ? "error" : "info",
    );
    setStatus(
      frameOptionsNotice,
      !state.motionVideoSrc
        ? "Generate a video in step 2.1 first."
        : state.frames.length > 0 && extractionOptionsChanged
          ? "Options changed — generate frames to apply. Current frames are unchanged."
          : "",
    );
    styleGuideCount.textContent = `${state.styleGuides.length}/${MAX_STYLE_GUIDE_IMAGES}`;
    styleGuideList.innerHTML = renderStyleGuideImages(state.styleGuides, busy);
    styleGuidesInactive.hidden = state.styleGuides.length === 0;
    if (incompatibleStyleGuides) {
      setStatus(
        styleGuideNotice,
        `${escapeHtml(selectedImageModel?.label ?? "This model")} supports fewer Style Guide Images. Remove guides or choose a compatible model.`,
        "error",
      );
    } else if (
      state.styleGuidesChanged &&
      state.spriteAcquisition === "generated" &&
      generateMode
    ) {
      setStatus(styleGuideNotice, "Style guides changed — regenerate to apply.");
    } else if (state.styleGuides.length > 0 && !state.spriteSrc && generateMode) {
      setStatus(styleGuideNotice, "These guides will apply to the next generation.");
    } else {
      setStatus(styleGuideNotice, "");
    }

    if (state.spriteSrc) {
      spritePreview.innerHTML = `<img src="${state.spriteSrc}" alt="Reference sprite" />`;
      if (state.spriteDimensions) {
        const dimensions = `${state.spriteDimensions.w} × ${state.spriteDimensions.h} px`;
        spriteCaption.textContent = state.spriteOriginalFilename
          ? `${state.spriteOriginalFilename} · ${dimensions}`
          : dimensions;
      } else {
        spriteCaption.textContent = "—";
      }
    } else if (!busy) {
      spritePreview.innerHTML = `<span class="preview__placeholder">No sprite yet</span>`;
      spriteCaption.textContent = "—";
    }
    backgroundWarning.hidden =
      !state.spriteSrc || state.backgroundSuitability !== "warning";

    framesGrid.innerHTML = renderFramesGrid(state.frames, state.selectedFrameIndices);
    if (state.motionVideoSrc !== renderedMotionVideoSrc) {
      renderedMotionVideoSrc = state.motionVideoSrc;
      motionVideoPreview.innerHTML = state.motionVideoSrc
        ? `<video src="${escapeAttr(state.motionVideoSrc)}" aria-label="Generated movement video" controls loop playsinline preload="metadata">Your browser does not support video playback.</video>`
        : `<span class="motion-video-preview__placeholder">Generate a video to preview it here</span>`;
    }

    const frameSizeValue = String(state.frameSize);
    if (targetSizeSelect.value !== frameSizeValue) targetSizeSelect.value = frameSizeValue;
    const fillValue = String(state.subjectFillPct);
    if (subjectFillSelect.value !== fillValue) subjectFillSelect.value = fillValue;
    const colorValue = state.colorCount === null ? "off" : String(state.colorCount);
    if (colorCountSelect.value !== colorValue) colorCountSelect.value = colorValue;

    const showFillWarning =
      Boolean(state.spriteSrc) &&
      state.subjectFillMeasured !== null &&
      Math.abs(state.subjectFillMeasured - state.subjectFillPct) > 10;
    fillWarning.hidden = !showFillWarning;
    if (showFillWarning) {
      fillWarning.textContent = `Subject fills ${state.subjectFillMeasured}% of the frame — target is ${state.subjectFillPct}%.`;
    }

    animationsList.innerHTML = renderAnimations(state.animations, state.activeAnimationId);
    renderQuickPreview();

    projectLabel.textContent =
      state.currentProjectName === "latest" ? "untitled" : state.currentProjectName;

    loadMenu.innerHTML = renderLoadMenu(state.savedProjects);

    // Re-render the model select only when the list changes (avoid clobbering user input mid-edit)
    const imageOptionsKey = state.imageModels
      .map((m) => `${m.id}|${m.label}|${m.maxStyleGuideImages}`)
      .join(",");
    if (imageOptionsKey !== lastImageModelOptionsKey) {
      spriteModelSelect.innerHTML = state.imageModels
        .map((m) => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.label)}</option>`)
        .join("");
      lastImageModelOptionsKey = imageOptionsKey;
    }
    if (spriteModelSelect.value !== state.spriteModel) {
      spriteModelSelect.value = state.spriteModel;
    }

    const videoOptionsKey = state.videoModels.map((m) => `${m.id}|${m.label}`).join(",");
    if (videoOptionsKey !== lastVideoModelOptionsKey) {
      motionModelSelect.innerHTML = state.videoModels
        .map((m) => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.label)}</option>`)
        .join("");
      lastVideoModelOptionsKey = videoOptionsKey;
    }
    if (motionModelSelect.value !== state.motionModel) {
      motionModelSelect.value = state.motionModel;
    }
  });

  function inferredStep(view: import("./lib/api").ProjectView) {
    return view.sourceVideoUrl ? 3 : view.spriteUrl ? 2 : 1;
  }

  function viewIsDirty(
    view: import("./lib/api").ProjectView,
    projects: import("./lib/api").ProjectSummary[],
  ) {
    const meaningful = Boolean(
      view.spriteUrl || view.frames.length || view.spritePrompt.trim() ||
      view.styleGuides.length || view.motionPrompt.trim(),
    );
    if (view.name === "latest") return meaningful;
    return projects.find((project) => project.name === view.name)?.updatedAt !== view.updatedAt;
  }

  function isValidProjectName(name: string) {
    return name !== "latest" && /^[a-zA-Z0-9_-]{1,40}$/.test(name);
  }

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  window.addEventListener("popstate", () => {
    if (applyingNavigation) return;
    void navigateFromUrl();
  });

  async function navigateFromUrl() {
    const requested = parseNavigation(new URL(window.location.href));
    const currentName = store.get().currentProjectName;
    const requestedName = requested.project ?? "latest";
    if (requestedName === currentName) {
      openAccordionStep(requested.step ? stepNumber(requested.step) : activeStep, false);
      activateAnimation(requested.animation, false);
      writeNavigation("replace", currentName === "latest" ? null : currentName);
      return;
    }
    if (!confirmDiscard()) {
      writeNavigation("replace", currentName === "latest" ? null : currentName);
      return;
    }
    applyingNavigation = true;
    try {
      if (requested.project && !isValidProjectName(requested.project)) {
        throw new Error(`Invalid project link '${requested.project}'`);
      }
      const view = requested.project
        ? await loadProject(requested.project)
        : await newProject();
      applyView(view);
      frozenDraftFrames = null;
      animationNameInput.value = "";
      store.set({ activeAnimationId: null });
      activateAnimation(requested.animation, false);
      cleanUpdatedAt = requested.project ? view.updatedAt : null;
      hasUnsavedInput = false;
      openAccordionStep(requested.step ? stepNumber(requested.step) : inferredStep(view), false);
      writeNavigation("replace", requested.project);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Project navigation failed";
      setStatus(spriteStatus, escapeHtml(message), "error");
      toast(message);
    } finally {
      applyingNavigation = false;
    }
  }

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("ai-game-studio-editor");
    let warned = false;
    channel.addEventListener("message", (event) => {
      if (event.data === "hello") channel.postMessage("present");
      if (event.data === "present" && !warned) {
        warned = true;
        toast("Another editor tab is open. Both tabs share the same working project.");
      }
    });
    channel.postMessage("hello");
  }

  // ---- Boot ----
  Promise.all([
    checkHealth(),
    getCurrentProject(),
    listProjects(),
    getImageModels(),
    getVideoModels(),
  ])
    .then(async ([health, currentView, projects, imageModelsResp, videoModelsResp]) => {
      store.set({
        hasApiKey: health.hasApiKey,
        savedProjects: projects,
        imageModels: [...imageModelsResp.models],
        videoModels: [...videoModelsResp.models],
      });
      let view = currentView;
      let projectForUrl = currentView.name === "latest" ? null : currentView.name;
      if (initialNavigation.project && initialNavigation.project !== currentView.name) {
        if (!isValidProjectName(initialNavigation.project)) {
          applyView(currentView);
          openAccordionStep(
            initialNavigation.step ? stepNumber(initialNavigation.step) : inferredStep(currentView),
            false,
          );
          setStatus(
            spriteStatus,
            `Invalid project link '${escapeHtml(initialNavigation.project)}'.`,
            "error",
          );
          const normalized = withNavigation(new URL(window.location.href), {
            step: stepName(activeStep),
          });
          window.history.replaceState({}, "", normalized);
          return;
        }
        if (
          !viewIsDirty(currentView, projects) ||
          window.confirm("Open the linked project? Unsaved work in the current workspace will be lost.")
        ) {
          try {
            view = await loadProject(initialNavigation.project);
            projectForUrl = initialNavigation.project;
          } catch (err) {
            applyView(currentView);
            openAccordionStep(
              initialNavigation.step ? stepNumber(initialNavigation.step) : inferredStep(currentView),
              false,
            );
            const message = err instanceof Error ? err.message : "Project not found";
            setStatus(spriteStatus, escapeHtml(message), "error");
            const normalized = withNavigation(new URL(window.location.href), {
              step: stepName(activeStep),
            });
            window.history.replaceState({}, "", normalized);
            return;
          }
        }
      }
      applyView(view);
      const saved = projects.find((project) => project.name === view.name);
      cleanUpdatedAt = saved?.updatedAt ?? null;
      hasUnsavedInput = false;
      openAccordionStep(
        initialNavigation.step ? stepNumber(initialNavigation.step) : inferredStep(view),
        false,
      );
      activateAnimation(initialNavigation.animation, false);
      writeNavigation("replace", projectForUrl);
    })
    .catch((err) => {
      console.error("[client] boot failed", err);
      setStatus(spriteStatus, "Backend not reachable.", "error");
    });
}

function spinner(): string {
  return `<span class="spinner"></span>`;
}

function setStatus(
  el: HTMLElement,
  html: string,
  kind: "info" | "error" | "success" = "info",
) {
  el.className =
    "status" +
    (kind === "error" ? " status--error" : kind === "success" ? " status--success" : "");
  el.innerHTML = html;
}

function renderFramesGrid(frames: string[], selected: Set<number>): string {
  const count = frames.length > 0 ? frames.length : EMPTY_PLACEHOLDER_SLOTS;
  const tiles: string[] = [];
  for (let i = 0; i < count; i++) {
    const frame = frames[i];
    const isSelected = selected.has(i);
    const empty = !frame;
    tiles.push(`
      <button class="frame-tile ${isSelected ? "is-selected" : ""} ${empty ? "is-empty" : ""}" type="button" data-index="${i}" aria-pressed="${isSelected}" ${empty ? "disabled" : ""}>
        <div class="frame-tile__num">${i + 1}</div>
        ${frame ? `<img src="${frame}" alt="Frame ${i + 1}" />` : ""}
      </button>
    `);
  }
  return tiles.join("");
}

function renderAnimations(
  animations: import("./lib/api").AnimationView[],
  activeId: string | null,
): string {
  if (animations.length === 0) {
    return '<div class="gif-preview__placeholder">No saved Animations yet</div>';
  }
  return animations.map((animation) => `
    <div class="animation-row${animation.id === activeId ? " is-active" : ""}" data-animation-id="${escapeAttr(animation.id)}">
      <div class="animation-row__title">${escapeHtml(animation.name)}</div>
      <div class="animation-row__meta">${animation.frameUrls.length} frames · ${animation.fps} FPS</div>
      <div class="animation-row__actions">
        <button class="btn btn--link btn--sm" type="button">Edit</button>
        <button class="btn btn--link btn--sm" type="button" data-animation-export>Export</button>
        <button class="btn btn--link btn--sm" type="button" data-animation-delete>Delete</button>
      </div>
    </div>
  `).join("");
}

function renderStyleGuideImages(guides: StyleGuideImageView[], disabled: boolean): string {
  return guides
    .map(
      (guide) => `
        <div class="style-guide-thumb">
          <img src="${escapeAttr(guide.url)}" alt="" />
          <button
            class="style-guide-thumb__remove"
            type="button"
            data-remove-style-guide="${escapeAttr(guide.id)}"
            aria-label="Remove ${escapeAttr(guide.originalFilename)}"
            title="${escapeAttr(guide.originalFilename)}"
            ${disabled ? "disabled" : ""}
          >×</button>
        </div>
      `,
    )
    .join("");
}

function renderLoadMenu(projects: { name: string; updatedAt: string }[]): string {
  if (projects.length === 0) {
    return `<div class="load-menu__empty">No saved projects yet</div>`;
  }
  return projects
    .map((p) => {
      const when = new Date(p.updatedAt).toLocaleString();
      return `
        <div class="load-menu__row">
          <button class="load-menu__item" data-load-name="${escapeAttr(p.name)}">
            <span class="load-menu__name">${escapeHtml(p.name)}</span>
            <span class="load-menu__time">${escapeHtml(when)}</span>
          </button>
          <button class="load-menu__delete" data-delete-name="${escapeAttr(p.name)}" title="Delete">${trashIcon}</button>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function renderShell(): string {
  return `
    <div class="app">
      <header class="app-header">
        <div class="app-header__brand">
          <span class="app-header__logo">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </span>
          <span class="app-header__title">Sprite Sheet Builder</span>
          <span class="app-header__project">· <span id="project-label">untitled</span></span>
        </div>

        <div class="app-header__actions">
          <button id="btn-new-project" class="btn btn--secondary btn--sm" type="button">
            ${plusIcon}
            New
          </button>
          <div class="load-menu-wrap">
            <button id="btn-load-project" class="btn btn--secondary btn--sm" type="button">
              ${folderIcon}
              Load
              ${chevronIcon}
            </button>
            <div id="load-menu" class="load-menu"></div>
          </div>
          <button id="btn-save-project" class="btn btn--secondary btn--sm" type="button">
            ${saveIcon}
            Save
          </button>
        </div>
      </header>

      <main class="app-main">
        <div class="columns">
          <div class="workflow-accordion">

          <section class="card accordion-item is-open" data-accordion-step="1">
            <button class="accordion-trigger" type="button" aria-expanded="true">
              <span>1. Choose Reference Sprite</span><span class="accordion-trigger__icon" aria-hidden="true"></span>
            </button>
            <div class="panel-body">
            <div class="mode-switch" role="group" aria-label="Reference sprite acquisition method">
              <button id="mode-generate" class="mode-switch__button is-active" type="button" aria-pressed="true">
                Generate
              </button>
              <button id="mode-upload" class="mode-switch__button" type="button" aria-pressed="false">
                Upload
              </button>
            </div>
            <div id="generate-panel" class="acquisition-panel">
              <div class="field">
                <label class="field__label" for="sprite-prompt">Reference Sprite Prompt</label>
                <textarea
                  id="sprite-prompt"
                  class="textarea"
                  placeholder="Describe the character or object…"
                  rows="3"
                ></textarea>
              </div>
              <div class="style-guide-field">
                <div class="style-guide-field__header">
                  <span class="field__label">Style Guide Images <span class="field__optional">· optional</span></span>
                  <span id="style-guide-count" class="style-guide-field__count">0/${MAX_STYLE_GUIDE_IMAGES}</span>
                </div>
                <label id="style-guide-dropzone" class="style-guide-dropzone" for="style-guide-input">
                  <input
                    id="style-guide-input"
                    class="visually-hidden"
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  />
                  <span class="style-guide-dropzone__icon">${folderIcon}</span>
                  <span>
                    <span class="style-guide-dropzone__title">Drop style examples or choose files</span>
                    <span class="style-guide-dropzone__hint">PNG, JPEG, or WebP · 10 MB each</span>
                  </span>
                </label>
                <div id="style-guide-list" class="style-guide-list"></div>
                <div id="style-guide-notice" class="status"></div>
                <div id="style-guide-status" class="status"></div>
              </div>
              <div class="field">
                <label class="field__label" for="sprite-model">Model</label>
                <select id="sprite-model" class="select"></select>
              </div>
              <label class="style-match-row" for="sprite-palette-lock">
                <input id="sprite-palette-lock" class="style-match-row__input" type="checkbox" />
                <span class="style-match-row__text">
                  <span class="style-match-row__title">Palette Lock</span>
                  <span class="style-match-row__hint"
                    >Restrict sprite colors to the Style Guide Images' palette.</span
                  >
                </span>
              </label>
              <button id="btn-generate-sprite" class="btn btn--primary btn--block" type="button">
                ${sparkleIcon}
                Generate Reference Sprite
              </button>
            </div>
            <div class="geometry-row">
              <div class="field">
                <label class="field__label" for="target-size">Frame Size</label>
                <select id="target-size" class="select">
                  <option value="32">32 × 32</option>
                  <option value="64">64 × 64</option>
                  <option value="128">128 × 128</option>
                  <option value="192">192 × 192</option>
                  <option value="256">256 × 256</option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="subject-fill">Subject Fill</label>
                <select id="subject-fill" class="select">
                  <option value="50">50%</option>
                  <option value="70">70%</option>
                  <option value="85">85%</option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="color-count">Palette</label>
                <select id="color-count" class="select">
                  <option value="off">Off</option>
                  <option value="4">4 colors</option>
                  <option value="8">8 colors</option>
                  <option value="16">16 colors</option>
                  <option value="32">32 colors</option>
                </select>
              </div>
            </div>
            <div id="image-size-strategy" class="geometry-hint" hidden></div>
            <div id="upload-panel" class="acquisition-panel" hidden>
              <label id="upload-dropzone" class="upload-dropzone" for="sprite-upload">
                <input
                  id="sprite-upload"
                  class="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                />
                <span class="upload-dropzone__icon">${folderIcon}</span>
                <span class="upload-dropzone__title">Drop an image here or choose a file</span>
                <span class="upload-dropzone__hint">PNG, JPEG, or WebP · max 10 MB</span>
                <span class="upload-dropzone__hint">Use a flat #00b140 background for best results.</span>
              </label>
              <div id="style-guides-inactive" class="status" hidden>
                Style Guide Images are retained but inactive while Upload is selected.
              </div>
            </div>
            <div id="api-key-warning" class="status status--error" hidden>
              OPENROUTER_API_KEY is missing. Upload still works without it.
            </div>
            <div id="sprite-status" class="status"></div>
            <div class="preview">
              <div class="preview__label">Reference Sprite</div>
              <div id="sprite-preview" class="preview__box">
                <span class="preview__placeholder">No sprite yet</span>
              </div>
              <div id="sprite-caption" class="preview__caption">—</div>
              <div id="background-warning" class="background-warning" hidden>
                Background may not key cleanly. Use a flat #00b140 background for best results.
              </div>
              <div id="fill-warning" class="background-warning" hidden></div>
            </div>
            </div>
          </section>

            <section class="card movement-step accordion-item" data-accordion-step="2">
              <button class="accordion-trigger" type="button" aria-expanded="false">
                <span>2. Generate Video</span><span class="accordion-trigger__icon" aria-hidden="true"></span>
              </button>
              <div class="panel-body">
              <div class="field">
                <label class="field__label" for="motion-prompt">Movement Prompt</label>
                <textarea
                  id="motion-prompt"
                  class="textarea"
                  placeholder="e.g., walking left, jump, attack right…"
                  rows="3"
                ></textarea>
              </div>
              <div class="motion-controls">
                <div class="field motion-controls__model">
                  <label class="field__label" for="motion-model">Model</label>
                  <select id="motion-model" class="select"></select>
                </div>
                <button id="btn-generate-video" class="btn btn--secondary motion-controls__btn" type="button">
                  ${frameIcon}
                  Generate Video
                </button>
              </div>
              <div id="video-model-guidance" class="geometry-hint"></div>
              <div id="video-settings-notice" class="status"></div>
              <div id="video-status" class="status"></div>
              <div class="motion-video-section">
                <div class="motion-video-section__label">Generated Video</div>
                <div id="motion-video-preview" class="motion-video-preview">
                  <span class="motion-video-preview__placeholder">Generate a video to preview it here</span>
                </div>
              </div>
              </div>
            </section>

            <section class="card movement-step accordion-item" data-accordion-step="3">
              <button class="accordion-trigger" type="button" aria-expanded="false">
                <span>3. Generate Frames</span><span class="accordion-trigger__icon" aria-hidden="true"></span>
              </button>
              <div class="panel-body">
              <label class="style-match-row" for="palette-lock">
                <input id="palette-lock" class="style-match-row__input" type="checkbox" />
                <span class="style-match-row__text">
                  <span class="style-match-row__title">Palette Lock</span>
                  <span class="style-match-row__hint">Restrict frame colors to the Reference Sprite's palette</span>
                </span>
              </label>
              <label class="style-match-row" for="hard-alpha-edges">
                <input id="hard-alpha-edges" class="style-match-row__input" type="checkbox" />
                <span class="style-match-row__text">
                  <span class="style-match-row__title">Hard Alpha Edges</span>
                  <span class="style-match-row__hint">Convert extracted frames to fully opaque or fully transparent pixels</span>
                </span>
              </label>
              <button id="btn-generate-frames" class="btn btn--secondary btn--block" type="button">
                ${frameIcon}
                Generate Frames
              </button>
              <div id="frame-options-notice" class="status"></div>
              <div id="palette-diagnostics" class="geometry-hint" hidden></div>
              <div id="frames-status" class="status"></div>
              </div>
            </section>
          </div>

          <section class="card">
            <h2 class="card__title">4. Animations</h2>
            <div class="panel-body">
            <div class="animation-workspace">
            <aside class="animations-library" aria-label="Saved Animations">
              <div class="gif-section__label">Saved Animations</div>
              <div id="animations-list" class="animations-list"></div>
            </aside>
            <div class="animation-edit-pane">
            <div class="frames-section">
              <div class="frames-section__header">
                <div id="frames-heading" class="frames-section__label" tabindex="-1">Select frames for this Animation</div>
                <div class="frames-section__actions">
                  <button id="btn-select-all-frames" class="btn btn--link btn--sm" type="button">
                    Select All
                  </button>
                  <button id="btn-deselect-all-frames" class="btn btn--link btn--sm" type="button">
                    Deselect All
                  </button>
                </div>
              </div>
              <div id="frames-grid" class="frames-grid"></div>
            </div>
            <div class="animation-editor">
              <div class="animation-editor__header">
                <div class="field animation-editor__name">
                  <label class="field__label" for="animation-name">Animation name</label>
                  <input id="animation-name" class="input" maxlength="40" placeholder="e.g., run" />
                </div>
                <div class="field animation-editor__fps">
                  <label class="field__label" for="animation-fps">FPS</label>
                  <input id="animation-fps" class="input" type="number" min="1" max="60" value="12" />
                </div>
              </div>
              <div class="quick-preview__header">
                <div class="quick-preview__title">
                  <div class="gif-section__label">Quick Preview</div>
                  <span id="quick-preview-count" class="quick-preview__count">0 frames</span>
                </div>
              </div>
              <div id="quick-preview" class="gif-preview quick-preview">
                <div id="quick-preview-stage" class="quick-preview__stage">
                  <span class="gif-preview__placeholder">Select frames to preview immediately</span>
                </div>
                <div class="quick-preview__overlay">
                  <span id="quick-preview-position" class="quick-preview__position">0 / 0</span>
                  <button id="btn-preview-zoom-out" class="quick-preview__action" type="button" aria-label="Zoom out">−</button>
                  <button id="btn-preview-zoom-reset" class="quick-preview__action quick-preview__zoom" type="button" aria-label="Reset zoom">100%</button>
                  <button id="btn-preview-zoom-in" class="quick-preview__action" type="button" aria-label="Zoom in">+</button>
                  <button id="btn-toggle-preview" class="quick-preview__action quick-preview__play" type="button">Play</button>
                </div>
              </div>
              <div class="animation-editor__actions">
                <button id="btn-save-animation" class="btn btn--primary" type="button">Save as New</button>
                <button id="btn-update-animation" class="btn btn--secondary" type="button" disabled>Update</button>
                <button id="btn-new-animation" class="btn btn--link" type="button">New Draft</button>
              </div>
              <div id="animation-status" class="status"></div>
            </div>
            </div>
            </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  `;
}

function createToast(root: HTMLElement) {
  const el = document.createElement("div");
  el.className = "toast";
  root.appendChild(el);
  let timer: number | undefined;
  return (msg: string) => {
    el.textContent = msg;
    el.classList.add("is-visible");
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => el.classList.remove("is-visible"), 2200);
  };
}
