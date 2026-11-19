// Cada permiso del catálogo en una sede: de qué rol viene, si tiene un ajuste (extra o quitado,
// destacados) y si al final lo tiene. Con usuarios.gestionar, se ajusta uno por uno.
import type { CatalogoDePermisos, PedidoDeAjuste, PermisosDeIntegrante } from "@app/contratos";
import { Boton } from "../../base/controles/Boton.tsx";
import type { CambiosDePermisos } from "./cambios-de-permisos.ts";
import estilos from "./PermisosDeIntegrante.module.css";

type Fila = PermisosDeIntegrante["permisos"][number];

interface Props {
  sedeId: string;
  secciones: CatalogoDePermisos["secciones"];
  permisos: PermisosDeIntegrante["permisos"];
  gestiona: boolean;
  cambios: CambiosDePermisos;
}

function origen(fila: Fila | undefined): string {
  if (fila === undefined) return "Sin acceso";
  const deRoles = fila.roles.length > 0 ? `del rol ${fila.roles.join(", ")}` : "";
  if (fila.ajuste === "extra") return "Extra";
  if (fila.ajuste === "quitado") return deRoles === "" ? "Quitado" : `Quitado (${deRoles})`;
  return deRoles === "" ? "Sin acceso" : `Del rol ${fila.roles.join(", ")}`;
}

function Ajuste(props: {
  sedeId: string;
  permiso: PedidoDeAjuste["permiso"];
  fila?: Fila;
  cambios: CambiosDePermisos;
}) {
  const { sedeId, permiso, fila, cambios } = props;
  const hacer = () => {
    if (fila?.ajuste != null) cambios.quitarAjuste({ sedeId, permiso });
    else cambios.ajustar({ sedeId, permiso, tipo: fila?.efectivo === true ? "quitado" : "extra" });
  };
  const texto =
    fila?.ajuste != null ? "Volver al rol" : fila?.efectivo === true ? "Quitar" : "Dar como extra";
  return (
    <Boton variante="secundario" deshabilitado={cambios.ocupado} alHacerClic={hacer}>
      {texto}
    </Boton>
  );
}

export function OrigenDePermisos({ sedeId, secciones, permisos, gestiona, cambios }: Props) {
  const porPermiso = new Map(
    permisos.filter((p) => p.sedeId === sedeId).map((p) => [p.permiso, p]),
  );
  return (
    <div className={estilos.bloque}>
      {secciones.map((seccion) => (
        <table key={seccion.seccion} className={estilos.tabla} aria-label={seccion.seccion}>
          <caption className={estilos.subtitulo}>{seccion.seccion}</caption>
          <tbody>
            {seccion.permisos.map(({ permiso, descripcion }) => {
              const fila = porPermiso.get(permiso);
              const ajuste = fila?.ajuste ?? undefined;
              return (
                <tr
                  key={permiso}
                  data-ajuste={ajuste}
                  className={ajuste === undefined ? estilos.permiso : estilos.ajustado}
                >
                  <th scope="row">{descripcion}</th>
                  <td>{origen(fila)}</td>
                  <td>{fila?.efectivo === true ? "Sí" : "No"}</td>
                  {gestiona && (
                    <td>
                      <Ajuste
                        sedeId={sedeId}
                        permiso={permiso}
                        cambios={cambios}
                        {...(fila === undefined ? {} : { fila })}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}
