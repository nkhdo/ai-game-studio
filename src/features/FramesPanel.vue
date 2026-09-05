<script setup lang="ts">
import { computed } from "vue";
import { useStudio } from "../studio/context";
import BaseButton from "../ui/BaseButton.vue";
import BaseStatus from "../ui/BaseStatus.vue";
const studio = useStudio();
const operation = computed(() => studio.state.operations.frames);
const diagnostics = computed(() => [
  studio.state.project?.preservedOffPalettePixels != null ? `${studio.state.project.preservedOffPalettePixels} uncertain-color pixels preserved` : null,
  studio.state.project?.removedLowAlphaPixels != null ? `${studio.state.project.removedLowAlphaPixels} low-alpha pixels removed` : null,
  studio.state.project?.removedChromaFringePixels != null ? `${studio.state.project.removedChromaFringePixels} chroma-fringe pixels removed` : null,
].filter(Boolean).join(" · "));
</script>
<template>
  <section class="card movement-step accordion-item" :class="{ 'is-open': studio.activePanel === 'frames' }">
    <button class="accordion-trigger" type="button" :aria-expanded="studio.activePanel === 'frames'" @click="studio.actions.setPanel('frames')"><span>Generate Frames</span><span class="accordion-trigger__icon" /></button>
    <div class="panel-body">
      <label class="style-match-row"><input v-model="studio.state.draft.paletteLock" type="checkbox" :disabled="!studio.state.project?.sourceVideoUrl" /><span class="style-match-row__text"><span class="style-match-row__title">Palette Lock</span><span class="style-match-row__hint">Restrict colors to the Reference Sprite’s palette</span></span></label>
      <label class="style-match-row"><input v-model="studio.state.draft.hardAlphaEdges" type="checkbox" :disabled="!studio.state.project?.sourceVideoUrl" /><span class="style-match-row__text"><span class="style-match-row__title">Hard Alpha Edges</span><span class="style-match-row__hint">Use fully opaque or fully transparent pixels</span></span></label>
      <BaseButton variant="primary" block :busy="operation.phase === 'running'" :disabled="!studio.state.project?.sourceVideoUrl" @click="studio.actions.generateFrames">Generate Frames</BaseButton>
      <div v-if="diagnostics" class="geometry-hint">Current frames: {{ diagnostics }}</div>
      <BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" :busy="operation.phase === 'running'" />
    </div>
  </section>
</template>
