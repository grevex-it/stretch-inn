// Cuándo se puede inscribir a un alumno y cuándo se puede bajar el cupo. Puro: sin base.
import { describe, expect, it } from "vitest";
import { cupoPosible, puedeInscribirse } from "../../src/dominio/inscripcion.ts";

const CLASE = { activa: true, cupo: 12, inscriptos: 11 };
const ALUMNO = { activo: true };

describe("puedeInscribirse", () => {
  it("con lugar, clase activa y alumno activo, sí", () => {
    expect(puedeInscribirse(CLASE, ALUMNO)).toEqual({ ok: true, valor: null });
  });

  it.each([
    [{ ...CLASE, inscriptos: 12 }, ALUMNO, "clase-completa"],
    [{ ...CLASE, activa: false }, ALUMNO, "clase-inactiva"],
    [CLASE, { activo: false }, "alumno-de-baja"],
    [CLASE, undefined, "alumno-inexistente"],
  ] as const)("%o con %o: %s", (clase, alumno, codigo) => {
    expect(puedeInscribirse(clase, alumno)).toMatchObject({ ok: false, error: { codigo } });
  });
});

describe("cupoPosible", () => {
  it("el cupo nuevo no puede quedar por debajo de los inscriptos", () => {
    expect(cupoPosible(10, 8).ok).toBe(true);
    expect(cupoPosible(8, 8).ok).toBe(true);
    expect(cupoPosible(7, 8)).toMatchObject({
      ok: false,
      error: { codigo: "cupo-menor-que-inscriptos" },
    });
  });
});
