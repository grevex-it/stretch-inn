# 0016 — Diagnóstico de errores por agentes

**Fecha:** 03/11/2026 · **Estado:** aceptada · Complementa 0015 y reemplaza su retención.

## Contexto

Los errores los corrige un agente, no una persona. La 0015 resuelve cómo nos enteramos y cómo una persona lee un log, pero el agente depende de que alguien le pegue el «Copiar para agente». Necesitamos que el agente pueda ir a buscar los logs por su cuenta, con detalle suficiente para corregir y para analizar qué falla más y por qué.

Además quedaban huecos: los logs de Railway, qué pasa si se cae la base o el servidor entero, los errores del navegador y las fallas que no tiran ninguna excepción (0013 dejaba la observabilidad para definir junto con los logs).

## Decisión

### Logs en Railway

- Todo log se escribe **siempre en stdout**, además de en la base. Si la base no responde, el log igual queda en Railway.
- **Una línea JSON por log** (pino, el logger de Fastify), con `level` en texto (`"error"`, no `50`), `message` con el texto de la plantilla, `traza` y los datos estructurados. Así Railway muestra el mensaje legible y permite filtrar por nivel y por traza (verificar la sintaxis vigente de filtros de Railway al armarlo).
- Las alertas de capa 1 se mandan a Telegram **directo desde el proceso**, sin pasar por la base ni por la cola.
- Si Telegram falla, no hay respaldo: queda el log.

### Quién vigila al vigilante

- **Monitor externo** que consulta `/salud` cada minuto y avisa al grupo de Telegram si no responde. Si se cae el servidor entero, el sistema no puede avisarlo por sí mismo.
- **Latido del worker:** cada tarea programada reporta al terminar. Si una no reporta en su horario (el cron que «no corrió»), alerta de capa 2.

### Errores esperados y bugs

- **Esperado:** una regla de negocio que no se cumple («el cupo está lleno», «el abono venció»). Es un `Resultado` de `@app/nucleo`, se responde al usuario con su mensaje y **no se registra como error ni alerta**.
- **Bug:** toda excepción no prevista. La atrapa el manejador global de Fastify (o del worker), se registra con todo su contexto y el usuario ve solo «Algo falló. Código: K7X2», donde el código es la traza abreviada. Con ese código se encuentra el pedido.
- **Falla del proceso** (`uncaughtException`, `unhandledRejection`): se registra, alerta de capa 1, y el proceso termina para que Railway lo reinicie. No se sigue corriendo en un estado desconocido.
- **Tareas del worker:** cada reintento se registra; el último intento fallido va a la lista de fallidos y cuenta como error.

### Errores del navegador

- El panel y el portal mandan sus errores a un endpoint de la API: errores de React (límite de errores por pantalla), pedidos fallidos y **fallas al sincronizar el portal sin conexión** (0014), que son las más peligrosas porque el alumno cree que reservó y la reserva nunca llegó.
- El endpoint tiene límite de envíos por origen y sanitiza igual que el resto.
- Los source maps se generan en el build y se guardan en el servidor, no se publican: la pila de llamadas del front se traduce a archivo y línea reales.

### Fallas silenciosas

Reglas simples en capa 3 para lo que se rompe sin excepción. Ej.: «un día hábil a las 12:00 no entró ningún cobro en un centro que cobra todos los días», «hoy no salió ningún recordatorio». Cada módulo declara las suyas, igual que sus plantillas.

### Qué guarda un error

Lo que ya lista el «Copiar para agente» de la 0015, más:

- **Contexto:** ids de centro, sede y usuario, rol, ruta HTTP o tarea, método.
- **Cadena de causas completa** (`error.cause`): «falló el cobro ← falló la consulta ← se cortó la conexión», cada una con su tipo, mensaje y pila.
- **Servicios externos:** qué se envió, qué respondió (código y cuerpo sanitizados), cuánto tardó y número de intento.
- **Costo del pedido:** duración total, cantidad de consultas SQL y tiempo en la base. Sirve para encontrar lentitudes y N+1.
- **Navegador** (solo errores del front): pantalla, versión desplegada del front, navegador y si estaba sin conexión.

Cada pedido, haya fallado o no, guarda un registro con ruta, resultado, duración y cantidad de consultas: es la base para analizar tiempos y tasas de error.

### Grupos de errores

- Cada error tiene una **huella**: tipo de error, módulo, caso de uso y la función donde ocurrió (no la línea, que cambia con cada edición), con el mensaje normalizado (sin ids ni números).
- Los errores con la misma huella forman un **grupo**: primera y última vez, cantidad, versión desplegada donde apareció por primera vez, y estado (`abierto`, `resuelto`, `ignorado`).
- **Error nuevo** (huella que nunca apareció): alerta de capa 2.
- **Regresión** (aparece en un grupo `resuelto`, en una versión que ya incluye el arreglo): alerta de capa 2. Si aparece en una versión vieja que sigue corriendo durante un deploy, no cuenta.

### Cómo se resuelve un error

1. El agente lee el grupo y un par de trazas con `pnpm logs`.
2. Lo reproduce con un test que falla, lo corrige y en el commit escribe `Resuelve: <huella>`.
3. **Se marca resuelto al desplegarse, no al mergear:** al arrancar un deploy nuevo, el sistema revisa los commits incluidos desde el deploy anterior (API de GitHub), pasa a `resuelto` cada grupo mencionado y guarda el commit.
4. Si vuelve a pasar, es regresión.

El agente no necesita permiso de escritura sobre la base: le alcanza con la línea en el commit. `ignorado` lo marca una persona desde la consola.

### Lectura de logs por agentes: `pnpm logs`

CLI en `herramientas/` que consulta las tablas de logs y devuelve Markdown pensado para un agente (o JSON con `--json`):

    pnpm logs errores --desde 24h      # grupos con errores en el período, los más frecuentes primero
    pnpm logs nuevos --desde 7d        # grupos nuevos y regresiones
    pnpm logs grupo <huella>           # historia del grupo y los últimos ejemplos completos
    pnpm logs traza <codigo>           # todo lo que pasó en un pedido o tarea, en orden
    pnpm logs lentos --desde 24h       # rutas más lentas y con más consultas
    pnpm logs resumen --semana         # informe: errores por módulo, nuevos, regresiones, tiempos

- **Puede leer producción**, además de staging.
- Se conecta con el rol de base **`logs_lector`**: solo lectura y solo sobre el esquema `logs`. No ve ninguna tabla de los centros.
- La conexión va en `LOGS_DATABASE_URL`, en el `.env` local de cada uno; nunca en el repo.
- Si la base está caída, el respaldo es `railway logs`.

### Retención (reemplaza la de 0015)

| Qué | Cuánto |
|---|---|
| Errores y sus grupos | 6 meses |
| Bitácora de actividad | 6 meses |
| Registro de pedidos exitosos | 30 días |

Las tablas de logs se particionan por mes y se borran particiones enteras, sin `DELETE` masivos. La auditoría del centro sigue sin vencer (0015).

## Consecuencias

- El «Copiar para agente» de la 0015 sigue: es el atajo cuando una persona ya está mirando el error.
- Esquema `logs` separado del de los centros, con su propio rol de lectura. No lleva `centro_id` como dato de aislamiento (son datos de la plataforma, ver 0015): `logs_lector` no puede leer nada fuera de ese esquema.
- Regla nueva para los `AGENTS.md`: ante un error, empezar por `pnpm logs grupo <huella>` o `pnpm logs traza <codigo>`, y cerrar con `Resuelve: <huella>` en el commit.
- Falta elegir el servicio del monitor externo (ver `docs/pendientes.md`).
