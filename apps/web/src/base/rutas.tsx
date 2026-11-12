// Ruteo del panel con TanStack Router. Cada módulo suma sus rutas como hijas de la raíz.
import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { Agenda } from "../modulos/agenda/Agenda.tsx";
import { Asistencia } from "../modulos/asistencia/Asistencia.tsx";
import { Abonos } from "../modulos/abonos/Abonos.tsx";
import { Caja } from "../modulos/caja/Caja.tsx";
import { Equipo } from "../modulos/identidad/Equipo.tsx";
import { Alumnos } from "../modulos/personas/Alumnos.tsx";
import { Estructura } from "./estructura/Estructura.tsx";
import { Inicio } from "./estructura/Inicio.tsx";

const raiz = createRootRoute({ component: Estructura });
const inicio = createRoute({ getParentRoute: () => raiz, path: "/", component: Inicio });
const equipo = createRoute({ getParentRoute: () => raiz, path: "/equipo", component: Equipo });
const alumnos = createRoute({ getParentRoute: () => raiz, path: "/alumnos", component: Alumnos });

const agenda = createRoute({ getParentRoute: () => raiz, path: "/agenda", component: Agenda });
const asistencia = createRoute({
  getParentRoute: () => raiz,
  path: "/asistencia",
  component: Asistencia,
});
const abonos = createRoute({ getParentRoute: () => raiz, path: "/abonos", component: Abonos });
const caja = createRoute({ getParentRoute: () => raiz, path: "/caja", component: Caja });

/** El historial se pasa en los tests (en memoria); en el navegador, el del navegador. */
export function crearRouter(historial?: RouterHistory) {
  return createRouter({
    routeTree: raiz.addChildren([inicio, alumnos, equipo, agenda, asistencia, abonos, caja]),
    ...(historial === undefined ? {} : { history: historial }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof crearRouter>;
  }
}
