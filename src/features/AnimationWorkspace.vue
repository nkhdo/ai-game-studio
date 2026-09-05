<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStudio } from "../studio/context";
import BaseButton from "../ui/BaseButton.vue";
import BaseStatus from "../ui/BaseStatus.vue";
import UiIcon from "../ui/UiIcon.vue";
const studio = useStudio();
const operation = computed(() => studio.state.operations.animation);
const playing = ref(false);
const position = ref(0);
const zoom = ref(1);
let timer: number | null = null;
const frames = computed(() => studio.frameUrls);
function restart() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  position.value = 0;
  if (playing.value && frames.value.length > 1) timer = window.setInterval(() => {
    position.value = (position.value + 1) % frames.value.length;
  }, Math.max(16, Math.round(1000 / studio.state.draft.animationFps)));
}
watch([frames, playing, () => studio.state.draft.animationFps], restart, { immediate: true });
onBeforeUnmount(() => { if (timer !== null) window.clearInterval(timer); });
</script>
<template>
  <section class="card">
    <h2 class="card__title">4. Animations</h2>
    <div class="panel-body"><div class="animation-workspace">
      <aside class="animations-library" aria-label="Saved Animations">
        <div class="gif-section__label">Saved Animations</div>
        <div class="animations-list">
          <div v-if="!studio.state.project?.animations.length" class="gif-preview__placeholder">No saved Animations yet</div>
          <div v-for="animation in studio.state.project?.animations" :key="animation.id" class="animation-row" :class="{ 'is-active': animation.id === studio.state.animationDraft.activeAnimationId }">
            <div class="animation-row__title">{{ animation.name }}</div><div class="animation-row__meta">{{ animation.frameUrls.length }} frames · {{ animation.fps }} FPS</div>
            <div class="animation-row__actions"><button class="btn btn--link btn--sm" type="button" @click="studio.actions.activateAnimation(animation.id)">Edit</button><button class="btn btn--link btn--sm" type="button" @click="studio.actions.exportAnimation(animation.id)">Export</button><button class="btn btn--link btn--sm" type="button" @click="studio.actions.deleteAnimation(animation.id)">Delete</button></div>
          </div>
        </div>
      </aside>
      <div class="animation-edit-pane">
        <div class="frames-section"><div class="frames-section__header"><div class="frames-section__label">Select frames for this Animation</div><div class="frames-section__actions"><button class="btn btn--link btn--sm" type="button" @click="studio.actions.selectAll">Select All</button><button class="btn btn--link btn--sm" type="button" @click="studio.actions.selectNone">Deselect All</button></div></div>
          <div class="frames-grid">
            <button v-for="(frame,index) in studio.state.project?.frames" :key="frame" class="frame-tile" :class="{ 'is-selected': studio.state.animationDraft.frameSequence.includes(index) }" type="button" :aria-pressed="studio.state.animationDraft.frameSequence.includes(index)" @click="studio.actions.toggleFrame(index)"><div class="frame-tile__num">{{ index + 1 }}</div><img :src="frame" :alt="`Frame ${index + 1}`" /></button>
            <button v-for="index in studio.state.project?.frames.length ? 0 : 8" :key="`empty-${index}`" class="frame-tile is-empty" type="button" disabled><div class="frame-tile__num">{{ index }}</div></button>
          </div>
        </div>
        <div class="animation-editor">
          <div class="animation-editor__header"><div class="field animation-editor__name"><label class="field__label">Animation name</label><input v-model="studio.state.draft.animationName" class="input" maxlength="40" placeholder="e.g., run" /></div><div class="field animation-editor__fps"><label class="field__label">FPS</label><input v-model.number="studio.state.draft.animationFps" class="input" type="number" min="1" max="60" /></div></div>
          <div class="quick-preview__header"><div class="quick-preview__title"><div class="gif-section__label">Quick Preview</div><span class="quick-preview__count">{{ frames.length }} {{ frames.length === 1 ? "frame" : "frames" }}</span></div></div>
          <div class="gif-preview quick-preview"><div class="quick-preview__stage"><img v-if="frames.length" :src="frames[position] ?? frames[0]" alt="Quick Animation preview" :style="{ transform: `scale(${zoom})` }" /><span v-else class="gif-preview__placeholder">Select frames to preview immediately</span></div><div class="quick-preview__overlay"><span class="quick-preview__position">{{ frames.length ? position + 1 : 0 }} / {{ frames.length }}</span><button class="quick-preview__action" type="button" aria-label="Zoom out" :disabled="zoom <= .5" @click="zoom = Math.max(.5, zoom - .25)"><UiIcon name="minus" /></button><button class="quick-preview__action quick-preview__zoom" type="button" aria-label="Reset zoom" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</button><button class="quick-preview__action" type="button" aria-label="Zoom in" :disabled="zoom >= 4" @click="zoom = Math.min(4, zoom + .25)"><UiIcon name="plus" /></button><button class="quick-preview__action quick-preview__play" type="button" :aria-label="playing ? 'Pause preview' : 'Play preview'" @click="playing = !playing"><UiIcon :name="playing ? 'pause' : 'play'" /></button></div></div>
          <div class="animation-editor__actions"><BaseButton variant="primary" :busy="operation.phase === 'running'" :disabled="!frames.length" @click="studio.actions.saveAnimation(false)">Save as New</BaseButton><BaseButton :disabled="!studio.state.animationDraft.activeAnimationId" @click="studio.actions.saveAnimation(true)">Update</BaseButton><BaseButton variant="link" @click="studio.actions.activateAnimation(null)">New Draft</BaseButton><BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" /></div>
        </div>
      </div>
    </div></div>
  </section>
</template>
