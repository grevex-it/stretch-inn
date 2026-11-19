// Los permisos de una persona del equipo (0007): sus roles en cada sede y, por permiso, de dónde
// viene. Con una sede activa solo se ve esa sede: si tiene más en otras, se avisa para pasar a
// «Todas mis sedes». Ocultar botones es solo UX: la API aplica cada regla.
import { useId, useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { useElegirSede, usePermiso, useSesion } from "../../base/sesion.ts";
import { useCambiosDePermisos } from "./cambios-de-permisos.ts";
import { useCatalogo, usePermisosDe } from "./consultas-roles.ts";
import { OrigenDePermisos } from "./OrigenDePermisos.tsx";
import estilos from "./PermisosDeIntegrante.module.css";
import { RolesEnLaSede } from "./RolesEnLaSede.tsx";

interface Sede {
  id: string;
  nombre: string;
}

interface Props {
  integrante: { id: string; nombre: string };
  alCerrar: () => void;
}

/** Las sedes que se ven ahora: con una sede activa, solo esa. */
function useSedesVisibles() {
  const centro = useSesion().data?.centroActivo;
  const sedes = centro?.sedes ?? [];
  const todas = centro?.sedeActiva === "todas";
  return {
    visibles: todas ? sedes : sedes.filter((sede) => sede.id === centro?.sedeActiva),
    puedePasarATodas: !todas && sedes.length > 1,
  };
}

function ElegirSede(props: { sedes: Sede[]; sede: Sede; alElegir: (sedeId: string) => void }) {
  const id = useId();
  if (props.sedes.length < 2) return null;
  return (
    <div className={estilos.fila}>
      <label htmlFor={id}>Sede</label>
      <select
        id={id}
        className={estilos.selector}
        value={props.sede.id}
        onChange={(evento) => {
          props.alElegir(evento.target.value);
        }}
      >
        {props.sedes.map((sede) => (
          <option key={sede.id} value={sede.id}>
            {sede.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

function AvisoDeOtrasSedes({ nombre }: { nombre: string }) {
  const elegir = useElegirSede();
  return (
    <div className={estilos.bloque}>
      <Aviso tono="alerta">
        {nombre} también tiene permisos en otras sedes. Para verlos y cambiarlos, pasá a «Todas mis
        sedes».
      </Aviso>
      <div>
        <Boton
          variante="secundario"
          deshabilitado={elegir.isPending}
          alHacerClic={() => {
            elegir.mutate("todas");
          }}
        >
          Pasar a Todas mis sedes
        </Boton>
      </div>
    </div>
  );
}

function Contenido({ integrante }: Pick<Props, "integrante">) {
  const { visibles, puedePasarATodas } = useSedesVisibles();
  const [sedeId, setSedeId] = useState<string | undefined>(undefined);
  const gestiona = usePermiso("usuarios.gestionar");
  const permisos = usePermisosDe(integrante.id);
  const catalogo = useCatalogo();
  const cambios = useCambiosDePermisos(integrante.id);
  const error = permisos.error ?? catalogo.error;
  if (error !== null) return <Aviso tono="error">{mensajeDe(error)}</Aviso>;
  const sede = visibles.find((s) => s.id === sedeId) ?? visibles[0];
  if (permisos.data === undefined || catalogo.data === undefined || sede === undefined) {
    return <p>Cargando…</p>;
  }
  const comun = { gestiona, cambios };
  return (
    <>
      {puedePasarATodas && permisos.data.enOtrasSedes && (
        <AvisoDeOtrasSedes nombre={integrante.nombre} />
      )}
      <ElegirSede sedes={visibles} sede={sede} alElegir={setSedeId} />
      {cambios.error !== undefined && <Aviso tono="error">{cambios.error}</Aviso>}
      <RolesEnLaSede sede={sede} asignaciones={permisos.data.asignaciones} {...comun} />
      <OrigenDePermisos
        sedeId={sede.id}
        secciones={catalogo.data.secciones}
        permisos={permisos.data.permisos}
        {...comun}
      />
    </>
  );
}

export function PermisosDeIntegrante({ integrante, alCerrar }: Props) {
  const titulo = useId();
  return (
    <section className={estilos.ficha} aria-labelledby={titulo}>
      <div className={estilos.encabezado}>
        <h2 id={titulo} className={estilos.titulo}>
          Permisos de {integrante.nombre}
        </h2>
        <Boton variante="secundario" alHacerClic={alCerrar}>
          Cerrar
        </Boton>
      </div>
      <Contenido integrante={integrante} />
    </section>
  );
}
