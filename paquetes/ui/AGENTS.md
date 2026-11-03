# Paquete ui

Lo visual que comparten el panel (`apps/web`) y el portal (`apps/portal`): los tokens de la
identidad visual, los logos y, más adelante, los componentes compartidos. Ver
`docs/decisiones/0018-identidad-visual.md`.

## Alcance

- `src/tokens.css`: las variables CSS (`--si-…`). Cada app lo importa una sola vez, en `src/base`.
- `src/tokens.ts`: los mismos valores para usarlos desde TypeScript.
- `assets/`: logo completo, isotipo y patrón de fondo.

## Fuera de alcance

- Pantallas y componentes propios de un módulo: van en la carpeta de ese módulo dentro de la app.
- Ruteo, sesión y layout: `src/base/` de cada app.

## Depende de

- Nada.

## API pública

- `tokens`: objeto con todos los tokens por nombre (`tokens["si-oliva-700"]`).
- `variable(token)`: devuelve `var(--token)` para estilos armados desde TypeScript.
- `@app/ui/tokens.css`: la hoja con las variables.

## Reglas de uso

- **Nada de valores escritos a mano** en los CSS Modules: colores, radios, sombras y fuente se
  usan siempre como `var(--si-…)`. Si falta un valor, se agrega acá; no se inventa en la pantalla.
- Texto sobre fondos crema: `--si-texto`, `--si-texto-medio` o `--si-texto-suave`. Nunca más claro.
- Texto sobre oliva: `--si-texto-sobre-oliva`.
- Bordes de inputs y controles: `--si-borde-control` (llega a 3:1). `--si-borde` es solo para
  separar tarjetas y bloques.
- Foco visible siempre: `outline: 2px solid var(--si-foco)`, o `--si-foco-sobre-oliva` en fondos
  oscuros.
- Controles de al menos `--si-alto-control-min` (44px) de alto; el normal es `--si-alto-control`.
- Íconos de trazo, de 1.6px y en `currentColor`. Sin emojis.
- Estados (`ok`, `neutro`, `alerta`) siempre con su par de fondo y texto, y con una palabra que
  los nombre: el color solo no alcanza.
- Textos de la interfaz con voseo (0010).

## Invariantes

- `tokens.css` y `tokens.ts` tienen los mismos nombres y valores (lo controla el test).
- Los pares de texto y fondo cumplen WCAG AA: 4.5:1 para texto y 3:1 para bordes y foco (lo
  controla el test). Si sumás un par nuevo, sumalo al test.

## Pendientes

- Reemplazar los PNG de `assets/` por los SVG originales del logo.
- Elegir cómo se carga Jost: Google Fonts o `@fontsource/jost` empaquetada con la app.
- Sumar una regla de Stylelint que rechace colores escritos a mano fuera de `tokens.css`.
