<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { Dropdown } from "floating-vue";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  disabled?: boolean;
  triggerClass?: string;
  menuClass?: string;
  placement?: "bottom-start" | "bottom-end";
}>(), { placement: "bottom-start" });
const open = ref(false);
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const id = useId();
let focusPosition: "first" | "last" = "first";

function close(returnFocus = true) {
  open.value = false;
  if (returnFocus) void nextTick(() => trigger.value?.focus());
}

function items() {
  return [...(menu.value?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? [])];
}

function focusItem() {
  if (!open.value) return;
  const buttons = items();
  buttons[focusPosition === "first" ? 0 : buttons.length - 1]?.focus();
}

function show(position: "first" | "last" = "first") {
  if (props.disabled) return;
  focusPosition = position;
  open.value = true;
  void nextTick(focusItem);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (event.key === "Tab") { trigger.value?.focus(); close(false); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = items();
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[target]?.focus();
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node;
  if (!trigger.value?.contains(target) && !menu.value?.contains(target)) close(false);
}

watch(() => props.disabled, (disabled) => { if (disabled) close(false); });
onMounted(() => document.addEventListener("pointerdown", onOutsidePointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onOutsidePointer));
</script>

<template>
  <Dropdown v-model:shown="open" :triggers="[]" :placement="placement" :distance="6"
    :disabled="disabled" :no-auto-focus="true" :aria-id="`${id}-popover`"
    popper-class="studio-popover" @apply-show="focusItem">
    <button :id="`${id}-trigger`" ref="trigger" v-bind="$attrs" type="button" :class="triggerClass"
      :disabled="disabled" aria-haspopup="menu" :aria-expanded="open" :aria-controls="`${id}-menu`"
      @click="open ? close() : show()" @keydown.down.prevent="show('first')"
      @keydown.up.prevent="show('last')" @keydown.esc.prevent="close()">
      <slot name="trigger" :open="open" />
    </button>
    <template #popper>
      <div :id="`${id}-menu`" ref="menu" class="ui-dropdown__menu" :class="menuClass" role="menu"
        :aria-labelledby="`${id}-trigger`" @keydown="onKeydown">
        <slot :close="close" />
      </div>
    </template>
  </Dropdown>
</template>
