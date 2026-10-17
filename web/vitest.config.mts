// Test runner config. Vitest reuses Vite's pipeline, so it needs plugins to understand
// the same things Next.js does: JSX (react) and the "@/..." import alias (tsconfigPaths).
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // jsdom = a simulated browser (document, window) so components can render in Node.
    environment: "jsdom",
    // Unmount rendered components and reset mocks, stubbed globals (fetch) and stubbed
    // env vars between tests so they can't leak state.
    setupFiles: ["./vitest.setup.ts"],
    // mockReset clears vi.fn() call history and canned responses; restoreMocks undoes vi.spyOn.
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
