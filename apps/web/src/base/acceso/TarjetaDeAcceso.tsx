// Marco de las pantallas previas al panel: login, clave temporal y elegir centro.
import logo from "@app/ui/assets/logo-oliva.png";
import type { ReactNode } from "react";
import estilos from "./TarjetaDeAcceso.module.css";

interface Props {
  titulo: string;
  bajada?: string;
  children: ReactNode;
}

export function TarjetaDeAcceso({ titulo, bajada, children }: Props) {
  return (
    <main className={estilos.fondo}>
      <section className={estilos.tarjeta} aria-labelledby="titulo-acceso">
        <img className={estilos.logo} src={logo} alt="" />
        <h1 id="titulo-acceso" className={estilos.titulo}>
          {titulo}
        </h1>
        {bajada !== undefined && <p className={estilos.bajada}>{bajada}</p>}
        {children}
      </section>
    </main>
  );
}
