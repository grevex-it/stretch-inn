// Secciones del panel. Cada una aparece solo si tiene el permiso para verla (es solo UX: la API
// aplica la seguridad).
import { Link } from "@tanstack/react-router";
import { usePermiso } from "../sesion.ts";
import estilos from "./Navegacion.module.css";

export function Navegacion() {
  const veAlumnos = usePermiso("personas.ver");
  const veEquipo = usePermiso("usuarios.ver");
  const enlace = { className: estilos.enlace, activeProps: { "aria-current": "page" as const } };
  return (
    <nav className={estilos.navegacion} aria-label="Secciones">
      <Link to="/" activeOptions={{ exact: true }} {...enlace}>
        Inicio
      </Link>
      {veAlumnos && (
        <Link to="/alumnos" {...enlace}>
          Alumnos
        </Link>
      )}
      {veEquipo && (
        <Link to="/equipo" {...enlace}>
          Equipo
        </Link>
      )}
    </nav>
  );
}
