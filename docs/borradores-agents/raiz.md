# Stretch Inn

Sistema de gestión para centros de clases con varias sedes (alumnos, agenda,
asistencia y recuperaciones, abonos, caja, WhatsApp). Un solo sistema sirve a
muchos centros: los datos de cada centro y de cada sede están aislados.

## Mapa

- `apps/api`: Fastify. Arma los módulos y expone HTTP. Sin lógica de negocio.
- `apps/worker`: tareas programadas y cola (pg-boss).
- `apps/web`: panel del centro (React). `apps/portal`: app de alumnos (PWA).
- `modulos/`: un paquete por módulo, cada uno con su `AGENTS.md`.
- `paquetes/nucleo`: tipos puros (ContextoCentro, Resultado, Dinero). Sin dependencias.
- `paquetes/plataforma`: base de datos con RLS, eventos, logs.
- `paquetes/contratos`: esquemas Zod compartidos entre la API y el front.
- `paquetes/ui`: componentes compartidos entre web y portal.
- `db/`: migraciones y reglas de base de datos (leé `db/AGENTS.md`).
- `docs/decisiones/`: por qué el sistema es como es. `docs/recetas/`: cómo hacer tareas comunes.

## Antes de empezar

1. Si vas a tocar un módulo o una app, **leé su `AGENTS.md`** antes de cualquier cambio.
2. Presentá un plan y esperá confirmación antes de implementar algo nuevo.
3. Si hay una receta para la tarea en `docs/recetas/`, seguila.

## Reglas que no se negocian

1. **Aislamiento.** Todo caso de uso recibe un `ContextoCentro` explícito. Nunca se
   consulta la base sin él, y nunca se arma un contexto «a mano» para saltear permisos.
2. **Montos en pesos enteros** (`Dinero` de `@app/nucleo`), sin centavos y nunca en
   punto flotante. El redondeo se hace solo en `Dinero`, al peso más cercano.
   Única excepción: `licencias` (USD, ver su `AGENTS.md`).
3. **Fechas en `timestamptz`, en UTC.** Se convierten a la zona del centro solo al mostrarlas.
4. **Los módulos se usan entre sí solo por su `index.ts`** o por eventos. Nunca se importan
   archivos internos de otro módulo ni se escribe en sus tablas.
5. **Un módulo por pull request.** Si la tarea necesita cambiar otro módulo, frená y explicalo.
6. **Toda ruta de la API declara el permiso que exige.**
7. **Toda operación que mueve dinero lleva clave de idempotencia**, y toda tarea del
   worker se puede ejecutar dos veces sin efecto doble.
8. **Ninguna lista sin paginar**, y nada de consultas dentro de un bucle (N+1).
9. **No silenciar controles**: nada de `any`, `@ts-ignore`, `eslint-disable` ni tests
   salteados. Si una regla molesta, se discute; no se esquiva.
10. **Nada de secretos en el repo.** Van en `.env` (ver `.env.example`) y en Railway.

## Cómo se trabaja

- **Test primero.** Escribí el test, corrélo y comprobá que falla por la razón esperada
  (no por un import roto); después implementá lo mínimo para que pase; después refactorizá.
- Reglas de negocio: tests unitarios del dominio, sin base. Repositorios y RLS: tests
  de integración contra Postgres real. Flujos críticos (cobrar, avisar ausencia,
  recuperar): E2E.
- **Antes de dar algo por terminado: `pnpm check`.** Si algo no se pudo validar, decilo
  explícitamente con el comando pendiente. No digas que funciona si no lo viste funcionar.
- Archivos de hasta 300 líneas y funciones de hasta 50. Si te pasás, el archivo está
  haciendo dos cosas: separalo por responsabilidad.
- Código, nombres, comentarios e interfaz en español argentino.

## Comandos

    pnpm check                        # formato, lint, tamaños, arquitectura, código muerto, tipos y tests
    pnpm --filter @app/<modulo> test  # tests de un módulo
    pnpm nuevo-modulo <nombre> <completo|liviano>
    pnpm db:migracion <nombre>        # crea una migración (ver db/AGENTS.md)
    pnpm db:migrar                    # aplica migraciones en local
    pnpm dev                          # levanta api, worker, web y portal

`pnpm check` controla automáticamente formato, tamaños, límites entre módulos y capas,
tipos estrictos, código muerto y aislamiento entre centros. No hace falta verificarlos a mano.

## Estructura y negocio

El repo se trabaja en dos frentes separados:

- **Estructura:** `paquetes/`, `db/` (salvo las migraciones de cada módulo),
  `herramientas/`, CI, la base de las apps (`src/base/`) y los módulos `centros`,
  `identidad`, `licencias` y `auditoria`.
- **Negocio:** el resto de los módulos y sus pantallas.

Una tarea de un frente no modifica el otro. Si una tarea de negocio necesita un
cambio de estructura (o al revés), frená y proponelo por separado.
`nucleo`, `contratos` y la API pública de `plataforma` los usan todos: cambiarlos
afecta a todo el sistema.
