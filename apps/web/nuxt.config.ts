import { defineNuxtConfig } from "nuxt/config"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-01",
  devtools: { enabled: true },

  modules: ["@pinia/nuxt", "@vueuse/nuxt", "@unocss/nuxt"],

  // Consume the workspace core package (ships TS source, not built).
  build: {
    transpile: ["@voxic/core"],
  },

  css: [
    "@unocss/reset/tailwind.css",
    "~/assets/css/main.css",
  ],

  app: {
    head: {
      title: "Voxic — English Reading Studio",
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#0b0d12" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },

  runtimeConfig: {
    // Server-only secrets/paths. No personal defaults — set them via .env
    // (see .env.example). Only generic localhost/relative paths are kept.
    maimemoNasRoot: "",
    gptsovitsBase: "http://127.0.0.1:9880",
    obsidianArticlesPath: "",
    voiceRotationPath: "",
    voiceListPath: "",
    eudicToken: "",
    eudicSecretsPath: "",
    dbPath: "./data/app.db",
    ttsCacheDir: "./data/tts",
    // Postgres (primary source for MaiMemo word data). All env-driven — the real
    // host/password live in the gitignored .env. Password falls back to ~/.pgpass.
    pgHost: "",
    pgPort: 5432,
    pgDbname: "",
    pgUser: "",
    pgPassword: "",
    pgPassFile: "~/.pgpass",
    // AI provider (OpenAI-compatible gateway) for flashcard generation + chat.
    // Defaults point at the Qiniu gateway; key read from .secrets if empty.
    aiBaseUrl: "https://api.qnaigc.com/v1",
    aiApiKey: "",
    aiModel: "deepseek/deepseek-v4-flash",
    aiFallbackModel: "",
    // Exposed to client (non-secret):
    public: {
      appName: "Voxic",
    },
  },

  nitro: {},

  future: {
    compatibilityVersion: 4,
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
