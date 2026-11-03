# 0004 — Stack

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Criterio

El código lo escriben agentes. Gana el stack donde las reglas se pueden **verificar automáticamente**, no el que más dominamos.

## Decisión

| Capa          | Elección                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lenguaje      | TypeScript estricto en todo (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; prohibidos `any` y `@ts-ignore`) |
| Monorepo      | pnpm workspaces + Turborepo                                                                                                       |
| Backend       | Fastify + Zod, dependencias conectadas a mano                                                                                     |
| Base de datos | Postgres + Drizzle + RLS                                                                                                          |
| Tareas y cola | pg-boss, sobre el mismo Postgres                                                                                                  |
| Front         | React + TypeScript + Vite + TanStack Router y TanStack Query                                                                      |
| Contratos     | Esquemas Zod en `paquetes/contratos`, compartidos por API y front; OpenAPI generado                                               |
| Tests         | Vitest, Postgres real para integración, Playwright para flujos críticos                                                           |
| Alojamiento   | Railway                                                                                                                           |

## Por qué

- **TypeScript en todo:** el compilador es la revisión más barata para un agente, y un solo sistema de tipos va de la base a la pantalla sin pasos de generación que se puedan olvidar. Los workspaces impiden importar lo que no está declarado.
- **Fastify y no NestJS:** NestJS resuelve dependencias en tiempo de ejecución con decoradores; un provider faltante compila y explota al arrancar, y un agente no lo ve. Con Fastify y conexión explícita, lo verifica el compilador. La convención que se pierde se repone con plantillas y CI.
- **Drizzle y no Prisma:** RLS necesita fijar el centro en cada transacción (`set_config`); Drizzle lo deja explícito, Prisma oculta conexión y transacciones.
- **pg-boss:** sin servicio extra; el evento y el cambio de datos se guardan en la misma transacción. Si el volumen lo exige, se pasa a BullMQ + Redis.
- **Vite y no Next.js:** el panel está detrás de un login, sin SEO ni render en servidor; Next.js agregaría complejidad sin beneficio. Una landing comercial, si hace falta, es otra cosa.

## Controles que mantienen el orden

| Control                                                     | Herramienta                                            |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Límites físicos entre paquetes                              | pnpm workspaces + `exports`                            |
| Capas y módulos, sin ciclos                                 | dependency-cruiser                                     |
| Tamaño: 300 líneas por archivo, 50 por función, complejidad | ESLint + control propio que incluye CSS                |
| Código muerto                                               | Knip                                                   |
| Estructura de módulos                                       | Generador `pnpm nuevo-modulo`                          |
| Aislamiento entre centros y sedes                           | Test de RLS (ver 0002)                                 |
| Rutas sin permiso declarado                                 | Test que falla si una ruta no exige permiso (ver 0007) |
| Antes de subir                                              | Hook `pre-push` con `pnpm check` (lefthook)            |

Ningún control es obligatorio en GitHub (ver 0006): el CI corre y avisa, pero no bloquea el merge.
