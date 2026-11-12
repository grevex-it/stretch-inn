// Los días de las cuotas, sin base (0020).
import { describe, expect, it } from "vitest";
import { diaDe, diaSiguiente, esDia } from "../../src/dominio/ciclo.ts";

describe("diaDe", () => {
  it("es el día local del centro", () => {
    // A las 02:00 UTC del 1 de diciembre, en Buenos Aires (UTC−3) todavía es 30 de noviembre.
    expect(diaDe(new Date("2026-12-01T02:00:00Z"), "America/Argentina/Buenos_Aires")).toBe(
      "2026-11-30",
    );
    expect(diaDe(new Date("2026-12-01T04:00:00Z"), "America/Argentina/Buenos_Aires")).toBe(
      "2026-12-01",
    );
  });
});

describe("esDia", () => {
  it("un día es AAAA-MM-DD y existe en el calendario", () => {
    expect(esDia("2026-11-30")).toBe(true);
    expect(esDia("2028-02-29")).toBe(true);
    expect(esDia("2026-02-29")).toBe(false);
    expect(esDia("2026-11")).toBe(false);
    expect(esDia("30/11/2026")).toBe(false);
  });
});

describe("diaSiguiente", () => {
  it("es el día después, también al cambiar de mes y de año", () => {
    expect(diaSiguiente("2026-12-21")).toBe("2026-12-22");
    expect(diaSiguiente("2026-11-30")).toBe("2026-12-01");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });
});
