import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    fileParallelism: false, // Runs test files sequentially to prevent database query race conditions
  },
});
