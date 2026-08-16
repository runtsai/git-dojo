import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "@workspace/api-client-react": path.resolve(
        __dirname,
        "../../lib/api-client-react/src/index.ts",
      ),
      "@workspace/course-content": path.resolve(
        __dirname,
        "../../lib/course-content/src/index.ts",
      ),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
