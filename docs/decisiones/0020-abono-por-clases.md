# 0020 — El abono es un paquete de clases, no un período

**Fecha:** 12/11/2026 · **Estado:** propuesta · Reemplaza la parte de abonos de 0019.

## Contexto

0019 tomó el abono como «4 clases que duran 4 semanas desde el pago», y `abonos` se armó con
ciclos de 28 días por calendario. Dos audios de Stretch Inn (12/11/2026) muestran que lo que
cuenta son las clases, no las semanas. Las 4 semanas son solo el caso de quien viene una vez por
semana:

- Hay alumnos que, por sus patologías, vienen **dos veces por semana**: terminan las 4 clases en
  2 semanas y vuelven a pagar.
- Hay alumnos que **pasan de abono a clase suelta** y vuelven: pagan una clase la quinta semana
  para no cambiar su fecha de pago, o pagan dos clases sueltas antes de irse de viaje sin guardar
  el lugar.
- **Pago tarde** (pregunta 5 de «Puntos a definir»): si el alumno siguió viniendo, el abono nuevo
  cuenta desde la clase que le tocaba; si dejó de venir, desde la clase en que vuelve.

## Decisión

### Formas de pago

- **Abono:** un paquete de **4 clases** (valor por defecto del centro, 0011), con el precio de la
  sede.
- **Clase suelta:** se paga una clase. La usan los alumnos sin horario fijo, que se anotan semana
  a semana, y los alumnos con abono que por una o dos clases prefieren pagar por clase.
- **Clase de prueba paga:** una clase suelta con su propio precio.
- El alumno **puede pasar de abono a clase suelta y volver** cuando quiera. No hay que dar de baja
  nada.

### Cómo se gasta el abono

- Cada **fecha del horario fijo** del alumno gasta una clase del abono, venga o falte.
- **La falta avisada gasta la clase, pero da un crédito** para recuperarla.
- **Recuperar no gasta una clase nueva:** usa el crédito.
- **El abono termina con su última clase.** El crédito de una falta vence ahí: si no lo usó, lo
  pierde.
- **El aviso de pago sale cuando el alumno usa la última clase del abono**, no a las 4 semanas.

### Recuperaciones: reglas de cada sede, configurables desde el panel

Cada sede trabaja distinto, y la regla tiene que poder cambiarse desde el sistema, sin tocar
código (0011). Quien tenga el permiso de configuración de la sede ajusta estos valores en el
panel:

- **¿Hace falta avisar la falta para recuperar?**
  - **No:** el alumno, o el equipo por él, reserva la recuperación directamente si hay lugar.
  - **Sí:** el aviso de falta da el crédito para recuperar. El alumno avisa desde el portal
    (Fase 4; hasta entonces, el equipo desde el panel), con la **anticipación** que fije la sede.
    Si se olvidó, el equipo le habilita el crédito con un permiso propio, y queda registrado quién
    lo dio y por qué.
- **Máximo de recuperaciones por abono.** Vale también para los créditos que habilita el equipo.
- En todos los casos se recupera dentro del abono y con lugar disponible, y recuperar no gasta una
  clase nueva.

**Río Tercero** (12/11/2026): el alumno siempre puede recuperar si hay lugar, avise o no y con
cualquier anticipación. No toman lista. Máximo por abono: **[SUPUESTO]** las clases del abono (4),
para que alguien que vino a todas no sume recuperaciones sin tope; se puede cambiar desde el panel.

**Mendoza:** hoy pide aviso una hora antes y permite hasta 2 recuperaciones por abono. Falta
confirmar cómo queda.

Una sede nueva arranca con los valores de Río Tercero.

### Desde cuándo cuenta el abono nuevo

- **El abono nuevo empieza en la primera clase a la que el alumno asiste después de que terminó
  el anterior.** Si siguió viniendo sin pagar, cuenta desde esa clase (la quinta, para quien viene
  una vez por semana), así que su fecha de pago no se corre. Si dejó de venir, cuenta desde la
  clase en que vuelve.
- Mientras no paga, puede seguir viniendo (0019): esas clases quedan adeudadas y entran en el
  abono nuevo.

## Consecuencias

- **`abonos`:** la cuota deja de ser un ciclo de 28 días por calendario (`desde`/`hasta`). Pasa a
  ser un paquete de N clases o una clase suelta, y hay que saber qué clases ya se gastaron. Las
  clases las dan `agenda` (las fechas del horario fijo) y `asistencia` (si vino, faltó o recuperó).
- **`asistencia`:** el crédito vence con la última clase del abono, que ya no es una fecha de
  calendario. Recuperar sigue la regla de la sede: con o sin aviso previo, con la anticipación y
  el máximo que fije. El equipo puede habilitar un crédito con un permiso nuevo (con motivo).
- **Configuración por sede editable desde el panel:** las reglas de recuperación y el tamaño del
  abono.
- **Renovación y aviso de pago:** se disparan cuando se gasta la última clase, no por fecha.

## Pendiente

- **Viaje:** el alumno paga la mitad para guardar su lugar y otro puede ocuparlo mientras tanto.
  Entendemos que las semanas de viaje gastan clases del abono y que la media cuota es para
  conservar el lugar del mes siguiente. Confirmarlo con Stretch Inn.
