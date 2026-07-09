import {
  defineConfig,
  presetWind3,
  presetTypography,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss"

export default defineConfig({
  presets: [
    presetWind3(),
    presetTypography(),
    presetIcons({
      scale: 1.2,
      cdn: "https://esm.sh/",
    }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      brand: {
        50: "#eef6ff",
        100: "#d9eaff",
        200: "#bcd9ff",
        300: "#8ec1ff",
        400: "#599dff",
        500: "#3478f6",
        600: "#1f5be0",
        700: "#1947b8",
        800: "#1a3d95",
        900: "#1b3676",
      },
      ink: {
        50: "#f6f7f9",
        100: "#eceef2",
        200: "#d4d9e0",
        300: "#aeb6c2",
        400: "#818c9c",
        500: "#636e80",
        600: "#4e5767",
        700: "#3f4754",
        800: "#363c47",
        900: "#0b0d12",
        950: "#070810",
      },
    },
    fontFamily: {
      serif: ['"Source Serif 4"', "Georgia", "ui-serif", "serif"],
      reading: ['"Source Serif 4"', "Georgia", "ui-serif", "serif"],
    },
  },
  shortcuts: {
    "btn": "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
    "btn-ghost": "btn text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
    "btn-primary": "btn bg-brand-600 text-white hover:bg-brand-700",
    "chip": "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  },
})
