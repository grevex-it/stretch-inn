// Punto de entrada de la API: conecta la base, el logger y la app, y escucha en PUERTO.
import { comprobarBase, crearBase, crearLogger, verificarRolSeguro } from "@app/plataforma";
import { crearAcceso, crearEquipo, rutasDeEquipo, rutasDeSesion } from "@app/identidad";
import { rutasDeAlumnos } from "@app/personas";
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

const origenPanel = process.env["ORIGEN_PANEL"];
if (origenPanel === undefined) {
  logger.fatal("Falta ORIGEN_PANEL (por ejemplo https://app.dominio). Copiá .env.example a .env.");
  process.exit(1);
}

const base = crearBase(urlBase);
await verificarRolSeguro(base);

// Una sola instancia por proceso: el límite de intentos de login vive en su memoria (0017).
const acceso = crearAcceso(base);
const app = construirApp({
  logger,
  comprobarBase: () => comprobarBase(base),
  origenPanel,
  resolverSesion: (token) => acceso.resolver(token),
  detrasDeProxy: process.env["DETRAS_DE_PROXY"] === "1",
});
await app.register(rutasDeSesion(acceso));
await app.register(rutasDeEquipo(crearEquipo(base)));
await app.register(rutasDeAlumnos(base));

// Railway manda SIGTERM antes de cambiar al deploy nuevo: se terminan los pedidos en curso.
process.on("SIGTERM", () => {
  void app
    .close()
    .then(() => base.cerrar())
    .then(() => process.exit(0));
});

await app.listen({ host: "0.0.0.0", port: Number(process.env["PUERTO"] ?? 3000) });
