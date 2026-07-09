<script setup lang="ts">
import { useColorMode } from "@vueuse/core"

const colorMode = useColorMode({ attribute: "class", modes: { dark: "dark" } })
const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (v) => (colorMode.value = v ? "dark" : "light"),
})
</script>

<template>
  <div class="app-shell min-h-screen">
    <header class="app-header">
      <NuxtLink to="/" class="brand">📖 Voxic</NuxtLink>
      <div class="header-right">
        <VoiceSelect />
        <button class="btn-ghost text-sm" @click="isDark = !isDark">
          {{ isDark ? "☀" : "☾" }}
        </button>
      </div>
    </header>
    <main class="app-main">
      <slot />
    </main>
    <PlayerBar />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--bg, rgba(255, 255, 255, 0.9));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(120, 130, 150, 0.18);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dark .app-header {
  background: rgba(7, 8, 16, 0.9);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.brand {
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  color: inherit;
}
.app-main {
  flex: 1;
  padding-bottom: 6rem; /* clear the player bar */
}
</style>
