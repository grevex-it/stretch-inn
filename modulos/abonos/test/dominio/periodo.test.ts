// El mes anterior de un período, para renovar las cuotas del mes. Puro, sin base.
import { describe, expect, it } from "vitest";
import { periodoAnterior } from "../../src/dominio/periodo.ts";

describe("periodoAnterior", () => {
  it("resta un mes y cruza el año en enero", () => {
    expect(periodoAnterior("2026-11")).toBe("2026-10");
    expect(periodoAnterior("2026-10")).toBe("2026-09");
    expect(periodoAnterior("2027-01")).toBe("2026-12");
  });
});
