# 0001 — Monolito modular en un monorepo

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Un producto para varios centros de clases, desarrollado por dos personas y escrito casi en su totalidad por agentes (Claude Code y, a veces, Codex). El orden del repo no puede depender de que alguien recuerde las reglas: tiene que imponerlo la estructura.

## Decisión

- **Una sola aplicación desplegable dividida en módulos** con límites estrictos (monolito modular). Sin microservicios.
- **Un solo repositorio** (monorepo) con pnpm workspaces y Turborepo.
- Cada módulo es un paquete en `modulos/<nombre>/`. Expone solo lo que exporta su `src/index.ts` (campo `exports` del `package.json`).
- Un módulo solo puede importar los paquetes que declara en su `package.json`.
- Estructura:

```
apps/         api (Fastify) · worker (pg-boss) · web (panel) · portal (PWA de alumnos)
modulos/      centros · identidad · licencias · auditoria · personas · agenda ·
              asistencia · abonos · caja · reportes · mensajeria
paquetes/     nucleo · plataforma · contratos · ui
db/           migraciones y reglas de base de datos
herramientas/ generador de módulos, control de tamaños
docs/         decisiones, recetas, pendientes
```

- `web` y `portal` son apps separadas: usuarios, logins y requisitos distintos. Lo común va en `paquetes/ui`.
- En las apps, las pantallas se organizan por módulo (`src/modulos/<modulo>/`) y la base común en `src/base/`.
- No hace falta separar un repo de trabajo y otro de entrega: el producto se ofrece bajo licencia y el código queda en GREVEX.

## Consecuencias

- Un cambio que toca migración, dominio, contrato, API y pantalla entra en un solo pull request y el CI lo verifica entero.
- Los contratos se comparten importándolos del workspace, sin publicar paquetes.
- Turborepo con caché para que el CI pruebe solo lo afectado.
- En Railway, cada servicio se redeploya solo si cambian sus carpetas.
- Los nombres de paquete son neutros (`@app/...`) para que el nombre del producto se pueda cambiar sin tocar el código.

## Alternativas descartadas

- **Microservicios:** resuelven problemas de equipos grandes; acá solo suman deploys, red y consistencia distribuida. Si un módulo algún día lo necesita, los límites ya permiten sacarlo.
- **Varios repos (api, web):** el contrato habría que publicarlo y versionarlo; los cambios cruzados quedan en varios PR que se desfasan, y un agente en un repo no ve lo que rompe en el otro.
