# 0024 — Tarifas y liquidación de los profes

**Fecha:** 18/11/2026 · **Estado:** propuesta · Completa el pago a los profes de 0022.

## Contexto

0022 dejó que a los profes se les paga por clase dictada, con «el monto por clase y los detalles
más adelante». `agenda` ya cuenta las clases dictadas por profe en un período, y hoy el pago se
carga a mano como un gasto de categoría `sueldos` en `gastos`. Respuestas de GREVEX del 18/11 a
cómo se configura el monto y qué hace el sistema con el cálculo.

## Decisión

### Tarifa por clase, en capas

- Se configura desde el panel, nunca en el código (0011). Montos en pesos enteros (0009).
- Cuatro niveles, y gana el más específico que exista:
  1. por profe y sede;
  2. por profe;
  3. por sede;
  4. el valor por defecto del centro.
- Una clase sin ninguna tarifa aplicable no se liquida: la liquidación lo avisa en lugar de
  pagarla en cero.

### Vigencia

- Cada tarifa rige desde una fecha. Un cambio no pisa la anterior: la cierra el día antes.
- Cada clase se paga con la tarifa vigente **el día en que se dictó**: un período con un aumento
  en el medio paga cada parte a su valor.
- **[SUPUESTO, a confirmar con Stretch Inn]** Sin aumentos hacia atrás: una tarifa nueva rige
  desde hoy o más adelante.

### Liquidación

- «Generar pagos» de un período calcula, por profe y sede, las clases dictadas por la tarifa
  vigente de cada una, y muestra el detalle antes de confirmar.
- Al confirmar, crea un gasto en `gastos` por profe y sede (categoría `sueldos`, en esa sede) y
  marca el período como liquidado. Un período liquidado no se vuelve a liquidar.
- Lleva clave de idempotencia (regla 7): confirmar dos veces no crea dos gastos.
- Se anula con un motivo: se anulan sus gastos y el período vuelve a quedar sin liquidar. La
  liquidación guarda lo que calculó: si después se corrige quién dio una fecha, hay que anularla
  y generarla de nuevo.

### Tipo de profe

- Cada profe es **empleado** o **socio**.
- **[SUPUESTO, a confirmar]** Al socio se le cuentan las clases y se muestra su liquidación aparte,
  pero no se le genera un gasto de sueldo automático.

## Dónde vive cada parte (propuesta, sin implementar)

- **`agenda`** sigue siendo dueña de las clases y de quién dio cada fecha. Hoy
  `clasesDictadas` trae un total por profe: para aplicar la tarifa de cada día tiene que devolver
  también las fechas (o los totales por día). Es un cambio chico en su `index.ts`.
- **`gastos`** sigue siendo dueña de los gastos. La liquidación usa su API pública (`cargar` con
  clave de idempotencia y `anular`), nunca sus tablas (regla 4).
- **Módulo nuevo `profesores`** (negocio, completo): el tipo de profe (la ficha mínima, sobre el
  usuario de `identidad`), las tarifas con su vigencia y las liquidaciones. Lee las clases
  dictadas de `agenda` y crea los gastos con `gastos`. Es lo que `gastos` ya anticipa como
  «el módulo de profesores».
- `cargar` de `gastos` corre en su propia transacción, así que crear la liquidación y sus gastos
  no es atómico. Se resuelve con la idempotencia: la liquidación se guarda primero, la clave de
  cada gasto sale de la liquidación, el profe y la sede, y confirmar de nuevo completa los gastos
  que falten sin duplicar.
- Permisos propios en el catálogo (0007), por sede: ver liquidaciones, configurar tarifas y
  liquidar. El nombre exacto se define con el módulo.

## Consecuencias

- Un pull request por módulo (regla 5): primero el cambio de `agenda`, después `profesores`.
- Se reemplaza la carga manual del sueldo de los empleados; el socio sigue sin gasto automático.
- Antes de implementar, confirmar los dos supuestos con Stretch Inn.
