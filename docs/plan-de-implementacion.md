# Plan de implementación

_Última actualización: 12/11/2026._

Orden en que se construye el sistema. El porqué de cada pieza está en `docs/decisiones/`; los temas abiertos, en `docs/pendientes.md`. Cada fase indica su frente (ver 0006).

El documento de [alcance y reglas compartidas](alcance-y-reglas-compartidas.md) define cómo se conectan los módulos y qué recorridos validar en cada entrega.

## Primer lanzamiento para Stretch Inn

Fases 0 a 3 con el panel (`apps/web`). El sistema central incluye alumnos y profesores, agenda y cupos, asistencia y recuperaciones, abonos, pagos y gastos, reportes y administración de Río Tercero y Mendoza con permisos por sede. El portal de alumnos (Fase 4) y WhatsApp (Fase 5) quedan para una segunda entrega.

## Arrancar ya, en paralelo al código

- **Servidor de WAHA** (0021): alojarlo y vincular el número de Stretch Inn antes de la Fase 5.
- **Relevamiento con Stretch Inn** (lista en `docs/pendientes.md`): bloquea la Fase 3.

## Fase 0 — Cimientos (estructura)

Sin esto no se puede construir ningún módulo.

1. **`pnpm check` en verde:** configurar ESLint, dependency-cruiser y Knip (hoy los scripts existen pero faltan sus configuraciones) y el hook `pre-push` con lefthook.
2. **`paquetes/nucleo`:** corregir primero los tests que contradicen decisiones y después implementar:
   - `Dinero` en pesos enteros con redondeo al peso (0009); el test actual usa centavos.
   - `ContextoCentro` con permisos por sede y `puede(ctx, permiso, sedeId)` (0007); el test actual usa un `alcance` de centro o sedes.
   - `Resultado`.
3. **Instrucciones para agentes:** el generador de módulos crea `AGENTS.md` + `CLAUDE.md` con `@AGENTS.md` (0005); escribir los `AGENTS.md` definitivos de la raíz, `db/` y `apps/web` a partir de `docs/borradores-agents/`.
4. **`db/`:** Postgres local, Drizzle y migraciones, rol `app_usuario` sin `BYPASSRLS`, funciones `app_centro_actual()` y `app_puede_ver_sede()` (`STABLE`), y el test que recorre todas las tablas con `centro_id` y falla si alguna no tiene RLS (0002, 0013).
5. **`paquetes/plataforma`:** transacción con `SET LOCAL` del contexto, logs JSON en stdout con pino y traza, manejador global de errores con código corto para el usuario, outbox y cola con pg-boss (0003, 0016).
6. **`apps/api`:** Fastify con `/salud`, registro de rutas con permiso obligatorio y el test que lo exige (0007), paginación obligatoria en `paquetes/contratos` (0013).
7. **Infraestructura:** repo privado en `grevex-it`, CI en GitHub Actions (avisa, no bloquea), Railway con `staging` y `production`.

## Fase 1 — Centros e identidad (estructura)

- `centros`: centro y sedes.
- `identidad`: login, usuarios, roles (plantillas y personalizados), roles por sede, ajustes individuales y permisos efectivos, con las reglas de seguridad de 0007.
- `auditoria`: historial del centro, sin vencimiento.
- Consola de plataforma mínima: alta de centro con su admin general y entrada como soporte a un centro por vez (0008).
- Base de `apps/web`: login, estructura de pantalla, selector de sede, carga por módulo.

## Fase 2 — Operación básica (negocio)

Puede empezar en paralelo con la Fase 1 en cuanto exista `plataforma` (Fase 0, punto 5).

- `personas`: gestión de alumnos y profesores. Los alumnos pertenecen al centro (0011).
- `agenda` (completo): clases semanales, ocurrencias, cupos con bloqueo de fila y restricción en la base (0013), e **inscripciones**.
- **Cada sede gestiona lo suyo:** inscripciones, clases y la operación diaria llevan `sede_id`; cada usuario opera solo en las sedes donde tiene permiso (0002, 0007).

## Fase 3 — Abonos, caja y asistencia (negocio)

Depende del relevamiento con Stretch Inn.

- `abonos`: planes y precios del centro con precio opcional por sede (0011).
- `caja`: cobros con clave de idempotencia; emite `PagoRegistrado` (0003, 0013).
- `asistencia`: toma de asistencia, ausencias avisadas, créditos y reservas de recuperación.
- **Gastos:** registrar gastos por sede.
- **Reportes:** alumnos activos y bajas, clases asignadas por profesor, ocupación y cupos, asistencias y recuperaciones, estado de abonos, cobros, anulaciones, gastos y saldo del período. Filtrar por período y sede y permitir una vista consolidada según los permisos de cada usuario.
- **Sedes:** configurar Río Tercero y Mendoza y validar que el equipo pueda operar ambas desde el panel con los permisos asignados.
- Antes de salir a producción: prueba de carga con k6 sobre cobrar, tomar asistencia y reservar recuperación (0013), y backups con restauración probada.

### Integración con el portal de alumnos

- El panel y el portal usan los mismos datos y reglas de negocio. La cuenta del alumno se vincula a su ficha y permite consultar sus propios abonos y asistencias y los cupos disponibles de las clases que le corresponden. La consulta de cupos muestra la disponibilidad sin exponer datos de otros alumnos.
- Cuando el alumno avisa una ausencia, el equipo ve el aviso en la planilla y el reporte de asistencia, con el crédito generado cuando corresponda. Cuando reserva o cancela una recuperación, se actualizan la agenda, los cupos y los reportes. Los cambios que registra el equipo también se reflejan en las consultas del alumno.
- Si el alumno y el equipo intentan reservar a la vez el último cupo de una recuperación, se confirma una sola reserva. Ambos canales muestran la disponibilidad actualizada.

## Fase 4 — Portal de alumnos (segunda entrega)

Portal web para celular para consultar abonos, asistencias y cupos, avisar ausencias y gestionar reservas de recuperación. Usa la integración definida en la Fase 3.

PWA con funcionamiento limitado sin conexión y cola de avisos con idempotencia (0014).

## Fase 5 — Mensajería y licencias (segunda entrega)

- `mensajeria`: WhatsApp por WAHA, con un número por centro y ritmo de envío limitado (0021).
- `licencias`: en USD con cotización guardada (0009).

## Transversal: logs y alertas

- **Fase 0:** logs JSON en stdout, traza por pedido, manejador de errores.
- **Antes del primer lanzamiento:** esquema `logs` con grupos y huellas, alertas de capa 1 y 2 por Telegram, monitor externo de `/salud`, latido del worker y `pnpm logs` (0015, 0016).
- **Después:** resúmenes de capa 3 y 4, fallas silenciosas por módulo, errores del navegador.
