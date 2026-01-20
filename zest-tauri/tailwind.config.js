/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Provider colors
        gemini: "#4285F4",
        claude: "#D97706",
        codex: "#10A37F",
        qwen: "#7C3AED",
        iflow: "#06B6D4",
        antigravity: "#EC4899",
        vertex: "#EA4335",
        kiro: "#9046FF",
        copilot: "#238636",
        cursor: "#00D4AA",
        trae: "#00B4D8",
        glm: "#3B82F6",
        warp: "#01E5FF",
        // App theme colors
        background: {
          DEFAULT: "#0a0a0a",
          secondary: "#141414",
          tertiary: "#1f1f1f",
        },
        foreground: {
          DEFAULT: "#fafafa",
          secondary: "#a1a1aa",
          muted: "#71717a",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["SF Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
