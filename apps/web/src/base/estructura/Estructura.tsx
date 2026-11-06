// Estructura del panel con un centro elegido: la barra, avisos de la sesión y la pantalla actual.
import { Outlet } from "@tanstack/react-router";
import { Aviso } from "../controles/Aviso.tsx";
import { useSesion } from "../sesion.ts";
import { Barra } from "./Barra.tsx";
import estilos from "./Estructura.module.css";

export function Estructura() {
  const { data: sesion } = useSesion();
  const centro = sesion?.centroActivo;
  // La puerta solo monta la estructura con un centro activo.
  if (sesion === undefined || sesion === null || centro === undefined || centro === null) {
    return null;
  }
  const activa = centro.sedes.find((sede) => sede.id === centro.sedeActiva);
  return (
    <div className={estilos.estructura}>
      <Barra centros={sesion.centros} centro={centro} />
      <main className={estilos.contenido}>
        {centro.sedeCambiada && (
          <Aviso tono="alerta">
            Ya no tenés permisos en la sede que tenías elegida. Ahora estás en{" "}
            {activa?.nombre ?? "todas tus sedes"}.
          </Aviso>
        )}
        <Outlet />
      </main>
    </div>
  );
}
