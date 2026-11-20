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
    muestra una sola vez y no se guarda en ninguna consulta. En la fila propia solo está
    «Permisos»: clave temporal y bloqueo no se aplican a uno mismo. Pantalla Roles (`/equipo/roles`,
    enlace desde Equipo con `roles.gestionar`): las plantillas se ven y se duplican; los roles
    propios se editan y se borran. El editor (`MatrizDePermisos.tsx`) tiene un atajo por sección
    (Sin acceso, Ver, Operar o Personalizado, `matriz.ts`) y una casilla por permiso. «Permisos»
    en cada fila abre los roles y el origen de cada permiso de esa persona en una sede
    (`PermisosDeIntegrante.tsx`), con los ajustes destacados; con `usuarios.gestionar`, se suman
    y quitan roles y se ajusta permiso por permiso. Los propios se ven en solo lectura, con un
    aviso: nadie se cambia a sí mismo. Las tablas de cada sección usan los mismos anchos de
    columna. Con una sede activa, si la persona tiene
    permisos en otras sedes, ofrece pasar a «Todas mis sedes».
  - `personas/`: pantalla Alumnos (lista con buscador, alta, edición, baja y reactivación). Con
    `personas.editar` la ficha se abre con «Editar»; con solo `personas.ver`, con «Ver» y en solo
    lectura, pero con todos los datos. La ficha (`DatosDelAlumno.tsx`) sigue la planilla (0022):
    número de socio (vacío en el alta, lo pone la API), fecha de inicio, profe
    (`ElegirProfe.tsx`: los integrantes activos del equipo, todas las páginas, solo para editar)
    y contacto de emergencia (0019); el email, opcional, al final. Al sumar un alumno su ficha
    queda abierta, para cargar enseguida los antecedentes de salud (`SaludDelAlumno.tsx`: se ven
    con `personas.ver-salud` y se guardan aparte, con su versión, con `personas.editar-salud`).
    En las dos se ven las cuotas del alumno (`abonos.ver`) y, en cada cuota pagada, anular su
    pago (`caja.anular`), sin `caja.ver`: ni totales ni caja del día (0019). «Dar de baja» y
    «Reactivar» aparecen con `personas.dar-de-baja`, con o sin `personas.editar`.
  - `agenda/`: clases de cada sede, alta y edición, e inscriptos. Las camas de la sede
    (`CamasDeLaSede.tsx`, con `agenda.gestionar`): obligatorias desde el panel, son el cupo por
    defecto de una clase nueva. Si bajarlas deja afuera a fijos, lista todas las clases que lo
    impiden (`clases-de-la-sede.ts` recorre todas las páginas).
  - `asistencia/`: planilla de una fecha, marcar, avisos y recuperaciones, y las reglas de
    recuperación de la sede (`ReglasDeLaSede.tsx`, con `asistencia.configurar`, 0020).
  - `abonos/`: planes (con las clases del paquete), precio por sede y generar la cuota (0020).
    `ciclo.ts` muestra la cuota con su inicio y sus clases («Desde el 30/11/2026 · 4 clases»).
    Ofrece `CuotasDelAlumno`: la lista paginada de cuotas de un alumno, con una acción por cuota
    pagada que decide quien la usa.
  - `caja/`: el día de caja de una sede, cobrar una cuota (efectivo o transferencia) y anular.
    Ofrece `AnularPago`.

## Reglas

- Los datos se piden siempre con `consultar`/`enviar` de `src/base/api.ts` y TanStack Query.
  Nunca `fetch` directo.
- Los tipos de la API salen de `@app/contratos`. No se redefinen.
- **Las pantallas de un módulo usan las de otro solo por su `index.ts`** (`src/modulos/<modulo>/
index.ts`), como en el backend (regla 4). Ahí se exporta solo lo pensado para otros módulos;
  el resto es interno. Un módulo no sabe quién lo usa: si hace falta algo de otro módulo (como
  anular un pago desde las cuotas), lo recibe por props. Todavía no lo controla `pnpm check`
  (`docs/pendientes.md`).
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
