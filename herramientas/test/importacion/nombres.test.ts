// Separar «Nombre y apellido» de la planilla (0022): la primera palabra es nombre, las siguientes
// también mientras sean nombres de pila conocidos, y el resto es apellido. Puro.
import { describe, expect, it } from "vitest";
import { separarNombre } from "../../src/importacion/nombres.ts";

describe("separarNombre", () => {
  it("dos palabras: nombre y apellido, con mayúscula inicial y tildes", () => {
    expect(separarNombre("ADRIANA ROLDÁN")).toEqual({
      nombre: "Adriana",
      apellido: "Roldán",
      revisar: false,
    });
    expect(separarNombre("  adriana   martínez ")).toMatchObject({
      nombre: "Adriana",
      apellido: "Martínez",
    });
  });

  it("los nombres de pila conocidos siguen siendo nombre; lo demás, apellido", () => {
    expect(separarNombre("MARÍA FERNANDA PÉREZ LUNA")).toEqual({
      nombre: "María Fernanda",
      apellido: "Pérez Luna",
      revisar: true,
    });
    expect(separarNombre("LORENA ALEJANDRA SOSA")).toMatchObject({
      nombre: "Lorena Alejandra",
      apellido: "Sosa",
    });
    expect(separarNombre("LUCÍA BELÉN QUIROGA")).toMatchObject({
      nombre: "Lucía Belén",
      apellido: "Quiroga",
    });
  });

  it("«del Carmen», «de los Ángeles» y parecidos son parte del nombre", () => {
    expect(separarNombre("MARIA DEL CARMEN PAZ")).toMatchObject({
      nombre: "Maria del Carmen",
      apellido: "Paz",
    });
    expect(separarNombre("ANA DE LOS ÁNGELES RÍOS")).toMatchObject({
      nombre: "Ana de los Ángeles",
      apellido: "Ríos",
    });
    expect(separarNombre("ANA LÍA BENÍTEZ")).toMatchObject({
      nombre: "Ana Lía",
      apellido: "Benítez",
    });
  });

  it("siempre deja al menos una palabra de apellido, y las partículas van con él", () => {
    expect(separarNombre("MARÍA JOSÉ")).toMatchObject({ nombre: "María", apellido: "José" });
    expect(separarNombre("ANA DE LA FUENTE")).toMatchObject({
      nombre: "Ana",
      apellido: "de la Fuente",
    });
  });

  it("tres palabras o más quedan para revisar; una sola, también", () => {
    expect(separarNombre("ADRIANA MOLINA").revisar).toBe(false);
    expect(separarNombre("ANA PAULA GÓMEZ").revisar).toBe(true);
    expect(separarNombre("CANDELA")).toEqual({ nombre: "Candela", apellido: "", revisar: true });
  });
});
