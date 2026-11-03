# Pendientes

Temas abiertos para trabajar. Cuando uno se cierra, se escribe su decisión en `docs/decisiones/` y se borra de acá. Cuando el repo esté en GitHub, esto pasa a issues.

_Última actualización: 03/11/2026._

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

- ¿Un alumno toma clases o recupera en más de una sede?
- Recuperaciones: anticipación mínima del aviso, vigencia del crédito, si se puede recuperar cualquier actividad.
- Abonos: ¿por cantidad de clases semanales o por paquete? ¿Mes calendario o desde la fecha de alta?
- ¿Precios iguales en todas las sedes o distintos?
- Roles reales que usan hoy (encargados, recepción, profesores con acceso).
- Momentos pico: ¿cuándo son (principio de mes, apertura de inscripciones a hora fija) y cuánta gente entra a la vez? Sirve para armar la prueba de carga (0013).
- Tamaño: cantidad de sedes, alumnos y clases por semana.
- ¿Redondean precios a $10 o $100? Si sí, va como configuración por centro (el redondeo base al peso ya está decidido en 0009).

## Trámites y comercial

- **Registro de GREVEX como Tech Provider de Meta** para WhatsApp (0012). Tarda: arrancarlo antes del módulo de mensajería.
- **Costo de los mensajes de WhatsApp:** dejar claro en la propuesta que lo paga el centro, aparte de la licencia.
- **Contrato de licencia:** cláusula que autorice a GREVEX a acceder a los datos para soporte (0008, Ley 25.326).
- **Cámaras:** grabar clases y contar asistentes entra en protección de datos personales; definir avisos y consentimientos antes de presupuestarlo.

- **Telegram:** crear el bot y el grupo con un tema por capa de alerta (0015).

## Del repo

- Escribir `apps/web/AGENTS.md` cuando exista la app, a partir de `docs/borradores-agents/`.
- Verificar que la versión de Postgres de Railway sea la 18, la misma que se usa en local y en los tests.
