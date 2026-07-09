<script setup lang="ts">
import { usePlayerStore } from "~/stores/player"

// Load the voice catalog once on app start so a default voice is selected
// before the user hits "Play" (the PlayerBar only mounts during playback).
const player = usePlayerStore()
onMounted(() => player.loadCatalog())
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
