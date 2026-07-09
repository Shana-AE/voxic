<script setup lang="ts">
import type { ArticlesListResponse } from "~/types"

const { data, pending, error } = await useFetch<ArticlesListResponse>("/api/articles")
</script>

<template>
  <div class="home mx-auto max-w-3xl px-4 py-6">
    <ImportPanel class="mb-8" />

    <ArticleList
      v-if="data?.maimemo?.length"
      :items="data.maimemo"
      label="MaiMemo daily stories"
      :nas-error="data.nasError"
    />

    <ArticleList
      v-if="data?.imports?.length"
      :items="data.imports"
      label="Imported texts"
      class="mt-8"
    />

    <p v-if="pending" class="text-sm text-ink-400 mt-4">Loading articles…</p>
    <p v-if="error" class="text-sm text-red-500 mt-4">⚠ {{ error.message }}</p>
  </div>
</template>
