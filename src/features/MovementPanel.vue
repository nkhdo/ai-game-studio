<script setup lang="ts">
import { computed } from "vue";
import { useStudio } from "../studio/context";
import BaseButton from "../ui/BaseButton.vue";
import BaseStatus from "../ui/BaseStatus.vue";
const studio = useStudio();
const operation = computed(() => studio.state.operations.video);
const model = computed(() => studio.videoModels.find(({ id }) => id === studio.state.draft.motionModel));
</script>
<template>
  <section class="card movement-step accordion-item" :class="{ 'is-open': studio.activePanel === 'movement' }">
    <button class="accordion-trigger" type="button" :aria-expanded="studio.activePanel === 'movement'" @click="studio.actions.setPanel('movement')"><span>Generate Video</span><span class="accordion-trigger__icon" /></button>
    <div class="panel-body">
      <div class="field"><label class="field__label" for="motion-prompt">Movement Prompt</label><textarea id="motion-prompt" v-model="studio.state.draft.motionPrompt" class="textarea" rows="3" placeholder="e.g., walking left, jump, attack right…" /></div>
      <div class="motion-controls">
        <div class="field motion-controls__model"><label class="field__label" for="motion-model">Model</label><select id="motion-model" v-model="studio.state.draft.motionModel" class="select"><option v-for="option in studio.videoModels" :key="option.id" :value="option.id">{{ option.label }}</option></select></div>
        <BaseButton :busy="operation.phase === 'running'" :disabled="!studio.hasApiKey || !studio.state.project?.spriteUrl" @click="studio.actions.generateVideo">Generate Video</BaseButton>
      </div>
      <div class="geometry-hint">{{ model?.inputMode === "first-frame" ? "Exact first frame" : "Reference guidance" }}<template v-if="model?.constraintNote"> · {{ model.constraintNote }}</template></div>
      <BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" :busy="operation.phase === 'running'" />
      <div class="motion-video-section"><div class="motion-video-section__label">Generated Video</div><div class="motion-video-preview"><video v-if="studio.state.project?.sourceVideoUrl" :src="studio.state.project.sourceVideoUrl" aria-label="Generated movement video" controls loop playsinline /><span v-else class="motion-video-preview__placeholder">Generate a video to preview it here</span></div></div>
    </div>
  </section>
</template>
