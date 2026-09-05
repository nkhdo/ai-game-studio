<script setup lang="ts">
import { computed } from "vue";
import { useStudio } from "../studio/context";
import BaseButton from "../ui/BaseButton.vue";
import BaseStatus from "../ui/BaseStatus.vue";
import FileDropzone from "../ui/FileDropzone.vue";
import UiIcon from "../ui/UiIcon.vue";
import AcquisitionGeometryFields from "./AcquisitionGeometryFields.vue";

const studio = useStudio();
const operation = computed(() => studio.state.operations.reference);
const styleOperation = computed(() => studio.state.operations.styleGuide);
const imageModel = computed(() => studio.imageModels.find(({ id }) => id === studio.state.draft.spriteModel));
const guideLimit = computed(() => Math.min(3, imageModel.value?.maxStyleGuideImages ?? 0));
const busy = computed(() => operation.value.phase === "running");

function addStyleGuides(event: Event) {
  const input = event.target as HTMLInputElement;
  void studio.actions.addStyleGuides([...(input.files ?? [])]);
  input.value = "";
}
</script>

<template>
  <section class="card accordion-item" :class="{ 'is-open': studio.activePanel === 'reference' }">
    <button class="accordion-trigger" type="button" :aria-expanded="studio.activePanel === 'reference'" @click="studio.actions.setPanel('reference')">
      <span>Reference Sprite</span><span class="accordion-trigger__icon" aria-hidden="true" />
    </button>
    <div class="panel-body">
      <div class="mode-switch" role="group" aria-label="Reference Sprite Acquisition method">
        <button class="mode-switch__button" :class="{ 'is-active': studio.state.draft.spriteAcquisitionMode === 'generate' }" type="button" @click="studio.state.draft.spriteAcquisitionMode = 'generate'">Generate</button>
        <button class="mode-switch__button" :class="{ 'is-active': studio.state.draft.spriteAcquisitionMode === 'upload' }" type="button" @click="studio.state.draft.spriteAcquisitionMode = 'upload'">Upload</button>
      </div>

      <div v-if="studio.state.draft.spriteAcquisitionMode === 'generate'" class="acquisition-panel">
        <div class="field" data-form-row="prompt">
          <label class="field__label" for="sprite-prompt">Reference Sprite Prompt</label>
          <textarea id="sprite-prompt" v-model="studio.state.draft.spritePrompt" class="textarea" rows="3" placeholder="Describe the character or object…" />
        </div>
        <div class="field" data-form-row="model"><label class="field__label" for="sprite-model">Model</label><select id="sprite-model" v-model="studio.state.draft.spriteModel" class="select"><option v-for="model in studio.imageModels" :key="model.id" :value="model.id">{{ model.label }}</option></select></div>
        <AcquisitionGeometryFields data-form-row="geometry" />
        <div class="style-guide-field" data-form-row="style-guides">
          <div class="style-guide-field__header">
            <span class="field__label">Style Guide Images · optional</span>
            <span class="style-guide-field__count">{{ studio.state.project?.styleGuides.length ?? 0 }}/{{ guideLimit }}</span>
          </div>
          <div class="style-guide-list">
            <div v-for="guide in studio.state.project?.styleGuides" :key="guide.id" class="style-guide-thumb">
              <img :src="guide.url" alt="" />
              <button class="style-guide-thumb__remove" type="button" :aria-label="`Remove ${guide.originalFilename}`" @click="studio.actions.removeStyleGuide(guide.id)">×</button>
            </div>
            <label
              v-if="(studio.state.project?.styleGuides.length ?? 0) < guideLimit"
              class="style-guide-add"
              :class="{ 'is-disabled': styleOperation.phase === 'running' }"
              for="style-guides"
              aria-label="Add Style Guide Images"
            >
              <input
                id="style-guides"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                :disabled="styleOperation.phase === 'running'"
                @change="addStyleGuides"
              />
              <UiIcon name="plus" />
            </label>
          </div>
          <BaseStatus :message="styleOperation.message" :kind="styleOperation.phase === 'error' ? 'error' : styleOperation.phase === 'success' ? 'success' : 'info'" :busy="styleOperation.phase === 'running'" />
        </div>
        <label class="style-match-row" data-form-row="palette-lock"><input v-model="studio.state.draft.spritePaletteLock" type="checkbox" :disabled="!studio.state.project?.styleGuides.length" /><span class="style-match-row__text"><span class="style-match-row__title">Palette Lock</span><span class="style-match-row__hint">Restrict colors to the Style Guide Images’ palette</span></span></label>
        <BaseButton data-form-row="generate" variant="primary" block :busy="busy" :disabled="!studio.hasApiKey" @click="studio.actions.generateReference">Generate Reference Sprite</BaseButton>
      </div>
      <div v-else class="acquisition-panel">
        <FileDropzone input-id="reference-upload" accept="image/png,image/jpeg,image/webp" label="Drop an image here or choose a file" hint="PNG, JPEG, or WebP · max 10 MB" :disabled="busy" @files="studio.actions.uploadReference" />
        <AcquisitionGeometryFields />
      </div>
      <BaseStatus v-if="!studio.hasApiKey && studio.state.draft.spriteAcquisitionMode === 'generate'" message="OPENROUTER_API_KEY is missing. Upload still works without it." kind="error" />
      <BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" :busy="busy" />
      <div class="preview">
        <div class="preview__label">Reference Sprite</div>
        <div class="preview__box"><img v-if="studio.state.project?.spriteUrl" :src="studio.state.project.spriteUrl" alt="Reference Sprite" /><span v-else class="preview__placeholder">No sprite yet</span></div>
        <div class="preview__caption">{{ studio.state.project?.spriteDimensions ? `${studio.state.project.spriteDimensions.w} × ${studio.state.project.spriteDimensions.h} px` : "—" }}</div>
        <div v-if="studio.state.project?.backgroundSuitability === 'warning'" class="background-warning">Background may not key cleanly. Use a flat #00b140 background.</div>
      </div>
    </div>
  </section>
</template>
