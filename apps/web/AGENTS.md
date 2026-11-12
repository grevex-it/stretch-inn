# Panel web

El panel del centro: React + TypeScript + Vite + TanStack Router y Query (ver
`docs/decisiones/0004-stack.md`). Visual: `docs/decisiones/0018-identidad-visual.md` y
`paquetes/ui/AGENTS.md`.

## Estructura

- `src/base/`: sesión, cliente de la API, ruteo, estructura de pantalla y controles comunes. Es
  estructura (0006): no se cambia de paso desde una tarea de negocio.
  - `api.ts`: el único lugar que hace `fetch`. `consultar(ruta, esquema)` valida la respuesta
    con el contrato; `enviar(metodo, ruta, cuerpo)` para los cambios, y
    `enviarYLeer(metodo, ruta, esquema, cuerpo)` cuando hace falta la respuesta.
  - `consultas.ts`: cliente de TanStack Query. Un 401 en cualquier pedido vuelve al login.
  - `sesion.ts`: `useSesion`, `usePermiso(permiso)` y las acciones de la sesión (entrar, salir,
    centro, sede, clave). El centro activo trae su `zonaHoraria`: toda fecha de la API viene en
    UTC y se muestra en esa zona, nunca en la del navegador.
  - `estructura/Navegacion.tsx`: las secciones del menú. Cada una se muestra solo con su permiso.
  - `Puerta.tsx`: según la sesión muestra login, clave temporal, elegir centro o el panel.
  - `rutas.tsx`: las rutas. Cada módulo suma las suyas como hijas de la raíz.
  - `controles/`: campo (obligatorio salvo `opcional`), botón, aviso, formulario y paginación;
    `ListaRemota` y `FormularioRemoto` para listas y formularios contra la API, y
    `BuscarAlumno` para elegir un alumno.
- `src/modulos/<modulo>/`: pantallas de cada módulo. Una carpeta por módulo, como en el backend.
  - `identidad/`: pantalla Equipo (lista, alta, clave temporal, bloqueo). La clave temporal se
    muestra una sola vez y no se guarda en ninguna consulta.
  - `personas/`: pantalla Alumnos (lista con buscador, alta, edición, baja y reactivación).
  - `agenda/`: clases de cada sede, alta y edición, e inscriptos.
  - `asistencia/`: planilla de una fecha, marcar, avisos y recuperaciones.
  - `abonos/`: planes, precio por sede y generar la cuota de un ciclo de 4 semanas (0019).
    `ciclo.ts` muestra el ciclo con su último día («Del 30/11/2026 al 27/12/2026»).
  - `caja/`: el día de caja de una sede, cobrar una cuota (efectivo o transferencia) y anular.

## Reglas

- Los datos se piden siempre con `consultar`/`enviar` de `src/base/api.ts` y TanStack Query.
  Nunca `fetch` directo.
- Los tipos de la API salen de `@app/contratos`. No se redefinen.
- Ocultar un botón según el permiso es solo para la experiencia de usuario: **la seguridad la
  aplica la API**. Nunca confíes en el front para eso.
- Cambiar de centro o de sede cambia qué datos se ven: esas acciones invalidan todas las
  consultas.
- Estilos con CSS Modules, un archivo por componente. Nada de CSS global salvo
  `src/base/estilos.css`. Solo variables `--si-…` de `@app/ui`, y solo pares de color que
  controla su test.
- Textos de la interfaz en español con voseo («Guardá», «Elegí la sede»). Los mensajes de error
  de la API ya vienen para el usuario: se muestran tal cual.

## Desarrollo

    pnpm db:levantar     # en otra terminal
    pnpm db:migrar
    pnpm db:semilla      # centro de prueba con dos sedes y un admin
    pnpm dev             # API en :3000 y panel en http://localhost:5173

El panel le habla a la API por `/api`, en su mismo origen: Vite lo redirige a la API (variable
`API_URL`, por defecto `http://localhost:3000`). Así viaja la cookie de sesión y no hace falta
CORS. `ORIGEN_PANEL` de la API tiene que ser `http://localhost:5173`.

## Tests

Vitest con jsdom y Testing Library, con el panel montado entero (`test/render.tsx`) y un `fetch`
falso (`test/servidor-falso.ts`). Se prueba lo que ve y hace la persona: etiquetas, roles y
textos, no detalles internos.

## Pendientes

- Cargar Jost (ver `paquetes/ui/AGENTS.md`); hasta entonces se ve la fuente del sistema.
- En producción, servir el panel y la API bajo el mismo dominio propio (`docs/pendientes.md`).
- Flujos críticos con Playwright (0004) cuando haya pantallas de negocio.
