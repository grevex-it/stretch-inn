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

### Alcance de la primera entrega (cotización del 12/11)

El sistema central suma profesores, gastos y reportes (ver `docs/plan-de-implementacion.md` y
`docs/alcance-y-reglas-compartidas.md`). Falta decidir cómo se modelan:

- **Profesores:** ¿una ficha en `personas` vinculada a su cuenta del equipo (`identidad`)? Las
  clases de `agenda` todavía no tienen profesor asignado, y el reporte de clases por profesor lo
  necesita.
- **Gastos:** ¿un módulo nuevo o una ampliación de `caja`? Hoy el `AGENTS.md` de caja los deja
  fuera de alcance.
- **Reportes:** módulo nuevo, con filtro por período y sede y vista consolidada según permisos.
  «Bajas por período» necesita la fecha de baja del alumno: hoy `personas` guarda solo si está
  activo.
- **Material para profesores:** alojar y reproducir hasta 150 clases en video necesita un servicio
  de almacenamiento y streaming. Su costo tiene que entrar en la mensualidad.
- **Camas por sede** (pedido del 12/11): la cantidad de camas de cada sede tiene que ser
  variable y ajustable desde el panel. Hoy el cupo es de cada clase (`agenda`), se edita desde el
  panel y no puede quedar debajo de los inscriptos. Falta la cantidad de camas de la sede: el
  cupo por defecto de sus clases nuevas y el tope de todas. Al bajarla, ninguna clase puede
  quedar con más inscriptos que camas.
- **Licencias por sede** (0009): la mensualidad cambia por sede (base, sede nueva) y hay un alta
  por sede nueva.

### Nombre del producto

Por ahora repo `stretch-inn` (nombre del primer cliente) y paquetes neutros `@app/...`. Se define más adelante. A tener en cuenta: la regla de GREVEX de no usar nombres de clientes en redes, y que otros centros (posibles competidores) usarían un sistema con el nombre de Stretch Inn.

## A relevar con Stretch Inn

Casi todo quedó respondido en 0019 y 0020. Falta:

- **Viaje:** ¿las semanas de viaje gastan clases del abono, y la media cuota es para guardar el lugar del mes siguiente? Mientras tanto, otro alumno puede ocupar ese lugar.
- **Momentos pico, alumnos activos y horarios por semana:** para la prueba de carga (0013).

## Trámites y comercial

- **Registro de GREVEX como Tech Provider de Meta** para WhatsApp (0012). Tarda: arrancarlo antes del módulo de mensajería.
- **Costo de los mensajes de WhatsApp:** dejar claro en la propuesta que lo paga el centro, aparte de la licencia.
- **Contrato de licencia:** cláusula que autorice a GREVEX a acceder a los datos para soporte (0008, Ley 25.326).
- **Cámaras:** grabar clases y contar asistentes entra en protección de datos personales; definir avisos y consentimientos antes de presupuestarlo.
- **Lo que pidió Stretch Inn y no está en la cotización del 12/11:** confirmar con el cliente si
  queda afuera o se cotiza aparte.
  - Asistencia con huella de alumnos y profesores, y el lector (no tienen).
  - Ficha médica firmada desde el celular.
  - Transferencias que se registran solas como pago.
  - Cámaras (ver el punto anterior).
  - El costo de los mensajes de WhatsApp tampoco figura: aclarar que lo paga el centro.

- **Telegram:** crear el bot y el grupo con un tema por capa de alerta (0015).

## Del back (revisión del 08/11)

Lo que quedó abierto de la pila de asistencia, abonos, caja y worker. Lo que ya respondió Stretch
Inn está en 0019; los supuestos menores de cada módulo, en su `AGENTS.md`.

- **Actor de sistema en el `ContextoCentro`** (estructura): lo necesitan las tareas programadas
  del worker, como el aviso de pago cuando el alumno usa la última clase de su abono (0020). Hoy
  el contexto solo admite usuario y soporte. Se hace junto con ese aviso, que espera la decisión
  de WhatsApp (WAHA o la API de Meta, 0012).
- **Railway:** crear el servicio del worker (`pnpm --filter @app/worker start`) con la misma
  `DATABASE_URL` que la API.
- **Panel:** el profe anula un cobro desde la ficha del alumno, sin `caja.ver` (0019). La API
  ya lo permite: cada cuota de `GET /alumnos/:id/cuotas` trae su `pagoId`, y se anula con
  `POST /caja/pagos/:id/anulacion` (`caja.anular`). Falta la pantalla.

## Del repo

- Verificar que la versión de Postgres de Railway sea la 18, la misma que se usa en local y en los tests.
