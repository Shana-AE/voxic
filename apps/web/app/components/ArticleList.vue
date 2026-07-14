<script setup lang="ts">
import type { ArticleListItem } from "~/types"
defineProps<{ items: ArticleListItem[]; label: string; nasError?: string | null }>()
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between mb-2">
      <h2 class="text-lg font-semibold">{{ label }}</h2>
      <span class="text-xs text-ink-400">{{ items.length }}</span>
    </div>
    <p v-if="nasError" class="text-sm text-amber-500 mb-2">⚠ {{ nasError }}</p>
    <ul class="article-list">
      <li v-for="a in items" :key="a.id + a.source">
        <div class="article-row">
          <NuxtLink :to="`/read/${encodeURIComponent(a.id)}`" class="article-link">
            <div class="article-title">{{ a.title }}</div>
            <div class="article-meta">
              <span>{{ a.date }}</span>
              <span v-if="a.forgetCount !== undefined" class="chip" style="background:#fde2e2;color:#b91c1c">
                🗑️ {{ a.forgetCount }}
              </span>
              <span v-if="a.vagueCount !== undefined" class="chip" style="background:#fef3c7;color:#92400e">
                🌀 {{ a.vagueCount }}
              </span>
            </div>
          </NuxtLink>
          <NuxtLink
            v-if="a.source === 'maimemo'"
            :to="`/words/${encodeURIComponent(a.date)}`"
            class="cards-link"
            title="Word cards for this day"
          >📋</NuxtLink>
        </div>
      </li>
      <li v-if="!items.length" class="text-sm text-ink-400 py-2">None yet.</li>
    </ul>
  </section>
</template>

<style scoped>
.article-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.article-link {
  display: block;
  padding: 0.6rem 0.5rem;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.12s;
}
.article-link:hover {
  background: rgba(120, 130, 150, 0.1);
}
.article-row {
  display: flex;
  align-items: stretch;
  gap: 0.2rem;
}
.article-link {
  flex: 1;
}
.cards-link {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  text-decoration: none;
  font-size: 1.1rem;
  opacity: 0.6;
  border-radius: 6px;
}
.cards-link:hover {
  opacity: 1;
  background: rgba(120, 130, 150, 0.12);
}
.article-title {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.4;
}
.article-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: #636e80;
}
.dark .article-meta {
  color: #aeb6c2;
}
</style>
