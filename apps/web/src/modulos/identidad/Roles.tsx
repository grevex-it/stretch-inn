// Pantalla Roles (0007): las plantillas del sistema y los roles propios del centro. Las
// plantillas se duplican para armar uno a medida. Ocultar botones es solo UX: la API aplica cada
// regla (nadie da lo que no tiene, un rol en uso no se borra).
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Paginacion } from "../../base/controles/Paginacion.tsx";
import { useListaDeRoles } from "./consultas-roles.ts";
import { EditorDeRol, type Apertura } from "./EditorDeRol.tsx";
import estilos from "./Equipo.module.css";
import { FilaDeRol } from "./FilaDeRol.tsx";
import tabla from "./TablaDeEquipo.module.css";

function Lista({ alAbrir }: { alAbrir: (apertura: Apertura) => void }) {
  const [pagina, setPagina] = useState(1);
  const roles = useListaDeRoles(pagina);
  if (roles.error !== null) return <Aviso tono="error">{mensajeDe(roles.error)}</Aviso>;
  if (roles.data === undefined) return <p role="status">Cargando…</p>;
  return (
    <>
      <table className={tabla.tabla}>
        <thead>
          <tr>
            <th scope="col">Rol</th>
            <th scope="col">Tipo</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {roles.data.elementos.map((rol) => (
            <FilaDeRol key={rol.id} rol={rol} alAbrir={alAbrir} />
          ))}
        </tbody>
      </table>
      <Paginacion pagina={roles.data} alIrA={setPagina} />
    </>
  );
}

const claveDe = (apertura: Apertura) =>
  apertura.modo === "nuevo" ? "nuevo" : `${apertura.modo} ${apertura.rolId}`;

export function Roles() {
  const [abierto, setAbierto] = useState<Apertura | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const abrir = (apertura: Apertura) => {
    setGuardado(null);
    setAbierto(apertura);
  };
  return (
    <section className={estilos.equipo} aria-labelledby="titulo-roles">
      <div className={estilos.encabezado}>
        <h1 id="titulo-roles" className={estilos.titulo}>
          Roles
        </h1>
        <div className={estilos.enlaces}>
          <Link to="/equipo">Volver al equipo</Link>
          {abierto === null && (
            <Boton
              alHacerClic={() => {
                abrir({ modo: "nuevo" });
              }}
            >
              Rol nuevo
            </Boton>
          )}
        </div>
      </div>
      {guardado !== null && <Aviso tono="ok">Guardamos el rol {guardado}.</Aviso>}
      {abierto !== null && (
        <EditorDeRol
          key={claveDe(abierto)}
          apertura={abierto}
          alCerrar={() => {
            setAbierto(null);
          }}
          alGuardar={(nombre) => {
            setAbierto(null);
            setGuardado(nombre);
          }}
        />
      )}
      <Lista alAbrir={abrir} />
    </section>
  );
}
