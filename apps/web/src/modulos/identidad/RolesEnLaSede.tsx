// Los roles de una persona en una sede: quitarlos o sumar uno, con usuarios.gestionar.
import type { PermisosDeIntegrante } from "@app/contratos";
import { useId, useState } from "react";
import { Boton } from "../../base/controles/Boton.tsx";
import type { CambiosDePermisos } from "./cambios-de-permisos.ts";
import { useRoles } from "./consultas.ts";
import estilos from "./PermisosDeIntegrante.module.css";

interface Props {
  sede: { id: string; nombre: string };
  asignaciones: PermisosDeIntegrante["asignaciones"];
  gestiona: boolean;
  cambios: CambiosDePermisos;
}

function SumarRol({ sede, asignaciones, cambios }: Omit<Props, "gestiona">) {
  const id = useId();
  const [rolId, setRolId] = useState("");
  const roles = useRoles();
  const tiene = new Set(asignaciones.map((a) => a.rolId));
  const opciones = (roles.data?.elementos ?? []).filter((rol) => !tiene.has(rol.id));
  return (
    <div className={estilos.fila}>
      <label htmlFor={id}>Rol para sumar</label>
      <select
        id={id}
        className={estilos.selector}
        value={rolId}
        onChange={(evento) => {
          setRolId(evento.target.value);
        }}
      >
        <option value="">Elegí un rol</option>
        {opciones.map((rol) => (
          <option key={rol.id} value={rol.id}>
            {rol.nombre}
          </option>
        ))}
      </select>
      <Boton
        variante="secundario"
        deshabilitado={rolId === "" || cambios.ocupado}
        alHacerClic={() => {
          cambios.asignar({ sedeId: sede.id, rolId });
          setRolId("");
        }}
      >
        Sumar rol
      </Boton>
    </div>
  );
}

export function RolesEnLaSede({ sede, asignaciones, gestiona, cambios }: Props) {
  const enLaSede = asignaciones.filter((a) => a.sedeId === sede.id);
  return (
    <div className={estilos.bloque}>
      <h3 className={estilos.subtitulo}>Roles en {sede.nombre}</h3>
      {enLaSede.length === 0 ? (
        <p className={estilos.texto}>No tiene roles en esta sede.</p>
      ) : (
        <ul className={estilos.roles}>
          {enLaSede.map((a) => (
            <li key={a.rolId} className={estilos.fila}>
              {a.rol}
              {gestiona && (
                <Boton
                  variante="secundario"
                  deshabilitado={cambios.ocupado}
                  alHacerClic={() => {
                    cambios.quitarAsignacion({ sedeId: sede.id, rolId: a.rolId });
                  }}
                >
                  Quitar rol
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {gestiona && <SumarRol sede={sede} asignaciones={enLaSede} cambios={cambios} />}
    </div>
  );
}
