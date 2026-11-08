**Créditos para recuperar por aviso a tiempo.** Tercera parte de `asistencia`.

**Apilado sobre `asistencia-avisos`.**

## Qué hace

- El aviso de ausencia a tiempo genera un crédito en la misma transacción. Hay uno por aviso (índice único).
- Anular el aviso anula su crédito; nada se borra.
- El crédito es de la sede de la fecha a la que se faltó.
- `POST /asistencia/fechas/:id/avisos` ahora responde también `conCredito`.
- `GET /alumnos/:id/creditos?pagina` (`asistencia.ver`) trae los créditos vigentes, el que vence antes primero, en las sedes donde se puede ver la asistencia.
- Tabla `creditos` con RLS por centro y sede.

## Supuestos para confirmar con Stretch Inn

- **[SUPUESTO]** El aviso da crédito si llega con 2 horas de anticipación o más.
- **[SUPUESTO]** El crédito vence a los 30 días de la fecha a la que se faltó.

Están en `src/dominio/credito.ts`. Si otro centro los necesita distintos, pasan a configuración por centro (0011).

## Cómo se probó

- Test primero, visto fallar antes de implementar.
- Dominio sin base: la anticipación y el vencimiento.
- Integración contra Postgres real: el aviso a tiempo y el tardío, anular el aviso, un crédito vencido y sedes sin permiso.
- Ruta: el permiso declarado y la respuesta con el contrato.
- En verde: asistencia 28, api, herramientas, contratos y web. En db pasan 25 de 26; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
