<template>
  <div class="app-shell">
    <NavBar />
    <main class="app-main">
      <div class="page-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import NavBar from './components/NavBar.vue'
</script>
