# 0019 — Abonos, recuperaciones, sedes y permisos según Stretch Inn

**Fecha:** 12/11/2026 · **Estado:** propuesta · La parte de abonos (cómo se gasta el abono y
cuándo vence el crédito) la reemplaza 0020.

## Contexto

Stretch Inn respondió el documento «Sistema de gestión — Puntos a definir» (07/10/2026) y un
formulario con los últimos puntos (12/11/2026). Las sedes se corrigieron con la cotización de
GREVEX del 12/11/2026. Las respuestas cierran casi todo lo que estaba en
`docs/pendientes.md`, en «A relevar con Stretch Inn», y contradicen varios supuestos de los
módulos `asistencia`, `abonos` y `caja` que están en revisión.

Cómo trabaja hoy el centro: una sede en **Río Tercero**. **Mendoza** se suma en la primera entrega
del sistema, con su propio encargado, y después pueden venir más sedes.
Hay una sola actividad (hamacas): 5 por horario hoy, y se suman a medida que hay demanda. Llevan la
operación en una planilla.

Siguiendo 0011, cada regla va como valor por defecto o configuración del centro, nunca como código
propio de Stretch Inn.

## Decisión

### Abonos

_Reemplazado por 0020: el abono es un paquete de 4 clases, no un período de 4 semanas._

- **El abono es de 4 clases y dura 4 semanas desde el pago**, no un mes calendario. A las 4
  semanas se avisa que hay que volver a pagar, haya venido o no. El aviso sale ese mismo día, no
  antes.
- Cada alumno tiene **un horario fijo por semana**.
- Además existen:
  - **la clase suelta**, para 2 o 3 alumnos sin horario fijo que vienen cuando hay lugar;
  - **la clase de prueba paga**.
- **Alumno de viaje** (reemplazado por 0022: paga como un mes común): paga la mitad del abono y conserva su lugar fijo, sin tiempo máximo.
  Mientras tanto, ese lugar se usa para recuperaciones o para otro alumno, avisándole por cuánto
  tiempo.
- **Precios distintos por sede** (ya previsto en 0011). Sin descuentos ni promociones, y sin
  redondeo más allá del peso entero (0009).
- **Medios de pago:** efectivo y transferencia a una billetera virtual.
- **Quien debe puede entrar igual a clase.** La deuda no bloquea la asistencia ni las
  recuperaciones.

### Ausencias y recuperaciones

- **La clase a la que falta se descuenta, pero la puede recuperar.**
- **El crédito vence cuando termina el abono** en el que se faltó. Si no lo usa, lo pierde.
- **No hay anticipación mínima:** se puede anotar a recuperar cuando quiera, siempre que haya
  lugar.
- Puede acumular varios créditos y **hacer dos clases en la misma semana** (la suya y una
  recuperación). No hay tope.
- **El alumno se anota solo, sin aprobación.** El sistema muestra los lugares libres y no deja
  anotarse si el horario está lleno.
- **Solo recupera en su sede** (`recuperarEnOtraSede`: no, el valor por defecto de 0011).

### Clases y lugares

- Un alumno tiene su horario fijo en **una sola sede**.
- **Los lugares libres se cuentan por fecha:** cupo, menos fijos, más ausentes con aviso y
  alumnos de viaje, menos recuperaciones y clases sueltas.
- **Feriados:** nunca hay clase. **Suspensiones:** pueden ser de un solo horario (por ejemplo,
  si falta un profe). Ninguna de las dos se descuenta del abono, y a los alumnos afectados se les
  busca lugar para recuperar.
- **Cambio de horario fijo:** es frecuente.
- **Baja:** cuando un alumno deja de venir, se libera su lugar fijo. Se inactiva sin borrar sus
  datos, y si vuelve conserva su historial.
- **«Primera clase»:** es la fecha de inicio del alumno. Se usa para el regalo cuando cumple un
  año.

### Equipo y permisos

- **Hoy:** Lore y Lucas ven todo, y la contadora también. No hay encargados ni recepción. Cada
  sede nueva va a tener su encargado; Mendoza, la primera.
- **Administración:** quien tiene permisos en Río Tercero y Mendoza ve las dos y el consolidado.
  El encargado de una sede opera y ve los reportes solo de la suya.
- **Encargados y profes de varias sedes** se resuelven con roles personalizados y roles por
  sede (0007). No se agregan reglas fijas.
- **Profes:**
  - cobran y pueden anular un cobro;
  - ven si cualquier alumno pagó o no;
  - **no ven** lo que ingresa ni, si se puede evitar, la cantidad de alumnos;
  - pueden anotar alumnos en cualquier horario, para el fijo o para recuperar;
  - ven la ficha y las patologías de todos los alumnos.
- **Datos de salud:** los ven los profesores. **La contadora no.** Las patologías y la ficha
  médica necesitan un permiso propio, separado de ver la ficha del alumno.
- No se pide el email de los alumnos.

## Consecuencias

- **`abonos`:** pasa de cuota por mes calendario a ciclo de 4 semanas que empieza con el pago.
  Hace falta guardar el plan de cada alumno, y suma la clase suelta, la de prueba y el estado
  «de viaje» con media cuota.
- **`asistencia`:**
  - el crédito se da por la falta, sin el mínimo de 2 horas de anticipación;
  - vence con el abono, no a los 30 días;
  - los lugares de cada fecha suman a los alumnos de viaje.
- **`caja`:** los medios de pago son efectivo y transferencia. `caja.ver` (lo que ingresó) queda
  separado de `caja.cobrar`; además, saber si un alumno pagó no tiene que mostrar montos
  totales.
- **`personas`:** permiso propio para los datos de salud.
- **`agenda`:** la baja de un alumno libera sus inscripciones fijas. Las suspensiones pueden
  ser de una sola fecha de un horario.

## Pendiente

- **Pago tarde:** si las 4 semanas nuevas cuentan desde el pago o desde la fecha en que le
  tocaba pagar. Lo explicaron en un audio que falta pasar a texto.
- **Falta sin avisar:** si da derecho a recuperar igual que una falta avisada. La respuesta
  escrita es ambigua.
- **Momentos de más movimiento, alumnos activos y horarios por semana:** sirven para la prueba de
  carga (0013).
