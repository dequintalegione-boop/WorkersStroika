import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages проекта публикует приложение в /WorkersStroika/.
// Для локального запуска оставляем корневой путь без изменения.
const base = process.env.GITHUB_PAGES === "true" ? "/WorkersStroika/" : "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    allowedHosts: ["127.0.0.1", "localhost"],
    hmr: { host: "127.0.0.1", port: 3000 },
    watch: {
      ignored: ["**/.vs/**", "**/.vscode/**", "**/node_modules/**", "**/dist/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
