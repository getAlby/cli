import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    testTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
