# 0009 — Montos en pesos enteros

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Los centros operan en pesos argentinos y en la práctica no se usan centavos. Los decimales de punto flotante producen errores de redondeo (`0.1 + 0.2 = 0.30000000000000004`).

## Decisión

- **Todos los montos en pesos argentinos enteros**, con el tipo `Dinero` de `@app/nucleo`. Sin centavos y nunca en punto flotante.
- En la base: columnas `bigint` en pesos.
- Cuando un cálculo da decimales (descuentos, prorrateos), **`Dinero` redondea al peso más cercano**, y es el único lugar donde se redondea, para que no aparezcan diferencias entre pantallas.
- **Excepción: `licencias`.** Lo que GREVEX cobra a cada centro está en USD con referencia al dólar blue. Ese módulo guarda la moneda y la cotización usada en cada cobro, y lo documenta en su `AGENTS.md`.
