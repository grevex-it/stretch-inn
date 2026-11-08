Módulo nuevo **`abonos`**: planes, precios por sede y cuotas mensuales de los alumnos.

**Apilado sobre `asistencia-recuperaciones`.** No depende de asistencia, pero así las migraciones quedan en orden de timestamp (Drizzle saltea las de fecha anterior a la última aplicada).

## Qué hace

- **Planes del centro:**
  - nombre, clases por semana (1 a 7) y precio general en pesos enteros (`bigint`, 0009);
  - la edición compara la versión (0013);
  - la baja no borra el plan, solo deja de poder asignarse.
- **Precio por sede (0011):** es opcional. Sin precio propio, la sede usa el general. `DELETE` lo quita.
- **Cuotas:**
  - la cuota del mes de un alumno lleva el precio de la sede, congelado al generarla;
  - hay una cuota vigente por alumno y mes;
  - anular no borra y solo vale si no está pagada;
  - solo se genera para un alumno activo y un plan activo.
- **Para `caja`:** `obtenerCuota(tx, id)` y `registrarPago(tx, { cuotaId, pagoId, en })`. Esta última toma la cuota con `for update` y la marca pagada una sola vez, en la transacción del cobro.
- **Rutas:**
  - `GET /abonos/planes` y `GET /alumnos/:id/cuotas` piden `abonos.ver`;
  - `POST`/`PUT /abonos/planes`, la baja y el precio por sede piden `abonos.gestionar`;
  - `POST`/`DELETE /abonos/cuotas` piden `abonos.asignar`.
- **Base:** tablas `planes`, `precios_de_sede` y `cuotas` con RLS. Los permisos se le dan al Dueño y se suman al catálogo.

## Supuestos para confirmar con Stretch Inn

- **[SUPUESTO]** El abono es mensual, por mes calendario en la zona del centro, con una cuota por alumno y mes. Falta saber si es por paquete de clases o desde la fecha de alta.
- **[SUPUESTO]** La sede de la cuota, que define el precio, es la de las clases del alumno.
- **[SUPUESTO]** Los permisos son `abonos.ver`, `abonos.gestionar` y `abonos.asignar`.
- Todavía no hay descuentos, recargos por mora, prorrateo ni redondeo a $10 o $100.

## Cómo se probó

- Test primero en dominio, casos de uso y rutas, visto fallar antes de implementar.
  - Los tests del contrato los escribí antes que el esquema, pero no los corrí antes de implementarlo.
- Dominio sin base: el plan, el precio por sede y el período en la zona del centro, con un caso en que en UTC ya es el mes siguiente.
- Integración contra Postgres real:
  - planes: versión, precios, baja, otro centro y permisos por sede;
  - cuotas: precio de la sede, monto congelado, una por mes, reglas, anular y permisos;
  - `registrarPago` marca la cuota una sola vez.
- Rutas: el permiso declarado, del plan a la cuota, y los códigos 400, 404 y 409.
- En verde: abonos 19, api, herramientas (incluido el guardián del Dueño), contratos y web. En db pasan 25 de 26, incluido el test de aislamiento; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
