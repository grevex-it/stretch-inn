// Los permisos de un rol, por sección del catálogo: un atajo por sección y una casilla por permiso.
// Sin `alCambiar`, en solo lectura (las plantillas no se editan).
import type { CatalogoDePermisos } from "@app/contratos";
import { useId } from "react";
import { conNivel, NIVELES, nivelDe, type Nivel } from "./matriz.ts";
import estilos from "./MatrizDePermisos.module.css";

type Seccion = CatalogoDePermisos["secciones"][number];

interface Props {
  secciones: Seccion[];
  elegidos: ReadonlySet<string>;
  alCambiar?: (elegidos: Set<string>) => void;
}

function Atajo(props: {
  seccion: Seccion;
  elegidos: ReadonlySet<string>;
  alCambiar: (elegidos: Set<string>) => void;
}) {
  const id = useId();
  const permisos = props.seccion.permisos.map((p) => p.permiso);
  return (
    <div className={estilos.atajo}>
      <label htmlFor={id}>Acceso a {props.seccion.seccion}</label>
      <select
        id={id}
        className={estilos.selector}
        value={nivelDe(permisos, props.elegidos)}
        onChange={(evento) => {
          props.alCambiar(conNivel(permisos, props.elegidos, evento.target.value as Nivel));
        }}
      >
        {NIVELES.map(({ nivel, texto }) => (
          <option key={nivel} value={nivel}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function Casillas({ seccion, elegidos, alCambiar }: Props & { seccion: Seccion }) {
  return (
    <div className={estilos.casillas}>
      {seccion.permisos.map(({ permiso, descripcion }) => (
        <label key={permiso} className={estilos.casilla}>
          <input
            type="checkbox"
            checked={elegidos.has(permiso)}
            disabled={alCambiar === undefined}
            onChange={(evento) => {
              const nuevos = new Set(elegidos);
              if (evento.target.checked) nuevos.add(permiso);
              else nuevos.delete(permiso);
              alCambiar?.(nuevos);
            }}
          />
          {descripcion}
        </label>
      ))}
    </div>
  );
}

export function MatrizDePermisos({ secciones, elegidos, alCambiar }: Props) {
  return (
    <div className={estilos.matriz}>
      {secciones.map((seccion) => (
        <fieldset key={seccion.seccion} className={estilos.seccion}>
          <legend className={estilos.titulo}>{seccion.seccion}</legend>
          {alCambiar !== undefined && (
            <Atajo seccion={seccion} elegidos={elegidos} alCambiar={alCambiar} />
          )}
          <Casillas
            secciones={secciones}
            seccion={seccion}
            elegidos={elegidos}
            {...(alCambiar === undefined ? {} : { alCambiar })}
          />
        </fieldset>
      ))}
    </div>
  );
}
