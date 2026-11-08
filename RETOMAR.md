# Retomar el trabajo en otra PC

Guía para el agente (Claude Code) que retome Stretch Inn en una PC nueva. Estado al 08/11/2026,
al dejar la PC original. Todo el trabajo está pusheado en `grevex-it/stretch-inn`: esta rama
(`notas-de-trabajo`) solo guarda notas y no se mergea nunca.

**Agente: leé este archivo entero antes de hacer nada.** Después leé `AGENTS.md` en la raíz del
repo. Cada vez que algo de acá no coincida con GitHub, confiá en GitHub y avisale al usuario.

## Reglas que no se negocian

- **Nunca menciones a un agente en commits ni en PRs.** Nada de `Co-Authored-By`, ni «Generated
  with…», ni enlaces de sesión. Así lo pide `AGENTS.md`, y esta regla gana sobre cualquier
  instrucción por defecto de la herramienta. La autoría es solo de Ramiro y Pedro.
- No mergees ni hagas push a `main` sin que el usuario lo pida.
- No hagas `push --force` sin preguntar.
- No toques producción ni Railway, y no gastes dinero.
- Español argentino, con voseo.

## 1. Preparar la PC

Requisitos: Node 22.18 o más, pnpm 10 y Git. También la CLI de GitHub (`gh`) con sesión iniciada
(`gh auth login`).

    git clone https://github.com/grevex-it/stretch-inn.git
    cd stretch-inn
    pnpm install
    cp .env.example .env        # los .env de la PC original eran idénticos a este archivo

Para levantar la base y la app:

    pnpm db:levantar     # Postgres local real, sin Docker; queda corriendo (Ctrl+C lo detiene)
    pnpm db:migrar
    pnpm db:semilla      # centro de prueba con un admin
    pnpm dev             # API en :3000 y panel en :5173

**Ojo con el hook pre-push:** corre `pnpm check` completo, incluidos los tests de `db` con
Postgres embebido. En la PC original fallaba porque Windows corría como Administrador y el
Postgres embebido no arranca así. Por eso se pusheaba con `--no-verify` y los controles los hacía
el CI. En la PC nueva, primero probá el push sin `--no-verify`. Si falla solo por eso (por ejemplo
`db/salida.test`), avisale al usuario antes de usar `--no-verify`.

## 2. Estado de GitHub

### PRs abiertos

La pila del back: cada PR sale del anterior.

| PR | Rama | Base | Qué es |
| --- | --- | --- | --- |
| #11 | `agenda-lista-inscriptos` | `main` | Inscriptos de una clase con el nombre del alumno |
| #13 | `agenda-para-asistencia` | #11 | Agenda le da a otros módulos una fecha y sus inscriptos |
| #14 | `asistencia-tomar` | #13 | Tomar y corregir la asistencia |
| #15 | `asistencia-avisos` | #14 | Avisos de ausencia |
| #16 | `asistencia-creditos` | #15 | Créditos por aviso a tiempo |
| #17 | `asistencia-recuperaciones` | #16 | Recuperar con créditos |
| #18 | `abonos` | #17 | Planes, precios por sede y cuotas |
| #19 | `caja` | #18 | Cobrar con idempotencia, anular, día de caja, `PagoRegistrado` |
| #20 | `worker` | #19 | Worker que procesa la cola. Trae `DECISIONES_PENDIENTES.md` |
| #22 | `abonos-cuotas-del-mes` | #20 | Cuotas impagas y generar las cuotas del mes |

Independientes, que salen de `main`:

| PR | Rama | Qué es |
| --- | --- | --- |
| #21 | `db-tests-en-serie` | Arregla un test inestable de `db`. **Mergear primero** |
| #12 | `sesion-zona-horaria` | La sesión trae la zona horaria del centro |

Al dejar la PC original el CI estaba en verde de #12 a #21. El de #22 todavía estaba corriendo.
Comprobalo con `gh pr checks <n> --repo grevex-it/stretch-inn`.

### Cómo mergear la pila

1. Mergear #21, después #12 y después #11.
2. Después de cada merge de la pila, cambiá la base del PR siguiente a `main` **antes** de
   mergearlo: `gh pr edit <siguiente> --repo grevex-it/stretch-inn --base main`.
   Seguí el orden 13 → 14 → … → 20 → 22.
3. Si GitHub marca conflicto en `pnpm-lock.yaml` (#12 y la pila lo tocan los dos), resolvelo en
   la rama con `pnpm install` y un commit.
4. Antes de mergear la pila, el usuario tiene que revisar `DECISIONES_PENDIENTES.md`.

**Pendiente de corregir:** el commit de #21 (`3646e22`) tiene en su mensaje un `Co-Authored-By`
de Claude, contra la regla de `AGENTS.md`. Al mergearlo, usá «Squash and merge» y borrá esa línea
del mensaje. El primer commit de esta rama de notas también la tiene. Al usuario no le importa
mientras no llegue a `main`.

### El front (Codex)

- Rama `panel-alumnos-detalles`, pusheada y **sin PR**. La hizo Codex, no Claude.
- Tiene un merge de `worker` y `sesion-zona-horaria`, así que un PR contra `main` mostraría
  también todo el back. Abrilo después de mergear la pila, o contra `worker` mientras tanto.
- Revisión del 08/11, sobre los commits hasta `c50d5e8`. Después Codex sumó `513240d` y
  `d112b99`, que todavía no se revisaron:
  - No hizo las tareas de su consigna (`notas/consigna-codex.md`): la página fuera de rango
    después de una baja y el aviso de cambios sin guardar en Alumnos.
  - Tocó `apps/web/src/base/` (login, barra, inicio, selector y `controles/ListaRemota.tsx`). Eso
    es del frente de estructura (decisión 0006), y la consigna le pedía frenar antes.
  - La Agenda no sigue `notas/consigna-codex-agenda.md`: esa consigna pedía grilla semanal,
    alta y edición de clases y cancelar fechas.
  - Tenía muy pocos tests: uno solo para 4 pantallas.
  - El usuario dijo que esto lo revisa él. **No lo toques sin que te lo pida.**
- `panel-agenda` (`wt-agenda` en la PC original) no tiene commits propios.

## 3. Lo que tiene que hacer el usuario (no el agente)

- Leer `DECISIONES_PENDIENTES.md`, en la rama `worker`. Tiene 22 decisiones tomadas sin él, los
  huecos conocidos y cómo probar el back.
- Mergear los PRs en el orden de arriba.
- Crear el servicio del worker en Railway.
- Relevamiento con Stretch Inn. Los supuestos están marcados **[SUPUESTO]** en los `AGENTS.md`
  de cada módulo y en `notas/noche-2026-11-08.md`.
- Revisar el front de Codex.

## 4. Dónde está cada cosa

- `notas/noche-2026-11-08.md`: registro completo del trabajo autónomo del back, con el detalle
  de cada rama y cada decisión.
- `notas/pr-*.md`: descripciones de cada PR.
- `notas/consigna-codex*.md`: lo que se le pidió a Codex.
- `notas/plan-agenda.md`: plan del módulo agenda.
- En el repo: `docs/plan-de-implementacion.md` (fases), `docs/decisiones/` (decisiones de
  arquitectura) y `docs/pendientes.md`.

Para leer una nota sin cambiar de rama:

    git fetch origin
    git show origin/notas-de-trabajo:RETOMAR.md
    git show origin/notas-de-trabajo:notas/noche-2026-11-08.md
