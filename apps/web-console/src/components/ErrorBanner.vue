<template>
  <div v-if="message" class="error-banner">
    <span class="error-icon">⚠️</span>
    <span class="error-message">{{ message }}</span>
    <button class="close-btn" @click="$emit('dismiss')">✕</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message?: string }>()
defineEmits<{ (e: 'dismiss'): void }>()
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-4);
  color: var(--color-error);
  font-size: 13px;
}

.error-message { flex: 1; }

.close-btn {
  background: none;
  border: none;
  color: var(--color-error);
  padding: 0;
  font-size: 12px;
  cursor: pointer;
  opacity: 0.7;
}

.close-btn:hover { opacity: 1; }
</style>
