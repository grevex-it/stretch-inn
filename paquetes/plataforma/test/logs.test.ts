// Logs en stdout, una línea JSON por log, legibles en Railway (ver docs/decisiones/0016).
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { codigoDeTraza, crearLogger, nuevaTraza } from "../src/index.ts";

function capturar(): { destino: Writable; lineas: () => Record<string, unknown>[] } {
  const crudo: string[] = [];
  const destino = new Writable({
    write(trozo: Buffer, _codificacion, listo) {
      crudo.push(trozo.toString());
      listo();
    },
  });
  const lineas = () =>
    crudo
      .join("")
      .split("\n")
      .filter((linea) => linea !== "")
      .map((linea) => JSON.parse(linea) as Record<string, unknown>);
  return { destino, lineas };
}

describe("crearLogger", () => {
  it("escribe una línea JSON con el nivel en texto, el mensaje y los datos", () => {
    const { destino, lineas } = capturar();
    const logger = crearLogger({ nivel: "info", destino });
    logger.error({ traza: "abc", modulo: "caja" }, "No se pudo registrar el cobro.");

    expect(lineas()).toEqual([
      expect.objectContaining({
        level: "error",
        message: "No se pudo registrar el cobro.",
        traza: "abc",
        modulo: "caja",
      }),
    ]);
  });

  it("no escribe lo que está por debajo del nivel", () => {
    const { destino, lineas } = capturar();
    crearLogger({ nivel: "warn", destino }).info("detalle");
    expect(lineas()).toEqual([]);
  });

  it("tapa claves, tokens y teléfonos aunque vengan en los datos", () => {
    const { destino, lineas } = capturar();
    crearLogger({ nivel: "info", destino }).info(
      { clave: "secreta", token: "t-1", entrada: { telefono: "1155550000", nombre: "Ana" } },
      "alta",
    );
    expect(lineas()[0]).toMatchObject({
      clave: "[oculto]",
      token: "[oculto]",
      entrada: { telefono: "[oculto]", nombre: "Ana" },
    });
  });
});

describe("traza", () => {
  it("cada pedido tiene una traza distinta", () => {
    expect(nuevaTraza()).not.toBe(nuevaTraza());
  });

  it("el código para el usuario son los primeros 6 caracteres, en mayúsculas", () => {
    expect(codigoDeTraza("7f3a9c2e-1111-4222-8333-444455556666")).toBe("7F3A9C");
  });
});
