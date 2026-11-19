# Pendientes

Temas abiertos para trabajar. Cuando uno se cierra, se escribe su decisión en `docs/decisiones/` y se borra de acá. Cuando el repo esté en GitHub, esto pasa a issues.

_Última actualización: 18/11/2026._

## Para definir

### Monitor externo

Elegir el servicio que consulta `/salud` cada minuto y avisa al grupo de Telegram (0016). Opciones gratuitas: UptimeRobot, Better Stack.

### Railway

- Entornos: `production`, `staging` y uno temporal por pull request.
- Rol `app_usuario` sin superusuario ni `BYPASSRLS` (ver 0002).
- Backups automáticos de Railway más un `pg_dump` diario a un almacenamiento externo.
- Infraestructura definida en el repo: verificar el formato vigente de configuración como código de Railway antes de armarlo.

### Dominio propio

El panel y la API tienen que estar en el mismo sitio para que la cookie de sesión funcione (0017): por ejemplo `app.dominio` y `api.dominio`. Los dominios `*.up.railway.app` no sirven entre sí. Se compra cuando haga falta publicar el sistema.

### Alcance de la primera entrega (cotización del 12/11)

El sistema central suma profesores, gastos y reportes (ver `docs/plan-de-implementacion.md` y
`docs/alcance-y-reglas-compartidas.md`). Gastos ya está (módulo `gastos`, 0022). Falta:

- **Profesores:** se les paga por clase dictada y cada sede tiene su profe fijo (0022). El profe
  es un usuario del equipo (`identidad`). La API de `agenda` ya tiene el profe de cada clase, el
  fijo de la sede, el reemplazo de una fecha y las clases dictadas por período; `personas`, el
  profe asignado a cada alumno. Las tarifas, el tipo de profe y la liquidación están propuestos
  en 0024 (con dos supuestos a confirmar con Stretch Inn). Falta en el panel: las pantallas de
  profes de `agenda`.
- **Reportes:** módulo nuevo, con filtro por período y sede y vista consolidada según permisos.
  Para «Bajas por período», `personas` ya guarda la fecha de baja del alumno.
- **Material para profesores:** alojar y reproducir hasta 150 clases en video necesita un servicio
  de almacenamiento y streaming: Mux, confirmado el 18/11. Su costo tiene que entrar en la
  mensualidad.
- **Permiso para las camas:** evaluar si cambiar las camas de una sede necesita un permiso
  propio. Hoy lo puede hacer cualquiera con `agenda.gestionar`, y al cambiarlas cambia el cupo
  de todos los horarios de la sede.
- **Licencias por sede** (0009): la mensualidad cambia por sede (base, sede nueva) y hay un alta
  por sede nueva.

### Roles a medida

Las plantillas Encargado, Profesor, Recepción y Contaduría y la API de roles, asignaciones y
ajustes ya están (0007, 0019). Falta la pantalla del panel: duplicar una plantilla, sacarle o
sumarle permisos, y los ajustes individuales por usuario y sede.

### Nombre del producto

Por ahora repo `stretch-inn` (nombre del primer cliente) y paquetes neutros `@app/...`. Se define más adelante. A tener en cuenta: la regla de GREVEX de no usar nombres de clientes en redes, y que otros centros (posibles competidores) usarían un sistema con el nombre de Stretch Inn.

## A relevar con Stretch Inn

Casi todo quedó respondido en 0019 y 0020. Falta:

- **Momentos pico, alumnos activos y horarios por semana:** para la prueba de carga (0013).

## Trámites y comercial

- **Servidor de WAHA** (0021): alojarlo en la infraestructura de GREVEX y vincular el número de
  Stretch Inn.
- **Contrato de licencia:** cláusula que autorice a GREVEX a acceder a los datos para soporte (0008, Ley 25.326).
- **Cámaras:** grabar clases y contar asistentes entra en protección de datos personales; definir avisos y consentimientos antes de presupuestarlo.
- **Lo que pidió Stretch Inn y no está en la cotización del 12/11:** confirmar con el cliente si
  queda afuera o se cotiza aparte.
  - Asistencia con huella de alumnos y profesores, y el lector (no tienen): se hace cuando el
    cliente la pida y se cotiza aparte. Mientras tanto, la asistencia es manual.
  - Transferencias que se registran solas como pago.
  - Cámaras (ver el punto anterior).

- **Telegram:** crear el bot y el grupo con un tema por capa de alerta (0015).

## Del back (revisión del 08/11)

Lo que quedó abierto de la pila de asistencia, abonos, caja y worker. Lo que ya respondió Stretch
Inn está en 0019; los supuestos menores de cada módulo, en su `AGENTS.md`.

- **Actor de sistema en el `ContextoCentro`** (estructura): lo necesitan las tareas programadas
  del worker, como el aviso de pago cuando el alumno usa la última clase de su abono (0020). Hoy
  el contexto solo admite usuario y soporte. Se hace junto con ese aviso, por WAHA (0021).
- **Railway:** crear el servicio del worker (`pnpm --filter @app/worker start`) con la misma
  `DATABASE_URL` que la API.

## Del repo

- Verificar que la versión de Postgres de Railway sea la 18, la misma que se usa en local y en los tests.
- **Regla de depcruise para el panel** (estructura): que las pantallas de un módulo usen las de
  otro solo por su `index.ts` (`apps/web/AGENTS.md`). Hoy no lo controla `pnpm check`. Al
  sumarla, `caja/CobrarCuota.tsx` tiene que dejar de importar `../abonos/ciclo.ts` y pasar a
  importar desde `abonos/index.ts`.
