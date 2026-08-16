import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@workspace/course-content": path.resolve(
        __dirname,
        "../../lib/course-content/src/index.ts",
      ),
    },
  },
});
