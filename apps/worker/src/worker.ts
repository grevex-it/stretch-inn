// Punto de entrada del worker: conecta la cola (pg-boss, sobre el mismo Postgres) y procesa las
// tareas. Railway lo corre como un servicio aparte de la API.
import { crearCola, crearLogger } from "@app/plataforma";
import { registrarTareas } from "./tareas.ts";

const logger = crearLogger({ nivel: "info" });

// Falla del proceso: se registra y se termina para que Railway lo reinicie (0016).
for (const evento of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(evento, (error) => {
    logger.fatal({ err: error, evento }, "Falla del worker: se termina para reiniciar.");
    process.exit(1);
  });
}

const url = process.env["DATABASE_URL"];
if (url === undefined) {
  logger.fatal("Falta DATABASE_URL. Copiá .env.example a .env.");
  process.exit(1);
}

const cola = crearCola({ url, logger });
await cola.iniciar();
await registrarTareas(cola, logger);
logger.info("Worker listo.");

// Railway manda SIGTERM antes de cambiar al deploy nuevo: se terminan los trabajos en curso.
process.on("SIGTERM", () => {
  void cola.detener().then(() => process.exit(0));
});
