# Decisiones pendientes de revisión

_Fecha: 08/11/2026. Trabajo autónomo del back, sin push._ El detalle completo de cada paso (ramas,
commits, validación y comandos para pushear y abrir cada PR) está en
`C:\Users\Administrator\code\noche-2026-11-08.md`, sección «Registro». Las descripciones de los PRs
están en `C:\Users\Administrator\code\pr-*.md`.

Este archivo va en la última rama de la pila (`worker`). Cuando las decisiones estén revisadas,
se pasan a `docs/decisiones/` o a `docs/pendientes.md` y este archivo se borra.

## Resumen: qué quedó hecho

Backend de la Fase 2 y la Fase 3 (asistencia, abonos y caja), más el worker. Todo con test
primero contra Postgres real, en ramas locales apiladas y sin push:

| #   | Rama                            | Qué agrega                                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| —   | `sesion-zona-horaria`           | La sesión trae la zona horaria del centro. Sale de `main` y es independiente                     |
| 1   | `agenda-lista-inscriptos` (#11) | Inscriptos de una clase con el nombre de cada alumno                                             |
| 2   | `agenda-para-asistencia`        | `agenda` les da a otros módulos una fecha (con cupo) y sus inscriptos en un momento              |
| 3   | `asistencia-tomar`              | Módulo `asistencia`: planilla de cada fecha, tomar y corregir                                    |
| 4   | `asistencia-avisos`             | Avisos de ausencia antes de la clase                                                             |
| 5   | `asistencia-creditos`           | Créditos para recuperar por aviso a tiempo                                                       |
| 6   | `asistencia-recuperaciones`     | Recuperar con créditos, con los lugares de cada fecha y su bloqueo                               |
| 7   | `abonos`                        | Módulo `abonos`: planes, precios por sede, cuotas mensuales y `registrarPago`/`revertirPago`     |
| 8   | `caja`                          | Módulo `caja`: cobrar con clave de idempotencia, anular, día de caja y `PagoRegistrado` (outbox) |
| 9   | `worker`                        | `apps/worker`: procesa la cola; hoy `PagoRegistrado` queda en el log                             |
| 10  | `abonos-cuotas-del-mes`         | Cuotas impagas de una sede y generar las cuotas del mes de una sede                              |

## Decisiones tomadas sin el usuario (revisar)

Cada una indica qué se decidió, qué alternativas había, por qué se eligió esa y qué hay que
revisar. Las reglas de negocio están en un solo lugar del dominio para que cambiarlas sea fácil.

### Asistencia

1. **Ventana para tomar asistencia.**
   - Decisión: desde 1 hora antes del inicio y sin límite después.
   - Alternativas: solo durante la clase, o cerrar la planilla después de N días.
   - Por qué: la recepción marca en la puerta y hay que poder corregir.
   - Revisar: si Stretch Inn quiere cerrar la planilla.
   - Dónde: `modulos/asistencia/src/dominio/planilla.ts`.
2. **Estados de la planilla.**
   - Decisión: solo presente y ausente. La ausencia avisada va en su propia tabla.
   - Alternativa: un tercer estado, «avisó».
   - Por qué: el aviso tiene reglas propias (antes del inicio, genera crédito) y un alumno que
     avisó puede igual venir.
3. **Hasta cuándo se avisa.**
   - Decisión: hasta el inicio de la clase. Si el aviso da crédito lo deciden los créditos.
4. **Permiso propio para avisar** (`asistencia.avisar`).
   - Alternativa: reusar `asistencia.tomar`.
   - Por qué: puede avisar quien atiende el teléfono aunque no tome lista.
   - Revisar: si se juntan.
5. **[SUPUESTO] Crédito.**
   - Decisión: un aviso con **2 horas** o más de anticipación da crédito, y el crédito vence a
     los **30 días** de la fecha.
   - Dónde: `modulos/asistencia/src/dominio/credito.ts`.
   - Revisar: confirmar con Stretch Inn.
6. **[SUPUESTO] Dónde se recupera.**
   - Decisión: en cualquier clase de la **misma sede** (`recuperarEnOtraSede`: no, 0011), con el
     crédito que vence antes y sin tope acumulado.
   - Alternativas: solo en la misma actividad, en otras sedes, o con un tope.
7. **Bloqueo de los lugares de una fecha.**
   - Decisión: `pg_advisory_xact_lock` por fecha.
   - Alternativa: una fila de `asistencia` por fecha con `for update`.
   - Por qué: la fecha es una tabla de `agenda`, y `asistencia` no la toca.
   - Respaldo: los índices únicos parciales son la última barrera, y hay un test determinístico
     del último lugar.
8. **Anular un aviso** se rechaza si su crédito ya se usó o si su lugar lo ocupó una
   recuperación.
   - Alternativa: anular en cascada la recuperación.
   - Por qué: es conservador y no le saca el lugar a nadie sin avisarle.

### Abonos

9. **[SUPUESTO] Abono mensual, por mes calendario** en la zona del centro, con una cuota por
   alumno y mes y el monto congelado al generarla.
   - Alternativas: paquete de clases, o desde la fecha de alta.
   - Revisar: con Stretch Inn.
10. **[SUPUESTO] La sede de la cuota** (la que define el precio) es la de las clases del alumno.
11. **[SUPUESTO] Permisos** `abonos.ver`, `abonos.gestionar` y `abonos.asignar`.
    - Los planes son del centro: gestionarlos pide el permiso en alguna sede.
12. **Tope de precio de $100.000.000**, para frenar un cero de más.
    - Revisar: el valor.
13. **Sin descuentos, recargos por mora, prorrateo ni redondeo a $10/$100** todavía (0011: no
    se suma configuración «por si acaso»).
14. **[SUPUESTO] Las cuotas del mes son la renovación de las del mes anterior.**
    - Decisión: `POST /abonos/cuotas/mes` toma las cuotas vigentes (pagas o no) del mes anterior
      en la sede y genera la del mes con el mismo plan y el precio de hoy. Saltea alumnos y planes
      de baja y no toca a quien ya la tiene, así que repetirlo no duplica.
    - Alternativas: guardar el plan de cada alumno (una «suscripción») o derivarlo de las
      inscripciones de `agenda`.
    - Por qué: no hay todavía dónde está el plan de cada alumno, y la cuota del mes anterior lo
      dice sin tabla nueva. Un alumno nuevo recibe su primera cuota a mano.
    - Revisar: si Stretch Inn prefiere una suscripción explícita o que el worker lo dispare solo
      el día 1 (eso necesita el actor de sistema, decisión 21).

### Caja

14. **El cobro marca la cuota pagada en la misma transacción**, llamando a `registrarPago` del
    `index.ts` de `abonos`.
    - Alternativa: que `abonos` escuche `PagoRegistrado` en el worker, como el ejemplo de la 0003.
    - Por qué: el pago y la cuota quedan juntos o ninguno, sin una ventana en que el pago existe
      y la cuota sigue impaga.
    - El evento `PagoRegistrado` igual se publica (outbox) para los que escuchen después.
    - Revisar: si se prefiere el evento y, en ese caso, actualizar la 0003.
15. **[SUPUESTO] Medios de pago:** efectivo, transferencia, débito, crédito y Mercado Pago.
16. **[SUPUESTO] Sin pagos parciales:** se cobra la cuota completa.
17. **[SUPUESTO] Un pago se anula en cualquier momento, con motivo obligatorio**, y la cuota
    vuelve a estar sin pagar.
    - Alternativa: solo el mismo día, o con cierre de caja.
18. **La clave de idempotencia la manda el panel** en el cuerpo (`claveIdempotencia`).
    - Alternativa: un header `Idempotency-Key`.
    - Por qué: el contrato Zod la valida igual que el resto del pedido.
    - Un mismo cobro repetido responde 200 con el mismo pago, y la misma clave en otra cuota da 409.
19. **Sin cola, `crearCaja` no publica el evento.** Es solo para los tests; la API siempre la
    pasa.
    - Revisar: si se prefiere hacerla obligatoria.

### Worker

20. **`PagoRegistrado` solo se registra en el log.** No hay todavía mensajería ni reportes que
    lo usen.
21. **No hay tareas programadas** (por ejemplo, generar las cuotas del mes).
    - Por qué: necesitan un actor de sistema en el `ContextoCentro`, que hoy solo admite usuario
      y soporte.
    - Es una decisión de estructura: decidir cómo se representa ese actor.

## Huecos conocidos (no resueltos)

- **`agenda` puede pasarse del cupo de una fecha con recuperaciones.** Si inscribe a alguien en
  una clase que ya tiene recuperaciones reservadas en una fecha futura, `agenda` no sabe de
  recuperaciones. Opciones:
  - un evento de `agenda` para que `asistencia` reacomode;
  - que `agenda` le consulte los lugares a `asistencia`. Esto crea un ciclo de dependencias y
    habría que invertirlo con un puerto.
- **Inscripciones de un alumno dado de baja:** falta definir si se dan de baja solas. Hoy
  siguen y figuran marcadas `activo: false`.
- **Asistencia no consulta si el alumno tiene el abono al día.** Falta definir si eso bloquea
  tomar asistencia o recuperar.

## Lo que tiene que hacer el usuario (no lo hice)

- **Pushear y abrir los PRs** en el orden de la tabla. Los comandos están en el Registro de
  `noche-2026-11-08.md`. Después de mergear cada uno, cambiar en GitHub la base del siguiente a
  `main`.
- **Conflicto esperable en `pnpm-lock.yaml`** entre `sesion-zona-horaria` y la pila. Se resuelve
  con `pnpm install` en la rama y un commit.
- **Railway:** crear el servicio del worker (`pnpm --filter @app/worker start`) con la misma
  `DATABASE_URL` que la API. No lo hice porque cambia infraestructura y puede tener costo.
- **Relevamiento con Stretch Inn** para confirmar los [SUPUESTO] de arriba.

## Qué falta del back

- Mensajería por WhatsApp (Fase 5), reportes, licencias y auditoría (con el aviso de
  `identidad` en cada cambio de permisos).
- Tareas programadas del worker (cuotas del mes, limpieza de sesiones vencidas) y el actor de
  sistema que necesitan.
- Prueba de carga con k6 sobre cobrar, tomar asistencia y reservar recuperación (0013), antes de
  producción.
- Las pantallas del panel para todo lo nuevo: la de Agenda la está haciendo Codex en `wt-agenda`.

## Cómo probarlo

Con el PostgreSQL de servicio de esta PC (o `pnpm db:levantar` en una PC sin el problema del
usuario administrador), en el worktree `C:\Users\Administrator\code\wtwk`:

    pnpm install
    pnpm check                                   # todo; en esta PC falla solo db/salida.test

Por paquete, contra el Postgres de servicio:

    cd modulos/asistencia; pnpm exec vitest run --config vitest.servicio.local.ts

De punta a punta, a mano:

    pnpm db:migrar; pnpm db:semilla; pnpm dev

Esto levanta la API, el panel y el worker. Con la sesión del panel ya iniciada, el recorrido es:

1. `POST /api/abonos/planes`
2. `POST /api/abonos/cuotas`
3. `POST /api/caja/cobros`, con una `claveIdempotencia`
4. En el log del worker aparece «Pago registrado.».

Último resultado: en `wtwk` pasan los tests de todos los paquetes (agenda 62, asistencia 38,
abonos 20, caja 14, worker 1, identidad 126, personas 26, plataforma 25, centros 6, api 27,
herramientas 20, contratos y web). En db pasan 25 de 26: `salida.test` necesita el Postgres
embebido y lo cubre el CI.
