<script setup lang="ts">
import { provide } from "vue";
import { useRoute, useRouter } from "vue-router";
import AnimationWorkspace from "./features/AnimationWorkspace.vue";
import FramesPanel from "./features/FramesPanel.vue";
import MovementPanel from "./features/MovementPanel.vue";
import ProjectHeader from "./features/ProjectHeader.vue";
import ReferenceSpritePanel from "./features/ReferenceSpritePanel.vue";
import { studioKey } from "./studio/context";
import { createStudioController } from "./studio/controller";
import { productionDependencies } from "./studio/dependencies";

const studio = createStudioController(useRouter(), useRoute(), productionDependencies());
provide(studioKey, studio);
</script>

<template>
  <div class="app">
    <ProjectHeader />
    <main class="app-main">
      <div v-if="studio.bootError" class="status status--error" role="alert">{{ studio.bootError }}</div>
      <div v-else-if="!studio.ready" class="status" role="status"><span class="spinner" /> Loading studio…</div>
      <div v-else class="columns">
        <div class="workflow-accordion">
          <ReferenceSpritePanel />
          <MovementPanel />
          <FramesPanel />
        </div>
        <AnimationWorkspace />
      </div>
    </main>
    <div class="toast" :class="[`toast--${studio.toast.kind}`, { 'is-visible': studio.toast.message }]" role="status" aria-live="polite">{{ studio.toast.message }}</div>
  </div>
</template>
