# Panel web

React + TypeScript + Vite + TanStack Router y Query.

## Estructura

- `src/base/`: ruteo, sesión, cliente de la API, layout. Es estructura: no se cambia de paso.
- `src/modulos/<modulo>/`: pantallas de cada módulo. Una carpeta por módulo, como en el backend.

## Reglas

- Los datos se piden siempre con el cliente de `src/base/api` y TanStack Query.
  Nunca `fetch` directo.
- Los tipos de la API salen de `@app/contratos`. No se redefinen.
- Ocultar un botón según el permiso es solo para la experiencia de usuario: **la
  seguridad la aplica la API**. Nunca confíes en el front para eso.
- Estilos con CSS Modules, un archivo por componente. Nada de CSS global salvo `src/base`.
- Textos de la interfaz en español con voseo («Guardá», «Elegí la sede»).
