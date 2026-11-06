// Decide qué ve la persona según su sesión: entrar, cambiar la clave temporal, elegir centro o el
// panel. Es experiencia de usuario: la seguridad la aplica la API en cada pedido.
import type { ReactNode } from "react";
import { CambiarClave } from "./acceso/CambiarClave.tsx";
import { ElegirCentro } from "./acceso/ElegirCentro.tsx";
import { Login } from "./acceso/Login.tsx";
import { TarjetaDeAcceso } from "./acceso/TarjetaDeAcceso.tsx";
import { Aviso, mensajeDe } from "./controles/Aviso.tsx";
import { Boton } from "./controles/Boton.tsx";
import { useSesion } from "./sesion.ts";

export function Puerta({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  if (sesion.isPending) {
    return <TarjetaDeAcceso titulo="Cargando…">{null}</TarjetaDeAcceso>;
  }
  if (sesion.isError) {
    return (
      <TarjetaDeAcceso titulo="No pudimos abrir el panel">
        <Aviso tono="error">{mensajeDe(sesion.error)}</Aviso>
        <Boton alHacerClic={() => void sesion.refetch()}>Reintentar</Boton>
      </TarjetaDeAcceso>
    );
  }
  const estado = sesion.data;
  if (estado === null) return <Login />;
  if (estado.debeCambiarClave) return <CambiarClave />;
  if (estado.centroActivo === null) return <ElegirCentro centros={estado.centros} />;
  return children;
}
