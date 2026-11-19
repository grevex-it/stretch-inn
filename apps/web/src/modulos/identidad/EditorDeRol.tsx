// Ver, editar, duplicar o armar un rol (0007). Las plantillas se abren en solo lectura: se
// duplican para armar uno propio. Editar manda la versión: si otro lo cambió, la API avisa.
import type { CatalogoDePermisos, FichaDeRol } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Campo } from "../../base/controles/Campo.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import { useCatalogo, useFichaDeRol, useGuardarRol } from "./consultas-roles.ts";
import estilos from "./EditorDeRol.module.css";
import { enOrden } from "./matriz.ts";
import { MatrizDePermisos } from "./MatrizDePermisos.tsx";

export type Apertura = { modo: "ver" | "editar" | "duplicar"; rolId: string } | { modo: "nuevo" };

interface Props {
  apertura: Apertura;
  alCerrar: () => void;
  alGuardar: (nombre: string) => void;
}

type Secciones = CatalogoDePermisos["secciones"];

function SoloLectura(props: { ficha: FichaDeRol; secciones: Secciones; alCerrar: () => void }) {
  return (
    <>
      <h2 className={estilos.titulo}>{props.ficha.nombre}</h2>
      <p className={estilos.ayuda}>Es una plantilla: no se cambia. Duplicala para armar la tuya.</p>
      <MatrizDePermisos secciones={props.secciones} elegidos={new Set(props.ficha.permisos)} />
      <div className={estilos.botones}>
        <Boton variante="secundario" alHacerClic={props.alCerrar}>
          Cerrar
        </Boton>
      </div>
    </>
  );
}

interface Inicial {
  titulo: string;
  nombre: string;
  permisos: readonly string[];
  /** Solo al editar un rol propio: con qué versión se abrió. */
  edicion?: { id: string; version: number };
}

function Edicion(props: Omit<Props, "apertura"> & { inicial: Inicial; secciones: Secciones }) {
  const { inicial, secciones } = props;
  const [nombre, setNombre] = useState(inicial.nombre);
  const [elegidos, setElegidos] = useState(() => new Set(inicial.permisos));
  const guardar = useGuardarRol();
  const alEnviar = () => {
    const rol = { nombre, permisos: enOrden(secciones, elegidos), ...inicial.edicion };
    guardar.mutate(rol, {
      onSuccess: () => {
        props.alGuardar(nombre.trim());
      },
    });
  };
  return (
    <Formulario alEnviar={alEnviar}>
      <h2 className={estilos.titulo}>{inicial.titulo}</h2>
      <Campo etiqueta="Nombre del rol" valor={nombre} alCambiar={setNombre} />
      <MatrizDePermisos secciones={secciones} elegidos={elegidos} alCambiar={setElegidos} />
      {guardar.error !== null && <Aviso tono="error">{mensajeDe(guardar.error)}</Aviso>}
      <div className={estilos.botones}>
        <Boton tipo="submit" deshabilitado={guardar.isPending}>
          Guardar
        </Boton>
        <Boton variante="secundario" alHacerClic={props.alCerrar}>
          Cancelar
        </Boton>
      </div>
    </Formulario>
  );
}

function inicialDe(apertura: Apertura, ficha: FichaDeRol | undefined): Inicial {
  if (apertura.modo === "nuevo" || ficha === undefined) {
    return { titulo: "Rol nuevo", nombre: "", permisos: [] };
  }
  if (apertura.modo === "duplicar") {
    return { titulo: "Rol nuevo", nombre: `Copia de ${ficha.nombre}`, permisos: ficha.permisos };
  }
  return {
    titulo: `Editar ${ficha.nombre}`,
    nombre: ficha.nombre,
    permisos: ficha.permisos,
    edicion: { id: ficha.id, version: ficha.version },
  };
}

export function EditorDeRol({ apertura, alCerrar, alGuardar }: Props) {
  const catalogo = useCatalogo();
  const ficha = useFichaDeRol(apertura.modo === "nuevo" ? undefined : apertura.rolId);
  const error = catalogo.error ?? ficha.error;
  const contenido = () => {
    if (error !== null) return <Aviso tono="error">{mensajeDe(error)}</Aviso>;
    const secciones = catalogo.data?.secciones;
    const cargando = apertura.modo !== "nuevo" && ficha.data === undefined;
    if (secciones === undefined || cargando) return <p role="status">Cargando…</p>;
    if (apertura.modo === "ver" && ficha.data !== undefined) {
      return <SoloLectura ficha={ficha.data} secciones={secciones} alCerrar={alCerrar} />;
    }
    const inicial = inicialDe(apertura, ficha.data);
    return (
      <Edicion inicial={inicial} secciones={secciones} alCerrar={alCerrar} alGuardar={alGuardar} />
    );
  };
  return (
    <section className={estilos.editor} aria-label="Editor de rol">
      {contenido()}
    </section>
  );
}
