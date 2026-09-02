import {
  animateSprite,
  checkHealth,
  commitSpriteUpload,
  deleteProject,
  discardSpriteUpload,
  generateSprite,
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
  saveSpritesheet,
  type StyleGuideImageView,
  uploadStyleGuide,
} from "./lib/api";
import { Store, cacheBust, createInitialState, hydrateFromView } from "./lib/state";
import { composeSpritesheet, downloadDataUrl, loadImage } from "./lib/spritesheet";
import {
  chevronIcon,
  downloadIcon,
  folderIcon,
  frameIcon,
  gridIcon,
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
  const styleGuideDropzone = root.querySelector<HTMLLabelElement>("#style-guide-dropzone")!;
  const styleGuideInput = root.querySelector<HTMLInputElement>("#style-guide-input")!;
  const styleGuideCount = root.querySelector<HTMLSpanElement>("#style-guide-count")!;
  const styleGuideList = root.querySelector<HTMLDivElement>("#style-guide-list")!;
  const styleGuideNotice = root.querySelector<HTMLDivElement>("#style-guide-notice")!;
  const styleGuideStatus = root.querySelector<HTMLDivElement>("#style-guide-status")!;
  const styleGuidesInactive = root.querySelector<HTMLDivElement>("#style-guides-inactive")!;

  const motionInput = root.querySelector<HTMLTextAreaElement>("#motion-prompt")!;
  const motionModelSelect = root.querySelector<HTMLSelectElement>("#motion-model")!;
  const generateFramesBtn = root.querySelector<HTMLButtonElement>("#btn-generate-frames")!;
  const framesGrid = root.querySelector<HTMLDivElement>("#frames-grid")!;
  const framesStatus = root.querySelector<HTMLDivElement>("#frames-status")!;
  const generateSheetBtn = root.querySelector<HTMLButtonElement>("#btn-generate-sheet")!;

  const sheetPreview = root.querySelector<HTMLDivElement>("#sheet-preview")!;
  const sheetMeta = root.querySelector<HTMLDivElement>("#sheet-meta")!;
  const exportBtn = root.querySelector<HTMLButtonElement>("#btn-export")!;
  const gifPreview = root.querySelector<HTMLDivElement>("#gif-preview")!;

  const projectLabel = root.querySelector<HTMLSpanElement>("#project-label")!;
  const newBtn = root.querySelector<HTMLButtonElement>("#btn-new-project")!;
  const saveBtn = root.querySelector<HTMLButtonElement>("#btn-save-project")!;
  const loadBtn = root.querySelector<HTMLButtonElement>("#btn-load-project")!;
  const loadMenu = root.querySelector<HTMLDivElement>("#load-menu")!;

  // ---- Event handlers ----
  promptInput.addEventListener("input", () => {
    store.set({ spritePrompt: promptInput.value });
  });

  spriteModelSelect.addEventListener("change", () => {
    store.set({ spriteModel: spriteModelSelect.value });
  });

  generateModeBtn.addEventListener("click", () => {
    store.set({ spriteAcquisitionMode: "generate" });
  });

  uploadModeBtn.addEventListener("click", () => {
    store.set({ spriteAcquisitionMode: "upload" });
  });

  targetSizeSelect.addEventListener("change", () => {
    store.set({ frameSize: Number(targetSizeSelect.value) });
  });

  subjectFillSelect.addEventListener("change", () => {
    store.set({ subjectFillPct: Number(subjectFillSelect.value) });
  });

  colorCountSelect.addEventListener("change", () => {
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
          "Replace the Reference Sprite? Existing movement frames and spritesheet will be removed.",
        )
      ) {
        await discardSpriteUpload();
        store.set({ status: "idle" });
        setStatus(spriteStatus, "Upload cancelled.");
        return;
      }
      const view = await commitSpriteUpload(prepared.uploadId);
      const patch = hydrateFromView(view);
      store.set({ ...patch, spritePrompt: promptDraft, status: "idle", errorMessage: null });
      promptInput.value = promptDraft;
      motionInput.value = view.motionPrompt;
      setStatus(spriteStatus, "Reference sprite uploaded.", "success");
      toast("Reference sprite uploaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload image";
      store.set({ status: "error", errorMessage: message });
      setStatus(spriteStatus, message, "error");
    } finally {
      uploadInput.value = "";
    }
  }

  motionInput.addEventListener("input", () => {
    store.set({ motionPrompt: motionInput.value });
  });

  motionModelSelect.addEventListener("change", () => {
    store.set({ motionModel: motionModelSelect.value });
  });

  generateSpriteBtn.addEventListener("click", async () => {
    const prompt = store.get().spritePrompt.trim();
    if (!prompt) {
      setStatus(spriteStatus, "Enter a sprite prompt first.", "error");
      return;
    }
    store.set({ status: "generating-image", errorMessage: null });
    setStatus(spriteStatus, `${spinner()}Generating reference sprite…`);
    try {
      const state = store.get();
      const result = await generateSprite(prompt, state.spriteModel, {
        frameSize: state.frameSize,
        subjectFillPct: state.subjectFillPct,
        colorCount: state.colorCount,
      });
      const img = await loadImage(result.dataUrl);
      const patch = hydrateFromView(result.view);
      store.set({
        ...patch,
        status: "idle",
        errorMessage: null,
        spriteSrc: result.dataUrl,
        spriteDimensions: { w: img.naturalWidth, h: img.naturalHeight },
      });
      setStatus(spriteStatus, "Reference sprite ready.", "success");
      toast("Reference sprite generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate sprite";
      store.set({ status: "error", errorMessage: message });
      setStatus(spriteStatus, message, "error");
    }
  });

  generateFramesBtn.addEventListener("click", async () => {
    const state = store.get();
    if (!state.spriteSrc) {
      setStatus(framesStatus, "Generate a reference sprite first.", "error");
      return;
    }
    const text = state.motionPrompt.trim();
    if (!text) {
      setStatus(framesStatus, "Enter a movement prompt first.", "error");
      return;
    }
    store.set({ status: "generating-video", errorMessage: null });
    setStatus(framesStatus, `${spinner()}Generating motion video…`);
    try {
      const view = await animateSprite(state.spriteSrc, text, state.motionModel);
      const v = view.updatedAt;
      store.set({
        status: "done",
        frames: view.frames.map((f) => cacheBust(f, v)!),
        selectedFrameIndices: new Set(view.selectedFrameIndices),
        spritesheetSrc: null,
        spritesheetCols: null,
        previewGifSrc: null,
        previewGifBuilding: false,
      });
      setStatus(framesStatus, `Extracted ${view.frames.length} frames.`, "success");
      toast("Frames extracted");
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
    if (next.has(index)) next.delete(index);
    else next.add(index);
    store.set({ selectedFrameIndices: next });
    scheduleSelectionPersist();
  });

  generateSheetBtn.addEventListener("click", async () => {
    const state = store.get();
    const selected = [...state.selectedFrameIndices]
      .sort((a, b) => a - b)
      .map((i) => state.frames[i])
      .filter(Boolean);
    if (selected.length === 0) {
      setStatus(framesStatus, "Select at least one frame to include.", "error");
      return;
    }
    setStatus(framesStatus, `${spinner()}Composing spritesheet…`);
    try {
      const sheet = await composeSpritesheet({ frameSrcs: selected });
      store.set({
        spritesheetSrc: sheet.dataUrl,
        spritesheetCols: sheet.cols,
        previewGifSrc: null,
        previewGifBuilding: true,
        status: "done",
      });
      setStatus(
        framesStatus,
        `${spinner()}Spritesheet ready — building animated preview…`,
      );
      toast("Spritesheet ready");

      try {
        const view = await saveSpritesheet(sheet.dataUrl);
        const gifSrc = view.previewGifUrl
          ? `${view.previewGifUrl}?v=${encodeURIComponent(view.updatedAt)}`
          : null;
        store.set({ previewGifSrc: gifSrc, previewGifBuilding: false });
        if (gifSrc) {
          setStatus(framesStatus, "Spritesheet and preview ready.", "success");
        } else {
          setStatus(
            framesStatus,
            "Spritesheet ready (animated preview failed — see server log).",
            "success",
          );
        }
      } catch (err) {
        store.set({ previewGifBuilding: false });
        console.warn("[client] failed to persist spritesheet/gif", err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to compose spritesheet";
      setStatus(framesStatus, message, "error");
    }
  });

  exportBtn.addEventListener("click", () => {
    const src = store.get().spritesheetSrc;
    if (!src) {
      toast("Generate the spritesheet first");
      return;
    }
    if (src.startsWith("data:")) {
      downloadDataUrl(src, "spritesheet.png");
    } else {
      const a = document.createElement("a");
      a.href = src;
      a.download = "spritesheet.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  // ---- New / Save / Load wiring ----
  newBtn.addEventListener("click", async () => {
    const state = store.get();
    const hasWork =
      state.spriteSrc !== null ||
      state.frames.length > 0 ||
      state.spritePrompt.trim().length > 0 ||
      state.styleGuides.length > 0 ||
      state.motionPrompt.trim().length > 0;
    if (hasWork && !window.confirm("Discard the current project and start fresh? Unsaved work will be lost.")) {
      return;
    }
    try {
      const view = await newProject();
      applyView(view);
      setStatus(spriteStatus, "", "info");
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
      store.set({
        currentProjectName: view.name,
        savedProjects: await listProjects(),
      });
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
      try {
        const view = await loadProject(name);
        applyView(view);
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
    const patch = hydrateFromView(view);
    store.set(patch);
    promptInput.value = view.spritePrompt;
    motionInput.value = view.motionPrompt;
  }

  let lastImageModelOptionsKey = "";
  let lastVideoModelOptionsKey = "";

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
    const styleGuideLimit = Math.min(
      MAX_STYLE_GUIDE_IMAGES,
      selectedImageModel?.maxStyleGuideImages ?? 0,
    );
    const incompatibleStyleGuides =
      state.styleGuides.length > 0 && state.styleGuides.length > styleGuideLimit;

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
    generateFramesBtn.disabled = busy || !state.spriteSrc;
    generateSheetBtn.disabled = busy || state.frames.length === 0;
    exportBtn.disabled = !state.spritesheetSrc;
    newBtn.disabled = busy;
    saveBtn.disabled = busy;
    loadBtn.disabled = busy;

    const generateMode = state.spriteAcquisitionMode === "generate";
    generatePanel.hidden = !generateMode;
    uploadPanel.hidden = generateMode;
    generateModeBtn.classList.toggle("is-active", generateMode);
    uploadModeBtn.classList.toggle("is-active", !generateMode);
    generateModeBtn.setAttribute("aria-pressed", String(generateMode));
    uploadModeBtn.setAttribute("aria-pressed", String(!generateMode));
    apiKeyWarning.hidden = state.hasApiKey || !generateMode;

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

    if (state.spritesheetSrc && state.spritesheetCols) {
      sheetPreview.innerHTML = `<img src="${state.spritesheetSrc}" alt="Spritesheet" />`;
      sheetMeta.textContent = `1 × ${state.spritesheetCols} · ${state.spritesheetCols} frames`;
    } else {
      sheetPreview.innerHTML = `<span class="sheet-preview__placeholder">Generate a spritesheet to preview here</span>`;
      const pending = state.selectedFrameIndices.size;
      sheetMeta.textContent = pending > 0 ? `1 × ${pending} · pending` : "No spritesheet yet";
    }

    if (state.previewGifBuilding) {
      gifPreview.innerHTML = `<span class="gif-preview__placeholder">${spinner()}Building animated preview…</span>`;
    } else if (state.previewGifSrc) {
      gifPreview.innerHTML = `<img src="${state.previewGifSrc}" alt="Animated preview" />`;
    } else {
      gifPreview.innerHTML = `<span class="gif-preview__placeholder">Generate a spritesheet to see the animation</span>`;
    }

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

  // ---- Boot ----
  Promise.all([
    checkHealth(),
    getCurrentProject(),
    listProjects(),
    getImageModels(),
    getVideoModels(),
  ])
    .then(([health, view, projects, imageModelsResp, videoModelsResp]) => {
      store.set({
        hasApiKey: health.hasApiKey,
        savedProjects: projects,
        imageModels: [...imageModelsResp.models],
        videoModels: [...videoModelsResp.models],
      });
      applyView(view);
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
      <div class="frame-tile ${isSelected ? "is-selected" : ""} ${empty ? "is-empty" : ""}" data-index="${i}">
        <div class="frame-tile__num">${i + 1}</div>
        ${frame ? `<img src="${frame}" alt="Frame ${i + 1}" />` : ""}
      </div>
    `);
  }
  return tiles.join("");
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
          <button class="app-header__help" type="button" aria-label="Help">?</button>
        </div>
      </header>

      <main class="app-main">
        <div class="columns">

          <section class="card">
            <h2 class="card__title">1. Choose Reference Sprite</h2>
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
          </section>

          <section class="card">
            <h2 class="card__title">2. Generate Movement Frames</h2>
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
              <button id="btn-generate-frames" class="btn btn--secondary motion-controls__btn" type="button">
                ${frameIcon}
                Generate Frames
              </button>
            </div>
            <div id="frames-status" class="status"></div>
            <div class="frames-section">
              <div class="frames-section__label">Select frames to include</div>
              <div id="frames-grid" class="frames-grid"></div>
            </div>
            <button id="btn-generate-sheet" class="btn btn--primary btn--block btn--lg" type="button">
              ${gridIcon}
              Generate Spritesheet
            </button>
          </section>

          <section class="card">
            <h2 class="card__title">3. Spritesheet Preview</h2>
            <div id="sheet-preview" class="sheet-preview">
              <span class="sheet-preview__placeholder">Generate a spritesheet to preview here</span>
            </div>
            <div class="sheet-footer">
              <div id="sheet-meta" class="sheet-footer__meta">No spritesheet yet</div>
              <button id="btn-export" class="btn btn--secondary" type="button">
                ${downloadIcon}
                Export PNG
              </button>
            </div>
            <div class="gif-section">
              <div class="gif-section__label">Animated Preview</div>
              <div id="gif-preview" class="gif-preview">
                <span class="gif-preview__placeholder">Generate a spritesheet to see the animation</span>
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
