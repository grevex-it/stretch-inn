**Avisos de ausencia antes de la clase**, segunda parte de `asistencia`.

**Apilado sobre `asistencia-tomar`.**

## Qué hace

- Un alumno inscripto en una fecha (o la recepción por él) avisa que no va. Vale hasta el inicio de la clase y solo si la fecha no está cancelada.
- Hay un aviso vigente por alumno y fecha (índice único parcial), así que avisar dos veces no duplica.
- Anular el aviso (porque al final viene) sigue la misma regla y no borra: marca `anulado_en`. Después se puede volver a avisar.
- Con aviso, igual se le puede tomar asistencia: si vino, queda presente.
- La planilla suma el `avisoId` de cada renglón, para que el panel lo muestre y lo pueda anular.
- Rutas:
  - `POST /asistencia/fechas/:id/avisos` recibe `{ alumnoId }` y responde 201 con `{ id }`.
  - `DELETE /asistencia/avisos/:id` responde 204.
  - Las dos piden el permiso nuevo **`asistencia.avisar`** en la sede de la fecha. El permiso se le da al Dueño por migración.
- Tabla `avisos_de_ausencia`, con RLS por centro y sede y claves hacia fechas, alumnos, centros y sedes.

## Decisiones para revisar

- **Avisar no decide el crédito.** El aviso se acepta hasta el inicio, sin anticipación mínima. Si da derecho a recuperar, y con cuánta anticipación, es una regla de los créditos, que depende del relevamiento. Así esa decisión no bloquea este PR, y no se suma configuración «por si acaso» (0011).
- **Permiso propio, `asistencia.avisar`.** Puede avisar quien atiende el teléfono aunque no tome lista. Si no hace falta separarlo, se puede juntar con `asistencia.tomar`.

## Cómo se probó

- Test primero en dominio, casos de uso, contrato y rutas, visto fallar antes de implementar.
- Integración contra Postgres real:
  - el aviso en la planilla, sin duplicar;
  - anular y volver a avisar;
  - tomar presente con aviso;
  - un alumno no inscripto, la clase ya empezada y la fecha cancelada;
  - permisos por sede y otro centro.
- Rutas: el permiso declarado y los códigos 201, 204, 404 y 409.
- En verde: asistencia 21, agenda, api, herramientas (incluido el guardián del Dueño), contratos y web. En db pasan 25 de 26, incluido el test de aislamiento; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
