<script setup lang="ts">
import type { Paragraph, WordNote } from "@voxic/core"

const props = defineProps<{
  paragraph: Paragraph
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
  <p>
    <template v-for="(sentence, si) in paragraph.sentences" :key="si">
      <template v-for="(token, ti) in sentence.tokens" :key="`${si}-${ti}`">
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
    </template>
  </p>
</template>
