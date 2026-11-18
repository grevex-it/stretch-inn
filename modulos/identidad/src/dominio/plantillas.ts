// Plantillas de roles que vienen con el sistema (0007): se copian a cada centro con su marca, no
// se editan y se duplican para armar roles propios. Los permisos van como texto, para no depender
// de los módulos de negocio, y se filtran con el catálogo: sin un módulo contratado, sin los suyos.
import type { Permiso } from "@app/nucleo";
import type { Catalogo } from "./catalogo.ts";

/** La marca que se guarda en `roles.plantilla`. Sigue aunque el centro renombre el rol. */
type MarcaDePlantilla = "dueno" | "encargado" | "profesor" | "recepcion" | "contadora";

export interface Plantilla {
  nombre: string;
  plantilla: MarcaDePlantilla;
  permisos: readonly Permiso[];
}

const ALUMNOS: readonly Permiso[] = [
  "personas.ver",
  "personas.editar",
  "personas.dar-de-baja",
  "personas.ver-salud",
  "personas.editar-salud",
];
const AGENDA: readonly Permiso[] = ["agenda.ver", "agenda.gestionar", "agenda.inscribir"];
const ASISTENCIA: readonly Permiso[] = [
  "asistencia.ver",
  "asistencia.tomar",
  "asistencia.avisar",
  "asistencia.recuperar",
];
const COBRAR: readonly Permiso[] = ["abonos.ver", "abonos.asignar", "caja.cobrar"];
const GASTOS: readonly Permiso[] = ["gastos.ver", "gastos.cargar", "gastos.anular"];

/**
 * Lo acordado con Stretch Inn (0019, 18/11). Las migraciones les dan lo mismo a los centros que ya
 * existían con identidad_dar_a_plantilla: herramientas/test/plantillas.test.ts lo controla.
 */
const OTRAS: readonly { nombre: string; plantilla: MarcaDePlantilla; permisos: Permiso[] }[] = [
  {
    // Opera su sede: los permisos van en la asignación por sede. Precios, roles y reglas de
    // recuperación los define el dueño; usuarios.gestionar se le da con un ajuste.
    nombre: "Encargado",
    plantilla: "encargado",
    permisos: [
      "usuarios.ver",
      ...ALUMNOS,
      ...AGENDA,
      ...ASISTENCIA,
      ...COBRAR,
      "caja.ver",
      "caja.anular",
      ...GASTOS,
    ],
  },
  {
    // Maneja a los alumnos en todo sentido y cobra, sin ver lo que ingresa (caja.ver).
    nombre: "Profesor",
    plantilla: "profesor",
    permisos: [...ALUMNOS, ...AGENDA, ...ASISTENCIA, ...COBRAR, "caja.anular"],
  },
  {
    // Anota, cobra y registra avisos: sin datos de salud, horarios, asistencia ni anulaciones.
    nombre: "Recepción",
    plantilla: "recepcion",
    permisos: [
      "personas.ver",
      "personas.editar",
      "agenda.ver",
      "agenda.inscribir",
      "asistencia.ver",
      "asistencia.avisar",
      "asistencia.recuperar",
      ...COBRAR,
    ],
  },
  {
    // Ve todo y no cambia nada; nunca los datos de salud.
    nombre: "Contaduría",
    plantilla: "contadora",
    permisos: [
      "usuarios.ver",
      "personas.ver",
      "agenda.ver",
      "asistencia.ver",
      "abonos.ver",
      "caja.ver",
      "gastos.ver",
    ],
  },
];

/** Las plantillas, con los permisos del catálogo en su orden. El Dueño tiene todo el catálogo. */
export function plantillasDelSistema(catalogo: Catalogo): Plantilla[] {
  const dueno: Plantilla = { nombre: "Dueño", plantilla: "dueno", permisos: catalogo.todos };
  return [
    dueno,
    ...OTRAS.map(({ nombre, plantilla, permisos }) => ({
      nombre,
      plantilla,
      permisos: catalogo.todos.filter((permiso) => permisos.includes(permiso)),
    })),
  ];
}
