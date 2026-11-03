// Fixture: un test que falla a propósito. Lo corre salida.test.ts para comprobar que Vitest
// termina con error cuando se usa el Postgres de prueba. No forma parte de la suite.
import { expect, it } from "vitest";

it("falla a propósito", () => {
  expect(1).toBe(2);
});
