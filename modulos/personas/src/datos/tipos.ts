// Tipos de los alumnos que usan los datos, la ficha y las rutas del módulo.

export interface DatosDeAlumno {
  nombre: string;
  apellido: string;
  /** El celular. Sin él, el alumno queda pendiente de completar (0022). */
  telefono: string | null;
  documento: string | null;
  email: string | null;
  /** AAAA-MM-DD. */
  fechaNacimiento: string | null;
  notas: string;
  /** Sin él, el alta toma el siguiente del centro y la edición conserva el que tenía. */
  numeroDeSocio?: number | null | undefined;
  /** AAAA-MM-DD: la «primera clase» (0019). Sin él, la edición conserva la que tenía. */
  fechaDeInicio?: string | null | undefined;
}

export interface Alumno extends Omit<DatosDeAlumno, "numeroDeSocio" | "fechaDeInicio"> {
  id: string;
  numeroDeSocio: number;
  fechaDeInicio: string | null;
  activo: boolean;
  /** Cuándo se dio de baja; null si está activo. */
  bajaEn: Date | null;
  /** Le falta el celular: no recibe mensajes automáticos hasta que lo tenga (0022). */
  pendienteDeCompletar: boolean;
  version: number;
}

export interface BusquedaDeAlumnos {
  pagina: number;
  porPagina: number;
  /** Por nombre, apellido, documento o teléfono. */
  buscar?: string;
  /** Con las bajas incluidas. */
  conBajas?: boolean;
}

export interface PaginaDeAlumnos {
  pagina: number;
  porPagina: number;
  total: number;
  elementos: Alumno[];
}

export type ErrorDeAlumno =
  | "nombre-vacio"
  | "telefono-invalido"
  | "fecha-invalida"
  | "socio-invalido"
  | "documento-repetido"
  | "socio-repetido"
  | "alumno-inexistente"
  | "cambio-concurrente"
  | "salud-muy-larga";
