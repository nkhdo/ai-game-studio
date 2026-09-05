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
const previewExpanded = ref(false);
let timer: number | null = null;
const frames = computed(() => studio.frameUrls);
function restart() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  if (position.value >= frames.value.length) position.value = 0;
  if (playing.value && frames.value.length > 1) timer = window.setInterval(() => {
    position.value = (position.value + 1) % frames.value.length;
  }, Math.max(16, Math.round(1000 / studio.state.draft.animationFps)));
}
function showAdjacentFrame(offset: number) {
  playing.value = false;
  if (!frames.value.length) return;
  position.value = (position.value + offset + frames.value.length) % frames.value.length;
}
function save() {
  return studio.actions.saveAnimation(Boolean(studio.state.animationDraft.activeAnimationId));
}
watch([frames, playing, () => studio.state.draft.animationFps], restart, { immediate: true });
onBeforeUnmount(() => { if (timer !== null) window.clearInterval(timer); });
</script>
<template>
  <section class="card">
    <h2 class="card__title">Animations</h2>
    <div class="panel-body">
      <div class="animation-workspace">
      <aside class="animations-library" aria-label="Saved Animations">
        <div class="animations-library__header">
          <div class="gif-section__label">Saved Animations</div>
          <button class="btn btn--link btn--sm" type="button" @click="studio.actions.activateAnimation(null)">New Draft</button>
        </div>
        <div class="animations-list">
          <div v-if="!studio.state.project?.animations.length" class="gif-preview__placeholder">
            No saved Animations yet
          </div>
          <div
            v-for="animation in studio.state.project?.animations"
            :key="animation.id"
            class="animation-row"
            :class="{ 'is-active': animation.id === studio.state.animationDraft.activeAnimationId }"
          >
            <button
              class="animation-row__select"
              type="button"
              :aria-pressed="animation.id === studio.state.animationDraft.activeAnimationId"
              @click="studio.actions.activateAnimation(animation.id)"
            >
              <span class="animation-row__title">{{ animation.name }}</span>
              <span class="animation-row__meta">
                {{ animation.frameUrls.length }} frames · {{ animation.fps }} FPS
              </span>
            </button>
            <div class="animation-row__actions">
              <button class="btn btn--link btn--sm" type="button" @click="studio.actions.exportAnimation(animation.id)">Export</button>
              <button class="btn btn--link btn--sm" type="button" @click="studio.actions.deleteAnimation(animation.id)">Delete</button>
            </div>
          </div>
        </div>
      </aside>
      <div class="animation-edit-pane" :class="{ 'is-preview-expanded': previewExpanded }">
        <div class="frames-section">
          <div class="frames-section__header">
            <div class="frames-section__label">Select frames for this Animation</div>
            <div class="frames-section__actions">
              <button class="btn btn--link btn--sm" type="button" @click="studio.actions.selectAll">Select All</button>
              <button class="btn btn--link btn--sm" type="button" @click="studio.actions.selectNone">Deselect All</button>
            </div>
          </div>
          <div class="frames-grid">
            <button
              v-for="(frame, index) in studio.state.project?.frames"
              :key="frame"
              class="frame-tile"
              :class="{ 'is-selected': studio.state.animationDraft.frameSequence.includes(index) }"
              type="button"
              :aria-pressed="studio.state.animationDraft.frameSequence.includes(index)"
              @click="studio.actions.toggleFrame(index)"
            >
              <div class="frame-tile__num">{{ index + 1 }}</div>
              <img :src="frame" :alt="`Frame ${index + 1}`">
            </button>
            <button
              v-for="index in studio.state.project?.frames.length ? 0 : 8"
              :key="`empty-${index}`"
              class="frame-tile is-empty"
              type="button"
              disabled
            >
              <div class="frame-tile__num">{{ index }}</div>
            </button>
          </div>
        </div>
        <div class="animation-editor">
          <div class="quick-preview__header">
            <div class="quick-preview__title"><div class="gif-section__label">Quick Preview</div><span class="quick-preview__count">{{ frames.length }} {{ frames.length === 1 ? "frame" : "frames" }}</span></div>
            <div class="quick-preview__header-actions">
              <label class="quick-preview__field quick-preview__field--name">
                <span>Name</span>
                <input v-model="studio.state.draft.animationName" class="input" maxlength="40" placeholder="e.g., run" />
              </label>
              <label class="quick-preview__field quick-preview__field--fps">
                <span>FPS</span>
                <input v-model.number="studio.state.draft.animationFps" class="input" type="number" min="1" max="60" />
              </label>
              <div class="animation-save-split">
                <BaseButton variant="primary" :busy="operation.phase === 'running'" :disabled="!frames.length" @click="save">Save</BaseButton>
                <BaseButton :disabled="!frames.length || operation.phase === 'running'" @click="studio.actions.saveAnimation(false)">Save as</BaseButton>
              </div>
            </div>
          </div>
          <div class="gif-preview quick-preview">
            <div class="quick-preview__stage"><img v-if="frames.length" :src="frames[position] ?? frames[0]" alt="Quick Animation preview" :style="{ transform: `scale(${zoom})` }" /><span v-else class="gif-preview__placeholder">Select frames to preview immediately</span></div>
            <div class="quick-preview__overlay quick-preview__overlay--right quick-preview__controls">
              <div class="quick-preview__control-group">
                <button class="quick-preview__action" type="button" :aria-label="playing ? 'Pause preview' : 'Play preview'" @click="playing = !playing"><UiIcon :name="playing ? 'pause' : 'play'" /></button>
              </div>
              <div class="quick-preview__control-group">
                <button class="quick-preview__action" type="button" aria-label="Zoom in" :disabled="zoom >= 4" @click="zoom = Math.min(4, zoom + .25)"><UiIcon name="plus" /></button>
                <button class="quick-preview__action quick-preview__zoom" type="button" aria-label="Reset zoom" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</button>
                <button class="quick-preview__action" type="button" aria-label="Zoom out" :disabled="zoom <= .5" @click="zoom = Math.max(.5, zoom - .25)"><UiIcon name="minus" /></button>
              </div>
              <div class="quick-preview__control-group">
                <button class="quick-preview__action" type="button" aria-label="Previous frame" :disabled="!frames.length" @click="showAdjacentFrame(-1)"><UiIcon name="previous" /></button>
                <span class="quick-preview__position">{{ frames.length ? position + 1 : 0 }} / {{ frames.length }}</span>
                <button class="quick-preview__action" type="button" aria-label="Next frame" :disabled="!frames.length" @click="showAdjacentFrame(1)"><UiIcon name="next" /></button>
              </div>
              <div class="quick-preview__control-group">
                <button class="quick-preview__action" type="button" :aria-label="previewExpanded ? 'Collapse preview' : 'Expand preview'" :aria-pressed="previewExpanded" @click="previewExpanded = !previewExpanded"><UiIcon :name="previewExpanded ? 'collapse' : 'expand'" /></button>
              </div>
            </div>
          </div>
          <BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" />
        </div>
      </div>
      </div>
    </div>
  </section>
</template>
