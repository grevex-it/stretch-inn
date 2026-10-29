# 0005 — Instrucciones para agentes: AGENTS.md como fuente de verdad

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Usamos Claude Code y, a veces, Codex. Las instrucciones para agentes son la constitución del repo: si mienten o divergen entre herramientas, los agentes trabajan con información falsa.

## Decisión

- **`AGENTS.md` es la fuente de verdad** (lo lee Codex). Al lado de cada uno hay un `CLAUDE.md` que contiene solo `@AGENTS.md` (lo lee Claude Code). Archivos de import, no symlinks: en Windows los symlinks dentro de git dan problemas.
- Tres niveles:
  1. **Raíz** (menos de 150 líneas): qué es el producto, mapa del repo, reglas que no se negocian, cómo se trabaja, comandos, frentes de estructura y negocio.
  2. **Uno por módulo**, con plantilla fija: alcance, fuera de alcance, depende de, API pública, eventos, invariantes, glosario, configuración por centro, pendientes.
  3. **Uno por carpeta transversal** (`db/`, `apps/web/`, `apps/portal/`). No se usan las reglas por patrón de `.claude/rules/` porque Codex no las entiende.
- El `AGENTS.md` raíz dice explícitamente: «antes de tocar un módulo, leé su `AGENTS.md`», porque Codex solo carga los archivos del camino hasta la carpeta donde se lanzó.
- **Qué no va:** lo que ya controla una herramienta (alcanza con «corré `pnpm check`»), estados y avances, documentación larga (se enlaza), instrucciones vagas.
- **Recetas** para tareas repetidas (crear módulo, migración, caso de uso) en `docs/recetas/`, en Markdown, para que las sigan los dos agentes.
- Las reglas de trabajo que tienen que valer para todos (TDD, `pnpm check`, separar implementado de validado) van en el `AGENTS.md` raíz, no en la configuración personal de cada uno.

## Controles contra la desactualización

- El CI verifica que cada `AGENTS.md` tenga al lado un `CLAUDE.md` con solo `@AGENTS.md`.
- El CI verifica que cada módulo tenga su `AGENTS.md` con todas las secciones de la plantilla, y que «Depende de» coincida con su `package.json`.
- Advertencia en el PR si cambió el `index.ts` o los eventos de un módulo y su `AGENTS.md` no.
- Los hooks de Claude Code son un extra; el control que vale para cualquier agente y para las personas es el hook de git (`pre-push`) y el CI.
- Codex tiene un límite de tamaño para las instrucciones (alrededor de 32 KB sumando lo que carga): otra razón para mantenerlas cortas.

Los borradores acordados están en `docs/borradores-agents/`.
