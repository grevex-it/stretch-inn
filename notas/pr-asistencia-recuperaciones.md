**Recuperar con créditos, con los lugares de cada fecha.** Cuarta parte de `asistencia`.

**Apilado sobre `asistencia-creditos`.**

## Qué hace

- Reserva un lugar en una fecha de otra clase de la misma sede, con el crédito que vence antes y que siga vigente al empezar la fecha.
- **Lugares de la fecha** = cupo − inscriptos + avisos − recuperaciones, nunca en negativo.
  - Reservar y anular un aviso toman la fecha con un bloqueo de la transacción (`pg_advisory_xact_lock` por fecha), así que van de a uno.
  - Los índices únicos parciales son la última barrera: un crédito por recuperación vigente y un alumno por fecha.
- Anular la recuperación antes del inicio devuelve el crédito con su vencimiento original.
- Se rechaza anular un aviso:
  - si su crédito ya se usó (primero hay que anular la recuperación);
  - si su lugar ya lo ocupó una recuperación.
- La planilla trae a los que recuperan (la misma página) y los lugares libres. A los que recuperan también se les toma asistencia.
- Rutas, con el permiso nuevo `asistencia.recuperar`:
  - `POST /asistencia/fechas/:id/recuperaciones`;
  - `DELETE /asistencia/recuperaciones/:id`.
- Tabla `recuperaciones` con RLS por centro y sede.
- `obtenerFecha` de `agenda` suma el `cupo`, en un commit nuevo de `agenda-para-asistencia`.

## Supuestos y huecos

- **[SUPUESTO]** Se recupera en cualquier clase de la misma sede (`recuperarEnOtraSede`: no, 0011), con el crédito que vence antes, y no hay tope de créditos.
- **Hueco documentado:** si `agenda` inscribe a alguien en una clase que ya tiene recuperaciones en una fecha futura, esa fecha se puede pasar del cupo, porque `agenda` no sabe de recuperaciones. Queda en Pendientes, para resolverlo con un evento o con una consulta.

## Cómo se probó

- Test primero en dominio, casos de uso y rutas, visto fallar antes de implementar. El test del contrato lo escribí antes que el esquema, pero no lo corrí antes de implementarlo.
- Dominio sin base: la cuenta de lugares y las reglas para reservar.
- Integración contra Postgres real:
  - reservar, que figure en la planilla y tomarle asistencia;
  - sin crédito, en su propia clase, dos veces en la misma fecha y sin lugar;
  - el aviso de un fijo que libera un lugar y después no se puede anular;
  - anular la recuperación, con un crédito usado y sin permiso.
- **El último lugar disputado por dos a la vez, en forma determinística:** otra conexión toma la fecha, espera que los dos pedidos queden frenados y la suelta. Entra uno solo. Sin el bloqueo en el código, el test falla.
- En verde: asistencia 38, agenda 62, api, herramientas, contratos y web. En db pasan 25 de 26; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
