import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "canvas-grid";
const base =
  process.env.GITHUB_ACTIONS === "true" ||
  process.env.BUILD_FOR_PAGES === "true"
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
});
