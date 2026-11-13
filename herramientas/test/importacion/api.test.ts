// El cliente HTTP del importador: entra con un usuario real (la sesión va en la cookie, regla 1),
// elige el centro y habla con las rutas de siempre. Con un fetch falso.
import { describe, expect, it } from "vitest";
import { entrarALaApi } from "../../src/importacion/api.ts";

const CENTRO = "7b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f67";
const ALUMNO = "8b0f3a3e-6a8f-4f58-9a43-1b2c3d4e5f68";

function fetchFalso(respuestas: Record<string, { estado: number; cuerpo?: unknown }>) {
  const pedidos: { ruta: string; cookie: string | null; cuerpo: unknown }[] = [];
  const falso: typeof fetch = (entrada, init) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    const ruta = `${init?.method ?? "GET"} ${url.pathname}${url.search}`;
    const cabeceras = new Headers(init?.headers);
    pedidos.push({
      ruta,
      cookie: cabeceras.get("cookie"),
      cuerpo: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const respuesta = respuestas[ruta] ?? { estado: 404, cuerpo: { error: { mensaje: "No." } } };
    const salida = new Headers({ "content-type": "application/json" });
    if (ruta === "POST /sesion") salida.set("set-cookie", "sesion=abc; Path=/; HttpOnly");
    return Promise.resolve(
      new Response(respuesta.cuerpo === undefined ? null : JSON.stringify(respuesta.cuerpo), {
        status: respuesta.estado,
        headers: salida,
      }),
    );
  };
  return { falso, pedidos };
}

const alumno = (numeroDeSocio: number) => ({
  id: ALUMNO,
  nombre: "Ana",
  apellido: "Pérez",
  telefono: null,
  documento: null,
  email: null,
  fechaNacimiento: null,
  notas: "",
  numeroDeSocio,
  fechaDeInicio: null,
  profeId: null,
  activo: true,
  bajaEn: null,
  pendienteDeCompletar: true,
  version: 1,
});

const pagina = (elementos: unknown[]) => ({
  pagina: 1,
  porPagina: 50,
  total: elementos.length,
  elementos,
});

describe("entrarALaApi", () => {
  it("entra, elige el único centro y manda la cookie en cada pedido", async () => {
    const { falso, pedidos } = fetchFalso({
      "POST /sesion": {
        estado: 200,
        cuerpo: { debeCambiarClave: false, centros: [{ id: CENTRO, nombre: "Stretch Inn" }] },
      },
      "PUT /sesion/centro": { estado: 204 },
      "POST /alumnos": { estado: 201, cuerpo: { id: ALUMNO } },
      "GET /alumnos?buscar=54&bajas=si&pagina=1": {
        estado: 200,
        cuerpo: pagina([alumno(154), alumno(54)]),
      },
      "GET /alumnos?buscar=55&bajas=si&pagina=1": { estado: 200, cuerpo: pagina([alumno(155)]) },
    });

    const api = await entrarALaApi(
      {
        url: "http://api.local",
        email: "lore@centro.com",
        clave: "una clave bien larga",
        origen: "http://panel.local",
      },
      falso,
    );

    expect(pedidos[1]).toMatchObject({ ruta: "PUT /sesion/centro", cuerpo: { centroId: CENTRO } });
    expect(await api.existe(54)).toBe(true);
    expect(await api.existe(55)).toBe(false);
    const creado = await api.crear({
      nombre: "Adriana",
      apellido: "Roldán",
      telefono: null,
      documento: null,
      email: null,
      fechaNacimiento: null,
      notas: "",
      numeroDeSocio: 54,
      fechaDeInicio: null,
      profeId: null,
    });
    expect(creado).toEqual({ ok: true, id: ALUMNO });
    expect(pedidos.slice(1).every((p) => p.cookie === "sesion=abc")).toBe(true);
  });

  it("un rechazo de la API vuelve con su mensaje; un login fallido corta", async () => {
    const { falso } = fetchFalso({
      "POST /sesion": {
        estado: 200,
        cuerpo: { debeCambiarClave: false, centros: [{ id: CENTRO, nombre: "Stretch Inn" }] },
      },
      "PUT /sesion/centro": { estado: 204 },
      "POST /alumnos": { estado: 400, cuerpo: { error: { mensaje: "Revisá el teléfono." } } },
    });
    const api = await entrarALaApi(
      { url: "http://api.local", email: "a@b.com", clave: "x", origen: "http://panel.local" },
      falso,
    );

    const creado = await api.crear({
      nombre: "A",
      apellido: "B",
      telefono: "1",
      documento: null,
      email: null,
      fechaNacimiento: null,
      notas: "",
      numeroDeSocio: 1,
      fechaDeInicio: null,
      profeId: null,
    });
    expect(creado).toEqual({ ok: false, mensaje: "Revisá el teléfono." });

    const { falso: rechaza } = fetchFalso({
      "POST /sesion": {
        estado: 401,
        cuerpo: { error: { mensaje: "Email o contraseña incorrectos" } },
      },
    });
    await expect(
      entrarALaApi(
        { url: "http://api.local", email: "a@b.com", clave: "x", origen: "http://panel.local" },
        rechaza,
      ),
    ).rejects.toThrow("Email o contraseña incorrectos");
  });
});
