<script setup lang="ts">
import { ref } from "vue";
import { useStudio } from "../studio/context";

const studio = useStudio();
const open = ref(false);
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <span class="app-header__logo" aria-hidden="true">
        <span v-for="index in 9" :key="index" />
      </span>
      <span class="app-header__title">SpriteSheetStudio</span>
    </div>
    <div class="app-header__actions">
      <button
        v-if="studio.state.save.phase !== 'idle'"
        class="save-indicator"
        type="button"
        @click="studio.actions.retrySave"
      >
        {{ studio.state.save.phase === "saving" ? "Saving…" : studio.state.save.phase === "saved" ? "Saved" : "Not saved · Retry" }}
      </button>
      <div class="load-menu-wrap">
        <button
          class="btn btn--secondary btn--sm project-select"
          type="button"
          data-project-select
          :aria-expanded="open"
          aria-haspopup="menu"
          @click="open = !open"
        >
          <span class="project-select__label">{{ studio.state.project?.label ?? "Loading…" }}</span>
          <svg
            class="project-select__chevron"
            :class="{ 'is-open': open }"
            data-project-chevron
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="16"
            height="16"
          >
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="load-menu" :class="{ 'is-open': open }">
          <div
            v-for="project in studio.projects"
            :key="project.id"
            class="load-menu__row"
            :class="{ 'is-current': project.id === studio.state.project?.id }"
          >
            <button class="load-menu__item" type="button" @click="studio.actions.switchProject(project.id); open = false">
              <span class="load-menu__name">{{ project.label }}</span>
              <span class="load-menu__time">{{ new Date(project.createdAt).toLocaleString() }}</span>
            </button>
            <button class="load-menu__rename" type="button" :aria-label="`Rename ${project.label}`" @click="studio.actions.renameProject(project.id)">✎</button>
            <button class="load-menu__delete" type="button" :aria-label="`Delete ${project.label}`" @click="studio.actions.deleteProject(project.id)">×</button>
          </div>
          <div class="load-menu__separator" />
          <button class="load-menu__create" type="button" @click="studio.actions.createProject(); open = false">＋ Create new</button>
        </div>
      </div>
    </div>
  </header>
</template>
