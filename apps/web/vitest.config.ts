import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    css: { modules: { classNameStrategy: "non-scoped" } },
    // Cada test monta el panel entero y tipea como una persona; en CI corre en paralelo con el
    // resto de los paquetes. El mismo límite que los demás paquetes del repo.
    testTimeout: 30_000,
  },
});
