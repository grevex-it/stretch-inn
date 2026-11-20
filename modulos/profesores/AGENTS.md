# Módulo profesores

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Lo que hace falta para pagarles a los profes (0024): el tipo de cada profe (empleado o socio) y
las tarifas por clase en cuatro niveles, con su vigencia. La liquidación de un período se suma
después, con las clases dictadas de `agenda` y los gastos de `gastos`.

## Fuera de alcance

- Quién es cada profe (nombre, si está activo): `identidad`. El profe es un usuario del equipo.
- Las clases, sus fechas y quién dio cada una: `agenda`.
- Los gastos: `gastos`.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (la zona horaria del centro, para el día de hoy)
- `@app/identidad` (el equipo activo y si un profe es válido: `listarUsuariosActivos` y
  `obtenerUsuarios`)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearProfesores(base, { ahora? })`: devuelve `Profesores`. Cada operación recibe el
  `ContextoCentro` de quien la pide y corre en su propia transacción:
  - `profes(quien, { pagina, porPagina })`: el equipo activo del centro con el tipo de cada uno.
  - `fijarTipo(quien, { profeId, tipo })`: `empleado` o `socio`.
  - `tarifas(quien, { sedeId, pagina, porPagina })`: las de una sede, o las de todo el centro con
    `sedeId` null; la más nueva primero.
  - `fijarTarifa(quien, { sedeId, profeId, monto, desde })`: una tarifa nueva del alcance (null:
    todos). Rige desde `desde` y cierra la última abierta del mismo alcance el día antes.
- `rutasDeProfesores(profesores)`: `GET /profesores?pagina` y `GET /profesores/tarifas?sede&pagina`
  (`profesores.ver`); `PUT /profesores/:id/tipo` y `POST /profesores/tarifas`
  (`profesores.configurar`).
- `PERMISOS_PROFESORES`: la sección «Profesores» del catálogo (`profesores.ver`,
  `profesores.configurar`).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- **Montos en pesos enteros** (`Dinero`, `bigint`): mayores que cero, con un tope de $100.000.000.
- **Cuatro niveles de tarifa, gana el más específico:** profe y sede, profe, sede, centro. Una
  clase sin ninguna tarifa aplicable no se paga en cero: la liquidación lo avisa.
- **Vigencia:** cada tarifa rige desde un día. Una nueva cierra la última abierta del mismo
  alcance el día antes y tiene que empezar después que ella. Los cambios de un alcance van de a
  uno (bloqueo por alcance). Cada clase se paga con la tarifa vigente el día en que se dictó.
- Las tarifas de una sede y su permiso son de esa sede (RLS por centro y sedes visibles); el tipo
  de profe y las tarifas de todo el centro son del centro y piden el permiso en alguna sede.
- El profe es un usuario activo del equipo del centro, leído con RLS por la API de `identidad`.
  Sin tipo fijado, es empleado.

## Glosario

- **Tarifa:** cuánto se le paga a un profe por cada clase dictada.
- **Alcance:** a quién y dónde aplica una tarifa: un profe o todos, en una sede o en todas.
- **Socio:** un profe al que se le cuentan las clases pero no se le genera un gasto de sueldo.

## Configuración por centro

Desde el panel: el tipo de cada profe y las tarifas (`tipos_de_profe`, `tarifas_del_centro` y
`tarifas_de_sede`).

## Pendientes

- **[SUPUESTO, 0024]** Sin aumentos hacia atrás: una tarifa nueva rige desde hoy o más adelante.
- **[SUPUESTO, 0024]** Al socio no se le genera un gasto de sueldo automático.
- La liquidación de un período (0024): con `dictadasPorDia` de `agenda` y `cargar`/`anular` de
  `gastos`.
- Corregir una tarifa cargada por error: hoy solo se reemplaza con otra desde un día posterior.
