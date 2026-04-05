<template>
  <div class="status-card card">
    <div class="stat-number">{{ value }}</div>
    <div class="stat-label">{{ label }}</div>
    <div v-if="sub" class="sub-text">{{ sub }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string | number
  label: string
  sub?: string
}>()
</script>

<style scoped>
.status-card {
  min-width: 120px;
  text-align: center;
}

.sub-text {
  margin-top: var(--sp-2);
  font-size: 11px;
  color: var(--color-text-subtle);
  word-break: break-all;
}
</style>
