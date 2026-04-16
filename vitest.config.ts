import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["mcp-server/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["mcp-server/src/**/*.ts"],
      exclude: ["mcp-server/src/**/*.test.ts", "mcp-server/src/index.ts"],
    },
  },
});
