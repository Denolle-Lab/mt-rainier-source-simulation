import { defineConfig } from "@playwright/test";

// End-to-end checks against the production build (npm run build first). WebGL in headless Chromium comes from
// SwiftShader; the headless ozone platform and an empty DISPLAY keep ANGLE off an X server (an SSH-forwarded
// DISPLAY makes it fail).
const BASE = process.env.E2E_URL ?? "http://127.0.0.1:4180/mt-rainier-source-simulation/";

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  workers: 1,
  use: {
    baseURL: BASE, viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--ozone-platform=headless", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
      env: { ...process.env, DISPLAY: "" },
    },
  },
  webServer: process.env.E2E_URL ? undefined : { command: "npx vite preview --port 4180 --strictPort", url: BASE, reuseExistingServer: true },
  reporter: [["list"]],
});
