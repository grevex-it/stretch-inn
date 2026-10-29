# 0007 — Usuarios, roles y permisos personalizables

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Cada centro trabaja distinto. Hay que poder crear un usuario y darle acceso a ciertas secciones con cierto nivel, crear roles a medida y que la sede central vea todo mientras las demás sedes tienen vistas acotadas.

## Decisión

**Lo que ve y hace cada usuario depende de sus roles y permisos, no de la sede física.** La sede central existe como dato (por ejemplo, para encabezar reportes consolidados), pero no da permisos por sí misma.

### Tres capas

1. **Permisos:** lista fija en el código, agrupada por sección. Cada módulo declara los suyos (ej. `caja.ver`, `caja.cobrar`, `caja.anular`, `abonos.editar-precios`, `agenda.ver-propias`). El centro no inventa permisos; los combina.
2. **Roles:** conjuntos de permisos.
   - Plantillas del sistema (dueño, encargado, recepción, profesor): no se editan, se duplican.
   - Roles personalizados de cada centro, aislados por RLS.
3. **Usuario:** uno o varios **roles por sede** (puede ser encargado en una sede y recepción en otra), más **ajustes individuales**: permisos extra y permisos quitados.

**Permisos efectivos = los de sus roles en cada sede + extras − quitados.** Si un permiso está como extra y como quitado, gana el quitado.

### Gestión

- La gestión también son permisos: `usuarios.ver`, `usuarios.gestionar`, `roles.gestionar`. Quién gestiona usuarios depende del rol que se le arme.
- El **admin del centro puede crear y editar roles**. GREVEX también los crea durante el alta (ver 0008).
- Alta de un centro: GREVEX crea el centro, las sedes y el **admin general** con todos los permisos; después arma los roles a medida.

### Reglas de seguridad

1. Nadie puede dar permisos que no tiene (ni en roles ni en ajustes individuales).
2. Siempre queda al menos un usuario con acceso total; el sistema no deja quitar el último.
3. Los permisos se calculan en cada pedido (con caché corta), no se guardan en el login: un permiso quitado se pierde en el momento.
4. Todo cambio de permisos queda en `auditoria`.
5. Las licencias filtran los permisos: si el centro no contrató un módulo, sus permisos no aparecen.

### Cómo se aplica

- El `ContextoCentro` lleva los **permisos por sede**. Los casos de uso consultan `puede(ctx, "caja.cobrar", sedeId)`.
- RLS controla qué sedes se ven; la aplicación controla qué acciones se hacen (ver 0002).
- Cada ruta de la API declara qué permiso exige; un test falla si alguna no lo declara.
- «Ver solo lo propio» (ej. el profesor y sus clases) es un filtro de datos con su propio permiso (`agenda.ver-propias`), no un nivel de sección.

### Pantalla

Matriz de secciones con atajos (Sin acceso / Ver / Operar / Personalizado) que marcan varios permisos a la vez, selector de sede, y **siempre visible el origen de cada permiso** (qué rol, extra o quitado). Los ajustes individuales se muestran destacados.

Todo esto vive en el módulo `identidad` (frente de estructura).
