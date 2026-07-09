<script setup lang="ts">
import type { Token, WordNote } from "@voxic/core"

const props = defineProps<{
  tokens: Token[]
  noteIndex: Record<string, WordNote>
}>()
const emit = defineEmits<{
  "word-click": [payload: { word: string; note: WordNote | null; x: number; y: number }]
}>()

function onClick(e: MouseEvent, key: string | undefined) {
  if (!key) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  emit("word-click", {
    word: key,
    note: props.noteIndex[key] ?? null,
    x: rect.left + rect.width / 2,
    y: rect.bottom,
  })
}
</script>

<template>
  <h2 class="part-title text-xl font-semibold mb-3">
    <template v-for="(token, ti) in tokens" :key="ti">
      <span v-if="token.type === 'space'">{{ token.value }}</span>
      <span v-else-if="token.type === 'emoji'" class="text-base align-middle">{{ token.value }}</span>
      <span v-else-if="token.type === 'punct'">{{ token.value }}</span>
      <button
        v-else
        class="word-btn"
        :data-target="token.target ?? undefined"
        @click="onClick($event, token.key)"
      >{{ token.value }}</button>
    </template>
  </h2>
</template>
