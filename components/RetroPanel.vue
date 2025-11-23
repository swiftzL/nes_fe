<template>
  <section class="retro-panel">
    <header v-if="$slots.title || title" class="retro-panel__title">
      <slot name="title">{{ title }}</slot>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: '' })
</script>
