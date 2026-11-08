// Las fechas concretas de una clase semanal, en la zona horaria del centro y guardadas en UTC.
import { describe, expect, it } from "vitest";
import {
  cambioDeHorario,
  diaDe,
  localAUtc,
  ocurrenciasDeLaSemana,
} from "../../src/dominio/ocurrencias.ts";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";
const MADRID = "Europe/Madrid";
const LUNES_1830 = { dia: 1, hora: "18:30", duracionMinutos: 60 };

describe("diaDe", () => {
  it("cuenta de lunes (1) a domingo (7)", () => {
    expect(diaDe("2026-11-09")).toBe(1);
    expect(diaDe("2026-11-14")).toBe(6);
    expect(diaDe("2026-11-15")).toBe(7);
  });
});

describe("localAUtc", () => {
  it("pasa la hora local del centro a UTC", () => {
    expect(localAUtc("2026-11-09", "18:30", BUENOS_AIRES).toISOString()).toBe(
      "2026-11-09T21:30:00.000Z",
    );
  });

  it("respeta el horario de verano de la zona", () => {
    // Madrid pasa de UTC+1 a UTC+2 el 29/03/2026.
    expect(localAUtc("2026-03-23", "10:00", MADRID).toISOString()).toBe("2026-03-23T09:00:00.000Z");
    expect(localAUtc("2026-03-30", "10:00", MADRID).toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });
});

describe("ocurrenciasDeLaSemana", () => {
  it("da la fecha de la clase en la semana que empieza ese lunes, con inicio y fin en UTC", () => {
    expect(ocurrenciasDeLaSemana(LUNES_1830, "2026-11-09", BUENOS_AIRES)).toEqual([
      {
        fecha: "2026-11-09",
        empiezaEn: new Date("2026-11-09T21:30:00.000Z"),
        terminaEn: new Date("2026-11-09T22:30:00.000Z"),
      },
    ]);
  });

  it("encuentra el día aunque la semana no empiece en lunes", () => {
    const sabado = { ...LUNES_1830, dia: 6 };
    expect(ocurrenciasDeLaSemana(sabado, "2026-11-12", BUENOS_AIRES).map((o) => o.fecha)).toEqual([
      "2026-11-14",
    ]);
  });

  it("una clase que cruza la medianoche termina al día siguiente", () => {
    const tarde = { dia: 1, hora: "23:30", duracionMinutos: 90 };
    const [ocurrencia] = ocurrenciasDeLaSemana(tarde, "2026-11-09", BUENOS_AIRES);
    expect(ocurrencia?.terminaEn.toISOString()).toBe("2026-11-10T04:00:00.000Z");
  });
});

describe("cambioDeHorario", () => {
  const futuras = [
    { id: "a", fecha: "2026-11-16" },
    { id: "b", fecha: "2026-11-23" },
  ];

  it("si cambia solo la hora, actualiza las fechas futuras", () => {
    const nuevo = { ...LUNES_1830, hora: "19:00" };
    expect(cambioDeHorario(futuras, nuevo, BUENOS_AIRES)).toEqual({
      actualizar: [
        {
          id: "a",
          empiezaEn: new Date("2026-11-16T22:00:00.000Z"),
          terminaEn: new Date("2026-11-16T23:00:00.000Z"),
        },
        {
          id: "b",
          empiezaEn: new Date("2026-11-23T22:00:00.000Z"),
          terminaEn: new Date("2026-11-23T23:00:00.000Z"),
        },
      ],
      borrar: [],
    });
  });

  it("si cambia el día, borra las fechas futuras: se vuelven a armar en el día nuevo", () => {
    const nuevo = { ...LUNES_1830, dia: 3 };
    expect(cambioDeHorario(futuras, nuevo, BUENOS_AIRES)).toEqual({
      actualizar: [],
      borrar: ["a", "b"],
    });
  });
});
