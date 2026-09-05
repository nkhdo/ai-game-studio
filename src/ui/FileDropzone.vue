<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  inputId: string;
}>(), { multiple: false, disabled: false });

const emit = defineEmits<{ files: [files: File[]] }>();
const dragging = ref(false);

function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  emit("files", [...(input.files ?? [])]);
  input.value = "";
}

function drop(event: DragEvent) {
  dragging.value = false;
  if (!props.disabled) emit("files", [...(event.dataTransfer?.files ?? [])]);
}
</script>

<template>
  <label
    class="upload-dropzone"
    :class="{ 'is-dragging': dragging, 'is-disabled': disabled }"
    :for="inputId"
    :aria-disabled="disabled"
    @dragenter.prevent="dragging = !disabled"
    @dragover.prevent
    @dragleave.prevent="dragging = false"
    @drop.prevent="drop"
  >
    <input
      :id="inputId"
      class="visually-hidden"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="choose"
    />
    <span class="upload-dropzone__title">{{ label }}</span>
    <span class="upload-dropzone__hint">{{ hint }}</span>
  </label>
</template>
