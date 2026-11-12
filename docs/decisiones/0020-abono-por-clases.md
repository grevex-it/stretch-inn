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
- **La falta gasta la clase**, avise o no, y el alumno la puede recuperar (ver más abajo).
- **Recuperar no gasta una clase nueva.**
- **El abono termina con su última clase.** Las recuperaciones que no hizo hasta ahí, las pierde.
- **El aviso de pago sale cuando el alumno usa la última clase del abono**, no a las 4 semanas.

### Recuperaciones: reglas de cada sede, configurables desde el panel

En las dos sedes el alumno **siempre puede recuperar si hay lugar**, haya avisado la falta o no
(12/11/2026). No toman lista. Lo que cambia entre sedes se ajusta desde el panel, sin tocar
código (0011), con el permiso de configuración de la sede:

- **Anticipación para reservar la recuperación:** cuánto antes de la clase en la que recupera
  tiene que anotarse, para que la sede pueda ubicarlo. **Río Tercero:** hasta que empieza la
  clase. **Mendoza:** hasta **una hora antes**.
- **Máximo de recuperaciones por abono:** arranca en las clases del abono (4) en las dos sedes,
  para que alguien que vino a todas no sume recuperaciones sin tope. Mendoza hoy usa 2; cada sede
  lo ajusta desde el panel.

Además:

- Se recupera dentro del abono y con lugar disponible, y recuperar no gasta una clase nueva.
- **El aviso de falta no es condición para recuperar**, pero sirve: libera el lugar de esa fecha
  para que otro recupere. El alumno avisa desde el portal (Fase 4) y, hasta entonces, el equipo
  desde el panel.
- Una sede nueva arranca con los valores de Río Tercero.

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
- **`asistencia`:** recuperar ya no depende de un crédito por aviso. Alcanza con estar dentro del
  abono, que haya lugar y respetar la anticipación y el máximo de la sede. El aviso sigue
  liberando el lugar de la fecha. Los créditos por aviso que hoy tiene el módulo se reemplazan.
- **Configuración por sede editable desde el panel:** las reglas de recuperación y el tamaño del
  abono.
- **Renovación y aviso de pago:** se disparan cuando se gasta la última clase, no por fecha.

## Pendiente

- **Viaje:** el alumno paga la mitad para guardar su lugar y otro puede ocuparlo mientras tanto.
  Entendemos que las semanas de viaje gastan clases del abono y que la media cuota es para
  conservar el lugar del mes siguiente. Confirmarlo con Stretch Inn.
