// Ruteo del panel con TanStack Router. Cada módulo suma sus rutas como hijas de la raíz.
import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { Equipo } from "../modulos/identidad/Equipo.tsx";
import { Estructura } from "./estructura/Estructura.tsx";
import { Inicio } from "./estructura/Inicio.tsx";

const raiz = createRootRoute({ component: Estructura });
const inicio = createRoute({ getParentRoute: () => raiz, path: "/", component: Inicio });
const equipo = createRoute({ getParentRoute: () => raiz, path: "/equipo", component: Equipo });

/** El historial se pasa en los tests (en memoria); en el navegador, el del navegador. */
export function crearRouter(historial?: RouterHistory) {
  return createRouter({
    routeTree: raiz.addChildren([inicio, equipo]),
    ...(historial === undefined ? {} : { history: historial }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof crearRouter>;
  }
}
