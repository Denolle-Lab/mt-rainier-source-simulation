import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/mt-rainier-source-simulation/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5180 },
  preview: { host: "127.0.0.1", port: 4180 },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
  },
});
