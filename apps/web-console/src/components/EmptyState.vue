<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="subtitle" class="empty-subtitle">{{ subtitle }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  subtitle?: string
}>(), {
  icon: '📭',
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--sp-10) var(--sp-6);
  text-align: center;
  gap: var(--sp-3);
}

.empty-icon { font-size: 32px; }
.empty-title { font-size: 15px; color: var(--color-text-muted); font-weight: 500; }
.empty-subtitle { font-size: 13px; color: var(--color-text-subtle); }
</style>
