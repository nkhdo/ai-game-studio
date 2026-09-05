<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mountApp } from "./app";

const host = ref<HTMLElement | null>(null);

onMounted(() => {
  if (host.value) mountApp(host.value);
});
</script>

<template>
  <div ref="host" />
</template>
