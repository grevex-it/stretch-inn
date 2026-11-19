// Un rol de la lista. Las plantillas se ven y se duplican; los roles propios también se editan y
// se borran. Borrar pide confirmación: si alguien lo tiene, la API dice quiénes.
import type { PaginaDeRoles } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { useBorrarRol } from "./consultas-roles.ts";
import type { Apertura } from "./EditorDeRol.tsx";
import estilos from "./FilaDeRol.module.css";

type Rol = PaginaDeRoles["elementos"][number];

interface Props {
  rol: Rol;
  alAbrir: (apertura: Apertura) => void;
}

function Confirmar(props: { nombre: string; alResponder: (si: boolean) => void }) {
  return (
    <div className={estilos.acciones}>
      <p className={estilos.pregunta}>¿Borrar el rol {props.nombre}? No se puede deshacer.</p>
      <Boton
        alHacerClic={() => {
          props.alResponder(true);
        }}
      >
        Sí, borrar
      </Boton>
      <Boton
        variante="secundario"
        alHacerClic={() => {
          props.alResponder(false);
        }}
      >
        Cancelar
      </Boton>
    </div>
  );
}

function Acciones({ rol, alAbrir }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const borrar = useBorrarRol();
  if (confirmando) {
    return (
      <Confirmar
        nombre={rol.nombre}
        alResponder={(si) => {
          setConfirmando(false);
          if (si) borrar.mutate(rol.id);
        }}
      />
    );
  }
  const boton = (texto: string, alHacerClic: () => void) => (
    <Boton variante="secundario" deshabilitado={borrar.isPending} alHacerClic={alHacerClic}>
      {texto}
    </Boton>
  );
  const abrir = (modo: "ver" | "editar" | "duplicar") => () => {
    alAbrir({ modo, rolId: rol.id });
  };
  const esPlantilla = rol.plantilla !== null;
  return (
    <div className={estilos.acciones}>
      {boton(esPlantilla ? "Ver" : "Editar", abrir(esPlantilla ? "ver" : "editar"))}
      {boton("Duplicar", abrir("duplicar"))}
      {!esPlantilla &&
        boton("Borrar", () => {
          setConfirmando(true);
        })}
      {borrar.error !== null && <Aviso tono="error">{mensajeDe(borrar.error)}</Aviso>}
    </div>
  );
}

export function FilaDeRol({ rol, alAbrir }: Props) {
  return (
    <tr className={estilos.fila}>
      <th scope="row" className={estilos.nombre}>
        {rol.nombre}
      </th>
      <td>
        <span className={rol.plantilla === null ? estilos.propio : estilos.plantilla}>
          {rol.plantilla === null ? "Propio" : "Plantilla"}
        </span>
      </td>
      <td>
        <Acciones rol={rol} alAbrir={alAbrir} />
      </td>
    </tr>
  );
}
