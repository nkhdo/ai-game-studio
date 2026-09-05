<script setup lang="ts">
import { Menu } from "floating-vue";
import { onBeforeUnmount, ref, watch } from "vue";
const props = defineProps<{ frames: readonly string[]; disabled?: boolean }>();
const open = ref(false);
const preview = ref<{ src: string; label: string } | null>(null);
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function clearTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
}

function dismiss() {
  clearTimers();
  open.value = false;
}

function showFrame(index: number) {
  clearTimers();
  const src = props.frames[index];
  if (props.disabled || !src) return;
  preview.value = { src, label: `Frame ${index + 1}` };
  if (!open.value) showTimer = setTimeout(() => { open.value = true; }, 500);
}

function hidePreview() {
  clearTimers();
  if (open.value) hideTimer = setTimeout(dismiss, 100);
}

watch(() => props.frames, dismiss);
watch(() => props.disabled, (disabled) => { if (disabled) dismiss(); });
onBeforeUnmount(clearTimers);
watch(open, (shown, _, onCleanup) => {
  if (!shown) { clearTimers(); return; }
  const onKeydown = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
  document.addEventListener("keydown", onKeydown);
  onCleanup(() => document.removeEventListener("keydown", onKeydown));
});
</script>

<template>
  <Menu v-model:shown="open" container="body" placement="left-start"
    :distance="8" :delay="0" :triggers="[]"
    :popper-triggers="[]" :instant-move="false" :auto-hide="false"
    :disabled="disabled" :no-auto-focus="true" popper-class="studio-popover frame-preview-popover" :handle-resize="true">
    <slot :show-frame="showFrame" :hide-preview="hidePreview" />
    <template #popper>
      <div v-if="preview" class="frame-preview" role="region" :aria-label="`${preview.label}, full-size preview`"
        @mouseenter="dismiss">
        <div class="frame-preview__label">{{ preview.label }}</div>
        <img :src="preview.src" :alt="`${preview.label}, full-size preview`" />
      </div>
    </template>
  </Menu>
</template>
