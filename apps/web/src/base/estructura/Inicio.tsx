// Pantalla de inicio. Por ahora un lugar donde aterrizar; la pantalla «Hoy» llega con agenda.
import estilos from "./Inicio.module.css";

export function Inicio() {
  return (
    <section className={estilos.inicio} aria-labelledby="titulo-inicio">
      <h1 id="titulo-inicio" className={estilos.titulo}>
        Inicio
      </h1>
      <p className={estilos.texto}>Acá vas a ver las clases del día y lo que hay que resolver.</p>
    </section>
  );
}
