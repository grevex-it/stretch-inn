import { Link } from "@tanstack/react-router";
import { usePermiso, useSesion } from "../sesion.ts";
import estilos from "./Inicio.module.css";

export function Inicio() {
  const { data: sesion } = useSesion();
  const veAlumnos = usePermiso("personas.ver");
  const veEquipo = usePermiso("usuarios.ver");

  return (
    <section className={estilos.inicio} aria-labelledby="titulo-inicio">
      <header className={estilos.bienvenida}>
        <p>Inicio</p>
        <h1 id="titulo-inicio">Te damos la bienvenida</h1>
        <p>{sesion?.centroActivo?.nombre}</p>
      </header>
      {(veAlumnos || veEquipo) && (
        <nav className={estilos.accesos} aria-label="Accesos rápidos">
          {veAlumnos && (
            <Link className={estilos.tarjeta} to="/alumnos">
              <strong>Alumnos</strong>
              <span>Consultá y gestioná las fichas de tus alumnos.</span>
            </Link>
          )}
          {veEquipo && (
            <Link className={estilos.tarjeta} to="/equipo">
              <strong>Equipo</strong>
              <span>Consultá quiénes tienen acceso al panel.</span>
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
