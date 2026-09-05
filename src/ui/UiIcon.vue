<script setup lang="ts">
defineProps<{ name: "plus" | "minus" | "play" | "pause" }>();
</script>

<template>
  <svg
    class="ui-icon"
    :data-icon="name"
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="16"
    height="16"
  >
    <path
      v-if="name === 'plus'"
      d="M8 3v10M3 8h10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'minus'"
      d="M3 8h10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'play'"
      d="M5.5 3.5 12 8l-6.5 4.5z"
      fill="currentColor"
    />
    <template v-else>
      <path d="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" fill="currentColor" />
    </template>
  </svg>
</template>
