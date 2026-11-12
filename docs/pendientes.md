# Pendientes

Temas abiertos para trabajar. Cuando uno se cierra, se escribe su decisión en `docs/decisiones/` y se borra de acá. Cuando el repo esté en GitHub, esto pasa a issues.

_Última actualización: 12/11/2026._

## Para definir

### Monitor externo

Elegir el servicio que consulta `/salud` cada minuto y avisa al grupo de Telegram (0016). Opciones gratuitas: UptimeRobot, Better Stack.

### Railway

- Entornos: `production`, `staging` y uno temporal por pull request.
- Rol `app_usuario` sin superusuario ni `BYPASSRLS` (ver 0002).
- Backups automáticos de Railway más un `pg_dump` diario a un almacenamiento externo.
- Infraestructura definida en el repo: verificar el formato vigente de configuración como código de Railway antes de armarlo.

### Dominio propio

El panel y la API tienen que estar en el mismo sitio para que la cookie de sesión funcione (0017): por ejemplo `app.dominio` y `api.dominio`. Los dominios `*.up.railway.app` no sirven entre sí. Comprarlo antes de salir a producción.

### Nombre del producto

Por ahora repo `stretch-inn` (nombre del primer cliente) y paquetes neutros `@app/...`. Se define más adelante. A tener en cuenta: la regla de GREVEX de no usar nombres de clientes en redes, y que otros centros (posibles competidores) usarían un sistema con el nombre de Stretch Inn.

## A relevar con Stretch Inn

Casi todo quedó respondido en 0019. Falta:

- **Pago tarde:** ¿las 4 semanas nuevas cuentan desde el pago o desde la fecha que le tocaba? Está en un audio que falta pasar a texto.
- **Falta sin avisar:** ¿da derecho a recuperar, igual que una falta avisada?
- **Momentos pico, alumnos activos y horarios por semana:** para la prueba de carga (0013).

## Trámites y comercial

- **Registro de GREVEX como Tech Provider de Meta** para WhatsApp (0012). Tarda: arrancarlo antes del módulo de mensajería.
- **Costo de los mensajes de WhatsApp:** dejar claro en la propuesta que lo paga el centro, aparte de la licencia.
- **Contrato de licencia:** cláusula que autorice a GREVEX a acceder a los datos para soporte (0008, Ley 25.326).
- **Cámaras:** grabar clases y contar asistentes entra en protección de datos personales; definir avisos y consentimientos antes de presupuestarlo.

- **Telegram:** crear el bot y el grupo con un tema por capa de alerta (0015).

## Del back (revisión del 08/11)

Lo que quedó abierto de la pila de asistencia, abonos, caja y worker. Lo que ya respondió Stretch
Inn está en 0019; los supuestos menores de cada módulo, en su `AGENTS.md`.

- **Actor de sistema en el `ContextoCentro`** (estructura): lo necesitan las tareas programadas
  del worker, como renovar los ciclos que terminan y avisar el pago ese día (0019). Hoy el
  contexto solo admite usuario y soporte.
- **`agenda` puede pasarse del cupo de una fecha con recuperaciones:** si inscribe a alguien en
  una clase con recuperaciones reservadas en una fecha futura. Un evento de `agenda` o un puerto
  para que consulte los lugares a `asistencia`.
- **La baja de un alumno tiene que liberar sus inscripciones fijas** (0019). Hoy siguen vigentes.
- **Una fecha suspendida tiene que dar crédito a sus inscriptos** (0019).
- **`caja`:** la cuota se marca pagada en la transacción del cobro y no por el evento. Revisar si
  queda así y, en ese caso, actualizar 0003.
- **Railway:** crear el servicio del worker (`pnpm --filter @app/worker start`) con la misma
  `DATABASE_URL` que la API.
- **Panel:** las pantallas de agenda, asistencia, abonos y caja están en la rama
  `panel-alumnos-detalles`, sin pull request, y usan los contratos de antes de 0019 (cuotas por
  mes, medios de pago). Hay que adaptarlas. Además, el profe tiene que poder anular un cobro sin
  `caja.ver`, y cobrar sin ver el total adeudado (0019).

## Del repo

- Verificar que la versión de Postgres de Railway sea la 18, la misma que se usa en local y en los tests.
