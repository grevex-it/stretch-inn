// Tipos de los alumnos que usan los datos, la ficha y las rutas del módulo.

export interface DatosDeAlumno {
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string | null;
  email: string | null;
  /** AAAA-MM-DD. */
  fechaNacimiento: string | null;
  notas: string;
}

export interface Alumno extends DatosDeAlumno {
  id: string;
  activo: boolean;
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
  | "documento-repetido"
  | "alumno-inexistente"
  | "cambio-concurrente"
  | "salud-muy-larga";
