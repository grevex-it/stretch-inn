// El catálogo completo: los permisos de cada módulo (0007). Se suma cada módulo al crearlo, junto
// con la migración que le da sus permisos al Dueño (herramientas/test/permisos-del-dueno.test.ts
// lo controla). Lo usan la API (roles a medida) y herramientas (semilla y guardianes).
import { PERMISOS_ABONOS } from "@app/abonos";
import { PERMISOS_AGENDA } from "@app/agenda";
import { PERMISOS_ASISTENCIA } from "@app/asistencia";
import { PERMISOS_CAJA } from "@app/caja";
import { PERMISOS_GASTOS } from "@app/gastos";
import { crearCatalogo, PERMISOS_IDENTIDAD } from "@app/identidad";
import { PERMISOS_PERSONAS } from "@app/personas";

export const CATALOGO = crearCatalogo([
  PERMISOS_IDENTIDAD,
  PERMISOS_PERSONAS,
  PERMISOS_AGENDA,
  PERMISOS_ASISTENCIA,
  PERMISOS_ABONOS,
  PERMISOS_CAJA,
  PERMISOS_GASTOS,
]);
