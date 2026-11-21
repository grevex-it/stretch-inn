import { createServer } from "node:net";

/** Pide al sistema un puerto TCP libre en este momento. */
export function puertoLibre(): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();
    servidor.once("error", rechazar);
    servidor.listen(0, () => {
      const direccion = servidor.address();
      const puerto = typeof direccion === "object" && direccion !== null ? direccion.port : 0;
      servidor.close(() => {
        resolver(puerto);
      });
    });
  });
}
