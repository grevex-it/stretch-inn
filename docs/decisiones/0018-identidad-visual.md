# 0018 — Identidad visual

**Fecha:** 03/11/2026 · **Estado:** aceptada

## Contexto

El panel y el portal se van a construir por pantallas y por módulos, en dos frentes (0006) y con
ayuda de agentes. Sin una base común, cada pantalla termina con sus propios colores, tamaños y
tipografía.

## Decisión

- La identidad visual sale de la marca de Stretch Inn: **verde oliva** (degradé de `#36432F` a
  `#646854`) y **crema** (`#F3ECE2` / `#F6F1E8`), con el isotipo de las dos «S» entrelazadas y su
  patrón de fondo.
- **Tipografía:** Jost, geométrica como el logotipo. Liviana (300) para textos secundarios y
  bajadas, media (500) para títulos y botones.
- **Tokens en `paquetes/ui`:** `tokens.css` (variables `--si-…`) y `tokens.ts` con los mismos
  valores. Las pantallas usan solo las variables, nunca valores escritos a mano.
- **Accesibilidad AA como piso:** 4.5:1 para texto y 3:1 para bordes de controles y foco. Un test
  lo controla para cada par de colores en uso.
- **Controles cómodos al tacto:** 48px de alto, nunca menos de 44px. El panel se usa también desde
  el celular y la tablet de recepción.
- **Estilo:** superficies crema con bordes suaves y radios amplios (10, 12 y 20px); el oliva queda
  para la navegación, la acción principal y los bloques destacados. Íconos de trazo, sin emojis.

## Consecuencias

- Cambiar un color es cambiar un token, y se ve en todo el sistema.
- `paquetes/ui` es del frente de estructura: sumar o cambiar un token es un PR de estructura.
- Los diseños de referencia (login y pantalla «Hoy» del panel) están hechos con estos valores.
