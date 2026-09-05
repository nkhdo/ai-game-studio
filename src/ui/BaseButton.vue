<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "primary" | "secondary" | "link";
  block?: boolean;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}>(), { variant: "secondary", block: false, busy: false, disabled: false, type: "button" });

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, { 'btn--block': block }]"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy"
    @click="$emit('click', $event)"
  >
    <span v-if="busy" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>
