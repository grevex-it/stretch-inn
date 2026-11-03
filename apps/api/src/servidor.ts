// Punto de entrada de la API: conecta la base, el logger y la app, y escucha en PUERTO.
import { comprobarBase, crearBase, crearLogger, verificarRolSeguro } from "@app/plataforma";
import { construirApp } from "./app.ts";

const logger = crearLogger({ nivel: "info" });

// Falla del proceso: se registra y se termina para que Railway lo reinicie; no se sigue
// corriendo en un estado desconocido (0016).
for (const evento of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(evento, (error) => {
    logger.fatal({ err: error, evento }, "Falla del proceso: se termina para reiniciar.");
    process.exit(1);
  });
}

const urlBase = process.env["DATABASE_URL"];
if (urlBase === undefined) {
  logger.fatal("Falta DATABASE_URL. Copiá .env.example a .env.");
  process.exit(1);
}

const base = crearBase(urlBase);
await verificarRolSeguro(base);

const app = construirApp({
  logger,
  comprobarBase: () => comprobarBase(base),
});

// Railway manda SIGTERM antes de cambiar al deploy nuevo: se terminan los pedidos en curso.
process.on("SIGTERM", () => {
  void app
    .close()
    .then(() => base.cerrar())
    .then(() => process.exit(0));
});

await app.listen({ host: "0.0.0.0", port: Number(process.env["PUERTO"] ?? 3000) });
