# 0006 — Dos frentes de trabajo: estructura y negocio

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Somos dos. Uno se encarga de la estructura (repo limpio, funciones generales, plataforma) y el otro de las reglas de negocio. Ninguno necesita autorización del otro para trabajar.

## Decisión

- El repo se trabaja en dos frentes separados:
  - **Estructura:** `paquetes/`, `db/` (salvo las migraciones de cada módulo), `herramientas/`, CI, la base de las apps (`src/base/`) y los módulos `centros`, `identidad`, `licencias` y `auditoria`.
  - **Negocio:** el resto de los módulos y sus pantallas.
- Una tarea de un frente no modifica el otro. Si una tarea de negocio necesita un cambio de estructura (o al revés), se propone por separado.
- `nucleo`, `contratos` y la API pública de `plataforma` los usan todos: cambiarlos afecta a todo el sistema.
- En los `AGENTS.md` no figuran nombres de personas: solo los frentes y la regla de frontera.
- **Sin aprobaciones obligatorias ni reglas que bloqueen en GitHub.** El CI corre en cada PR y en cada push a `main` y avisa; mergear queda a criterio de cada uno. Plan gratuito de GitHub.
- Hook `pre-push` con `pnpm check` para ver los problemas antes de subir (se puede saltear).

## Consecuencias

- PR separados por frente: más fáciles de revisar y de revertir.
- Para no depender de una sola persona por área, los dos leen lo que hace el otro aunque no haga falta aprobarlo, y los `AGENTS.md` y decisiones sirven también de documentación entre ambos.
