# 0015 — Logs y alertas

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Necesitamos ver qué está fallando y qué se está haciendo, en un lenguaje que una persona entienda leyéndolo, y poder derivarlo a un agente para que lo solucione.

## Decisión

### Logs

- **Solo para GREVEX.** Se ven dentro del sistema, en la consola de plataforma. El centro no los ve.
- Dos tipos:
  - **Bitácora de actividad** (qué se hizo). Ej.: «María (Recepción, Sede Norte) dio de alta a Juan Pérez y le vendió un abono de 2 clases por semana a $25.000».
  - **Registro técnico** (qué falló). Ej.: «No se pudo enviar el recordatorio de vencimiento a 3 alumnos de Sede Sur: WhatsApp rechazó la plantilla. Se reintenta a las 18:00».
- **Textos generados con plantillas** por tipo de evento, nunca con IA: un log no puede inventar detalles.
- Cada log guarda además los datos estructurados (centro, sede, usuario, módulo, identificadores) para filtrar.
- **Id de traza** en cada pedido y cada tarea, desde que entra hasta que termina: permite ver todos los logs de un mismo pedido en orden.
- **Retención: 6 meses.** Lo más viejo se borra automáticamente.
- Los logs son datos de la plataforma, no de un centro: GREVEX ve los de todos los centros juntos. Para operar dentro de un centro sigue valiendo la entrada como soporte (ver 0008).

### Datos personales

Nunca se escriben en un log: datos de salud de alumnos, teléfonos completos, claves, tokens ni secretos. Las entradas se registran sanitizadas.

### Auditoría del centro

Es otra cosa: el historial de quién cobró qué y quién cambió permisos (ver 0007), que sí ve el centro. **No vence**: es la historia operativa del centro y un reclamo puede llegar mucho después.

### Copiar para agente

Cada log de error tiene un botón que copia un bloque en Markdown listo para pegar en Claude Code o Codex:

- Qué pasó, en lenguaje natural (la plantilla), y si la operación quedó hecha o no.
- Dónde: módulo, caso de uso, archivo y línea.
- Pedido o tarea, id de traza, fecha y hora (UTC).
- Versión desplegada (commit) y entorno.
- Error y pila de llamadas.
- Entrada sanitizada.
- **Los logs anteriores del mismo pedido**, en orden.
- Para empezar: qué `AGENTS.md` leer y la indicación de reproducir con un test antes de corregir.

### Alertas por Telegram, por capas

| Capa | Cuándo avisa | Ejemplos |
|---|---|---|
| **1 · Crítica** | En el momento, con sonido, a cualquier hora | Sistema caído; base inaccesible; un cobro falló por error del sistema; posible fuga entre centros; backup fallido; deploy fallido o revertido |
| **2 · Alta** | En el momento, sin sonido de noche | Más del 5 % de pedidos con error en 5 minutos; cola atascada (tareas esperando más de 10 minutos); WhatsApp rechazando muchos envíos; 95 % de los pedidos tardando más de 1 s durante 10 minutos |
| **3 · Media** | Resumen cada hora, solo si hubo algo | Errores aislados que se repiten; reintentos de la cola; muchos logins fallidos de un mismo origen; plantilla de WhatsApp rechazada |
| **4 · Informativa** | Resumen diario a las 9:00 | Actividad por centro, total de errores, backups OK, tareas en la lista de fallidos |

Contra el ruido:

- **Agrupar:** el mismo error repetido llega como un solo mensaje con la cantidad («×50»).
- **Silenciar repetidos:** una alerta igual no se repite durante 30 minutos.
- **Escalar:** una alerta de capa 2 activa por más de 30 minutos sube a capa 1.
- **Avisar al resolverse:** «Resuelto: la cola volvió a la normalidad (duró 12 min)».
- **Un grupo de Telegram con un tema por capa**, para poder silenciar las capas 3 y 4 sin perder la 1.

Cada alerta trae el texto de la plantilla, un enlace al log en la consola y el «Copiar para agente».

## Consecuencias

- Los umbrales (5 %, 10 min, 30 min, 1 s) son iniciales: se ajustan con el uso real.
- Cada módulo declara las plantillas de sus eventos, igual que declara sus permisos.
