// La tarifa por clase de los profes (0024): cuatro niveles (profe y sede, profe, sede, centro),
// gana el más específico, y cada clase se paga con la vigente el día en que se dictó. Puro.
import { describe, expect, it } from "vitest";
import { tarifaDelDia, vigenciaNueva, type Tarifa } from "../../src/dominio/tarifas.ts";

const NORTE = "norte";
const LORE = "lore";
const tarifa = (cambios: Partial<Tarifa>): Tarifa => ({
  profeId: null,
  sedeId: null,
  monto: 10_000,
  desde: "2026-01-01",
  hasta: null,
  ...cambios,
});

describe("tarifaDelDia", () => {
  const tarifas = [
    tarifa({ monto: 10_000 }),
    tarifa({ sedeId: NORTE, monto: 12_000 }),
    tarifa({ profeId: LORE, monto: 14_000 }),
    tarifa({ profeId: LORE, sedeId: NORTE, monto: 15_000 }),
  ];

  it("gana la más específica: profe y sede, profe, sede, centro", () => {
    const dia = { fecha: "2026-11-23" };
    expect(tarifaDelDia(tarifas, { ...dia, profeId: LORE, sedeId: NORTE })).toBe(15_000);
    expect(tarifaDelDia(tarifas, { ...dia, profeId: LORE, sedeId: "sur" })).toBe(14_000);
    expect(tarifaDelDia(tarifas, { ...dia, profeId: "lucia", sedeId: NORTE })).toBe(12_000);
    expect(tarifaDelDia(tarifas, { ...dia, profeId: "lucia", sedeId: "sur" })).toBe(10_000);
  });

  it("usa la vigente ese día: un aumento en el medio del período paga cada parte a su valor", () => {
    const conAumento = [
      tarifa({ monto: 10_000, hasta: "2026-11-15" }),
      tarifa({ monto: 11_000, desde: "2026-11-16" }),
    ];
    const de = (fecha: string) => tarifaDelDia(conAumento, { fecha, profeId: LORE, sedeId: NORTE });
    expect(de("2026-11-15")).toBe(10_000);
    expect(de("2026-11-16")).toBe(11_000);
  });

  it("sin ninguna tarifa aplicable, no hay monto (no se paga en cero)", () => {
    expect(
      tarifaDelDia([tarifa({ desde: "2026-12-01" })], {
        fecha: "2026-11-23",
        profeId: LORE,
        sedeId: NORTE,
      }),
    ).toBeUndefined();
  });
});

describe("vigenciaNueva", () => {
  const hoy = "2026-11-20";

  it("una tarifa nueva cierra la anterior del mismo alcance el día antes", () => {
    const anterior = tarifa({ desde: "2026-01-01" });
    expect(vigenciaNueva(anterior, { desde: "2026-12-01", monto: 12_000 }, hoy)).toEqual({
      ok: true,
      valor: { cerrarAnteriorEl: "2026-11-30" },
    });
    expect(vigenciaNueva(undefined, { desde: hoy, monto: 12_000 }, hoy)).toEqual({
      ok: true,
      valor: { cerrarAnteriorEl: null },
    });
  });

  it("[SUPUESTO] no hay aumentos hacia atrás: rige desde hoy o más adelante", () => {
    const atras = vigenciaNueva(undefined, { desde: "2026-11-19", monto: 12_000 }, hoy);
    expect(!atras.ok && atras.error.codigo).toBe("desde-pasado");
  });

  it("no puede empezar antes ni el mismo día que la vigente; el monto va en pesos enteros", () => {
    const anterior = tarifa({ desde: "2026-12-01" });
    const igual = vigenciaNueva(anterior, { desde: "2026-12-01", monto: 1 }, hoy);
    expect(!igual.ok && igual.error.codigo).toBe("desde-pisa-la-anterior");
    for (const monto of [0, 1.5, 100_000_001]) {
      const mal = vigenciaNueva(undefined, { desde: hoy, monto }, hoy);
      expect(!mal.ok && mal.error.codigo).toBe("monto-invalido");
    }
  });
});
