<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useStudio } from "../studio/context";
import { currentTheme, toggleTheme } from "../theme";
import UiIcon from "../ui/UiIcon.vue";

const studio = useStudio();
const open = ref(false);
const menuWrap = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);

function close(returnFocus = false) {
  open.value = false;
  if (returnFocus) void nextTick(() => trigger.value?.focus());
}

async function openAndFocus(position: "first" | "last" = "first") {
  open.value = true;
  await nextTick();
  const items = [...(menu.value?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
  items[position === "first" ? 0 : items.length - 1]?.focus();
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") { event.preventDefault(); close(true); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = [...(menu.value?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
  if (!items.length) return;
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const target = event.key === "Home" ? 0
    : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
  items[target]?.focus();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!menuWrap.value?.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown));
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <span class="app-header__logo" aria-hidden="true">
        <span v-for="index in 9" :key="index" />
      </span>
      <span class="app-header__title">SpriteSheetStudio</span>
      <div ref="menuWrap" class="load-menu-wrap">
        <button
          ref="trigger"
          class="btn btn--secondary btn--sm project-select"
          type="button"
          data-project-select
          :aria-expanded="open"
          aria-haspopup="menu"
          @click="open = !open"
          @keydown.down.prevent="openAndFocus('first')"
          @keydown.up.prevent="openAndFocus('last')"
        >
          <span class="project-select__label">{{ studio.state.project?.label ?? "Loading…" }}</span>
          <UiIcon
            name="chevron-down"
            class="project-select__chevron"
            :class="{ 'is-open': open }"
            data-project-chevron
          />
        </button>
        <div ref="menu" class="load-menu" :class="{ 'is-open': open }" role="menu" @keydown="onMenuKeydown">
          <div
            v-for="project in studio.projects"
            :key="project.id"
            class="load-menu__row"
            role="none"
            :class="{ 'is-current': project.id === studio.state.project?.id }"
          >
            <button
              class="load-menu__item"
              role="menuitem"
              type="button"
              @click="studio.actions.switchProject(project.id); close()"
            >
              <span class="load-menu__name">{{ project.label }}</span>
              <span class="load-menu__time">{{ new Date(project.createdAt).toLocaleString() }}</span>
            </button>
            <button
              class="load-menu__rename"
              role="menuitem"
              type="button"
              :aria-label="`Rename ${project.label}`"
              @click="studio.actions.renameProject(project.id)"
            ><UiIcon name="edit" /></button>
            <button
              class="load-menu__delete"
              role="menuitem"
              type="button"
              :aria-label="`Delete ${project.label}`"
              @click="studio.actions.deleteProject(project.id)"
            ><UiIcon name="trash" /></button>
          </div>
          <div class="load-menu__separator" />
          <button
            class="load-menu__create"
            role="menuitem"
            type="button"
            @click="studio.actions.createProject(); close()"
          >
            <UiIcon name="plus" /> Create new
          </button>
        </div>
      </div>
      <button
        v-if="studio.state.save.phase !== 'idle'"
        class="save-indicator"
        type="button"
        @click="studio.actions.retrySave"
      >
        {{ studio.state.save.phase === "saving"
          ? "Saving…"
          : studio.state.save.phase === "saved" ? "Saved" : "Not saved · Retry" }}
      </button>
    </div>
    <div class="app-header__actions">
      <button
        class="theme-toggle"
        type="button"
        aria-label="Dark mode"
        :aria-pressed="currentTheme === 'dark'"
        :title="currentTheme === 'dark' ? 'Use light mode' : 'Use dark mode'"
        @click="toggleTheme"
      >
        <UiIcon :name="currentTheme === 'dark' ? 'sun' : 'moon'" />
      </button>
    </div>
  </header>
</template>
