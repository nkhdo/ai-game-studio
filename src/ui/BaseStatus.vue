<script setup lang="ts">
withDefaults(defineProps<{
  message?: string;
  kind?: "info" | "success" | "error";
  busy?: boolean;
}>(), { message: "", kind: "info", busy: false });
</script>

<template>
  <div
    v-if="message"
    class="status"
    :class="{ 'status--success': kind === 'success', 'status--error': kind === 'error' }"
    :role="kind === 'error' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <span v-if="busy" class="spinner" aria-hidden="true" />
    {{ message }}
  </div>
</template>
