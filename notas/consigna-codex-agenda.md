# Consigna para Codex — pantalla Agenda del panel

Trabajás en paralelo con otro agente (Claude). Vos hacés el **panel** (`apps/web`); el otro, el
back y la estructura. Para no pisarse, cada uno tiene su carpeta y su rama.

## Dónde

- Carpeta: `C:\Users\Administrator\code\wt-agenda` (worktree de git, ya instalado y con `.env`).
  **Trabajá solo acá.**
- Rama: `panel-agenda`, que sale de `main` con el back de agenda ya mergeado (clases, fechas e
  inscripciones).
- Antes de cualquier cambio leé `AGENTS.md` (raíz), `apps/web/AGENTS.md` y
  `modulos/agenda/AGENTS.md` (qué hace cada ruta y sus reglas). Las reglas valen igual para vos:
  **presentá un plan corto y esperá el OK de Pedro antes de implementar**, test primero,
  archivos de hasta 300 líneas y funciones de hasta 50, español argentino con voseo.

## Qué hay que hacer

Una pantalla **Agenda** en `apps/web/src/modulos/agenda/`, con estos tres puntos:

1. **Semana de una sede.** Grilla de 7 días (lunes a domingo) con las fechas de la sede:
   - Pedido: `GET /agenda/ocurrencias?sede=<uuid>&desde=AAAA-MM-DD&pagina=N`, con el contrato
     `paginaDeOcurrencias`. `desde` es el lunes de la semana. Se puede pasar a la semana
     anterior o a la siguiente, y volver a «Hoy».
   - Cada fecha muestra el nombre, la hora de inicio y fin, y los inscriptos sobre el cupo
     (`8/12`). Si está cancelada, se marca.
   - **Sede:** si la sede activa de la sesión es una sede puntual, se usa esa. Si es «Todas mis
     sedes», la pantalla pide elegir una entre `sesion.sedes`. La semana es siempre de una sede.
   - La semana entra casi siempre en una página de 50. Si `total` es mayor, pedí las páginas
     que falten y no armes una grilla incompleta. No uses un bucle sin tope: con 5 páginas
     alcanza, y más allá se avisa.
2. **Alta y edición de una clase** (con `agenda.gestionar`):
   - Clases de la sede: `GET /agenda/clases?sede=<uuid>&pagina=N` (`paginaDeClases`).
   - Alta: `POST /agenda/clases` con `fichaDeClase`, que lleva nombre, día (1 = lunes … 7 =
     domingo), hora `HH:MM`, duración en minutos y cupo.
   - Edición: `PUT /agenda/clases/:id` con `edicionDeClase`, que lleva la `version` que se vio.
     Un 409 trae su mensaje, que se muestra tal cual. Los casos: alguien la cambió antes o el cupo
     queda por debajo de los inscriptos. La sede no se cambia.
   - Baja y reactivación: `PUT` y `DELETE /agenda/clases/:id/baja`.
   - Después de cada cambio, invalidá las clases y la semana.
3. **Cancelar una fecha** (con `agenda.gestionar`):
   - `PUT /agenda/ocurrencias/:id/cancelada` la cancela y `DELETE` lo deshace.
   - Solo se puede antes de que empiece: si la API lo rechaza, mostrá su mensaje.

Los botones se ocultan con `usePermiso(...)` (`agenda.ver`, `agenda.gestionar`), pero eso es solo
para la experiencia: la API aplica el permiso por sede. Si la API rechaza algo, se muestra su
mensaje.

**Las inscripciones (la lista de inscriptos e inscribir alumnos) no van en este PR.** Son el
siguiente.

## La hora de cada fecha (importante)

`empiezaEn` y `terminaEn` vienen en UTC. Se muestran **en la zona horaria del centro** (regla 3),
no en la del navegador.

- La zona viene en la sesión: `centroActivo.zonaHoraria`. Se suma en un PR de estructura aparte
  (rama `sesion-zona-horaria`).
- Si cuando arrancás ese PR todavía no está en `main`, Pedro te va a pasar el comando para
  traerlo. No lo copies a mano.
- Armá **un solo** helper, por ejemplo `apps/web/src/modulos/agenda/hora.ts`. Tiene que recibir
  la zona y formatear con
  `Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit" })`.
- En los tests, `enCentro` de `test/render.tsx` ya trae `zonaHoraria`. Probá también con un
  centro en otra zona (por ejemplo `America/Montevideo`): el resultado no puede depender de la
  zona de la PC.
- Para la columna de cada fecha usá `fecha`: ya es la fecha local del centro.

## Qué se puede tocar

- `apps/web/src/modulos/agenda/` y `apps/web/test/` (pantalla, consultas y tests).
- **Mínimo de estructura, como se hizo con Alumnos:**
  - Una ruta `/agenda` en `apps/web/src/base/rutas.tsx`.
  - Un enlace «Agenda» en `apps/web/src/base/estructura/Navegacion.tsx`, visible con
    `agenda.ver`.
  - Sumar la pantalla en la sección Estructura de `apps/web/AGENTS.md`.
  - Nada más en `base/`: si necesitás otra cosa ahí, frená y explicá por qué.

## Qué NO tocar

- `paquetes/contratos`: los esquemas ya están en `src/agenda.ts`. Si te falta algo, frená y
  pedilo.
- `modulos/`, `db/`, `paquetes/`, `herramientas/` y `apps/api` son del otro agente.
- No cambies de rama ni toques las otras carpetas de `C:\Users\Administrator\code\`.

## Cómo probar

Primero el test, en `apps/web/test/`:

- Montá el panel entero con `montarPanel` y `servidorFalso`, igual que en
  `alumnos-lista.test.tsx`.
- Corrélo y comprobá que falla por la razón esperada.
- Recién después implementá.

Casos mínimos:

- La semana de una sede con su hora y su cupo.
- Elegir sede cuando la sesión está en «Todas mis sedes».
- Pasar de semana.
- Una fecha cancelada.
- Alta y edición de una clase.
- El 409 con su mensaje.
- Cancelar una fecha.
- Sin `agenda.gestionar` no aparecen los botones.
- Sin `agenda.ver` no aparece el enlace.

Tests del panel (no necesitan base de datos):

    pnpm --filter @app/web test

Controles (sin los tests de base, que en esta PC no corren):

    pnpm formato; pnpm lint; pnpm tamanos; pnpm agentes; pnpm arquitectura; pnpm muerto; pnpm tipos

Para verlo en el navegador, levantá tu propia API y tu propio panel. Los puertos 3000 y 5173 ya
están en uso por el otro agente, y si `wt-codex` está corriendo, también los 3001 y 5174. La base
es la misma, un Postgres instalado como servicio.

    $env:PUERTO="3002"; $env:ORIGEN_PANEL="http://localhost:5175"; pnpm --filter @app/api dev
    $env:API_URL="http://localhost:3002"; pnpm --filter @app/web exec vite --port 5175

Antes, aplicá las migraciones de agenda a la base local con `pnpm db:migrar`. Entrá en
http://localhost:5175 con la cuenta de prueba de `herramientas/src/semilla-cli.ts`.

## Commits

- Autor: el que ya está configurado en el repo (Pedro Grecco).
- **Nunca** pongas `Co-Authored-By`, «Generated with…» ni menciones a un agente.
- Commits chicos, con mensajes como los del repo («Panel: …»).
- **No hagas push.** El hook pre-push corre `pnpm check` completo y en esta PC falla por la base;
  el push lo decide Pedro.

Al terminar, dejá un resumen con:

- Qué cambiaste.
- Qué tests sumaste, y que los viste fallar antes.
- Qué controles corriste.
- Qué quedó pendiente.
