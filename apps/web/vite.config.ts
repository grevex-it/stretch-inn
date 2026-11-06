// Panel del centro (ver docs/borradores-agents/apps-web.md).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API = process.env["API_URL"] ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // El panel le habla a la API por /api, en su mismo origen: así la cookie de sesión viaja y no
    // hace falta CORS (0017). En producción, el mismo camino lo arma el dominio propio.
    proxy: {
      "/api": { target: API, rewrite: (ruta) => ruta.replace(/^\/api/, "") },
    },
  },
});
