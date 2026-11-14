import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    // Integration tests share one SQLite file, so run files sequentially.
    fileParallelism: false,
    env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" },
    testTimeout: 20_000,
  },
});
