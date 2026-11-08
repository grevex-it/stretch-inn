# Consigna para Codex — panel de Stretch Inn

Trabajás en paralelo con otro agente (Claude). Vos hacés el **panel** (`apps/web`); el otro, el
back y la estructura. Para no pisarse, cada uno tiene su carpeta y su rama.

## Dónde

- Carpeta: `C:\Users\Administrator\code\wt-codex` (worktree de git). **Trabajá solo acá.**
- Rama: `panel-alumnos-detalles`, que sale del panel de Alumnos ya corregido (PR #6 + arreglo).
- Antes de cualquier cambio leé `AGENTS.md` (raíz) y `apps/web/AGENTS.md`. Las reglas valen
  igual para vos: test primero, archivos de hasta 300 líneas, español argentino con voseo.

## Tareas (pantalla Alumnos, `apps/web/src/modulos/personas/`)

1. **Página fuera de rango después de una baja.** Si se da de baja al único alumno de la última
   página, la lista queda en «Página 3 de 2» con la tabla vacía. Que vuelva a la última página
   que existe.
2. **Cambios sin guardar.** Con una ficha a medio editar, tocar «Editar» en otra fila (o
   «Sumar alumno») descarta lo escrito sin avisar. Que pida confirmación si hay cambios sin
   guardar; si no los hay, que cambie directo.

Para cada una: escribí primero el test en `apps/web/test/` (panel montado entero con
`montarPanel` y `servidorFalso`), corrélo y comprobá que falla por la razón esperada; después
implementá lo mínimo.

## Qué NO tocar

- Nada fuera de `apps/web/src/modulos/` y `apps/web/test/`.
- `apps/web/src/base/` es estructura. Si necesitás cambiar algo ahí, frená y explicá por qué.
- `paquetes/contratos` (los esquemas entre API y panel): si te falta algo, frená y pedilo.
- `modulos/`, `db/`, `paquetes/`, `herramientas/`, `apps/api`: son del otro agente.
- No cambies de rama ni toques las otras carpetas de `C:\Users\Administrator\code\`.

## Cómo probar

Tests del panel (no necesitan base de datos):

    pnpm --filter @app/web test

Controles (sin los tests de base, que en esta PC no corren: el Postgres embebido no arranca
con un usuario administrador):

    pnpm formato; pnpm lint; pnpm tamanos; pnpm agentes; pnpm arquitectura; pnpm muerto; pnpm tipos

Para verlo en el navegador, con tu propia API y tu propio panel (los puertos 3000 y 5173 ya
están en uso por el otro agente; la base es la misma, un Postgres instalado como servicio):

    $env:PUERTO="3001"; $env:ORIGEN_PANEL="http://localhost:5174"; pnpm --filter @app/api dev
    $env:API_URL="http://localhost:3001"; pnpm --filter @app/web exec vite --port 5174

Entrá en http://localhost:5174 con la cuenta de prueba de `herramientas/src/semilla-cli.ts`.

## Commits

- Autor: el que ya está configurado en el repo (Pedro Grecco).
- **Nunca** pongas `Co-Authored-By`, «Generated with…» ni menciones a un agente.
- Un commit por tarea, con mensajes como los del repo («Panel: …»).
- **No hagas push.** El hook pre-push corre `pnpm check` completo y en esta PC falla por la base;
  el push lo decide Pedro.

Al terminar, dejá un resumen: qué cambiaste, qué tests sumaste (y que los viste fallar antes),
y qué controles corriste.
