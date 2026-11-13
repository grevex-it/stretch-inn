# 0022 — Viaje, gastos y pago a los profes

**Fecha:** 13/11/2026 · **Estado:** aceptada

## Contexto

Respuestas del equipo del 13/11 a lo que quedaba abierto de 0019 y 0020, y la planilla de
alumnos y pagos que Stretch Inn completa hasta que arranque el sistema.

## Decisión

### Alumno de viaje

- **Paga como un mes común:** no hay media cuota. Se reemplaza lo que decía 0019.
- Conserva su horario fijo: no se da de baja. Las fechas en que no viene gastan clases del abono
  como cualquier falta (0020).
- Su lugar en esas fechas queda libre para recuperaciones: se registra como una ausencia avisada
  por un período (de tal fecha a tal fecha), no fecha por fecha.

### Gastos

- **Módulo nuevo `gastos`**, separado de `caja`: lo que sale, no lo que entra.
- Cada gasto es de una sede: fecha, monto en pesos enteros (0009), categoría, medio de pago y
  descripción. El encargado carga los de su sede; se cargan todos los gastos.
- Cargar un gasto mueve dinero: lleva clave de idempotencia. No se borra: se anula con motivo.

### Pago a los profes

- **Por ahora, por clase dictada:** cada fecha no cancelada de una clase cuenta para su profe.
  El monto por clase y los detalles se definen más adelante.
- Cada sede tiene su profe fijo (en Río Tercero, Lore): es el profe por defecto de sus clases.
- El alumno tiene un profe asignado (lo trae la planilla).

### Planilla de alumnos (importación)

La planilla trae 277 alumnos y define los datos de la ficha:

- número de socio (único en el centro);
- nombre y apellido;
- DNI, fecha de nacimiento y celular (no todos lo tienen);
- profe asignado y fecha de inicio (no todos la tienen);
- modalidad de pago y horario fijo (opcionales);
- estado y fecha de baja;
- observaciones y antecedentes de salud.

Lo que falta no frena la importación: el alumno queda «pendiente de completar» y no recibe
mensajes automáticos hasta que tenga un celular válido. Las observaciones de salud van a los datos
de salud (permiso propio, 0019).

## Consecuencias

- `asistencia`: avisar una ausencia por un período.
- `gastos`: módulo nuevo, con permisos para ver y para cargar.
- `personas`: número de socio, celular opcional, fecha de inicio, fecha de baja y profe asignado.
  Un importador de la planilla.
- Profesores: la ficha del profe y su vínculo con las clases (`agenda`) y con los alumnos.
