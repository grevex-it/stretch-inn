// Las descripciones de los permisos las ve el centro en la pantalla de roles: tienen que decir lo
// que el permiso hace hoy. Una cuota es un paquete de clases, no un mes (0020).
import { describe, expect, it } from "vitest";
import { ASIGNAR, PERMISOS_ABONOS } from "../../src/dominio/permisos.ts";

describe("permisos de abonos", () => {
  it("asignar describe la cuota como un paquete de clases", () => {
    const asignar = PERMISOS_ABONOS.permisos.find((p) => p.permiso === ASIGNAR);
    expect(asignar?.descripcion).toBe("Generar y anular la cuota de un alumno (paquete de clases)");
  });
});
