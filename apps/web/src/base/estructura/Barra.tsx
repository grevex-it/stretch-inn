// Barra superior: centro y sede con los que se trabaja, y salir (0017). Con un solo centro o una
// sola sede no hay nada que elegir: se muestra el nombre.
import type { EstadoDeSesion } from "@app/contratos";
import isotipo from "@app/ui/assets/isotipo-crema.png";
import logo from "@app/ui/assets/logo-crema.png";
import { useElegirCentro, useElegirSede, useSalir } from "../sesion.ts";
import estilos from "./Barra.module.css";
import { Selector } from "./Selector.tsx";

type CentroActivo = NonNullable<EstadoDeSesion["centroActivo"]>;

interface Props {
  centros: EstadoDeSesion["centros"];
  centro: CentroActivo;
}

function SelectorDeSede({ centros, centro }: Props) {
  const elegir = useElegirSede();
  const [unica] = centro.sedes;
  if (centro.sedes.length === 1 && unica !== undefined) {
    return <span className={estilos.nombre}>{unica.nombre}</span>;
  }
  const opciones = [
    { valor: "todas", texto: "Todas mis sedes" },
    ...centro.sedes.map((sede) => ({ valor: sede.id, texto: sede.nombre })),
  ];
  return (
    <Selector
      etiqueta="Sede"
      ocultarEtiqueta={centros.length <= 1}
      valor={centro.sedeActiva}
      opciones={opciones}
      deshabilitado={elegir.isPending}
      alCambiar={(sede) => {
        elegir.mutate(sede);
      }}
    />
  );
}

function SelectorDeCentro({ centros, centro }: Props) {
  const elegir = useElegirCentro();
  if (centros.length <= 1) return null;
  return (
    <Selector
      etiqueta="Centro"
      valor={centro.id}
      opciones={centros.map((c) => ({ valor: c.id, texto: c.nombre }))}
      deshabilitado={elegir.isPending}
      alCambiar={(centroId) => {
        elegir.mutate(centroId);
      }}
    />
  );
}

export function Barra({ centros, centro }: Props) {
  const salir = useSalir();
  return (
    <header className={estilos.barra}>
      <picture>
        <source media="(max-width: 600px)" srcSet={isotipo} />
        <img className={estilos.logo} src={logo} alt="Stretch Inn" />
      </picture>
      <SelectorDeCentro centros={centros} centro={centro} />
      <SelectorDeSede centros={centros} centro={centro} />
      <button
        type="button"
        className={estilos.salir}
        aria-label="Salir"
        title="Salir"
        disabled={salir.isPending}
        onClick={() => {
          salir.mutate();
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 7V4H4v16h9v-3" />
          <path className={estilos.flecha} d="m12 8 4 4-4 4m4-4H7" />
        </svg>
      </button>
    </header>
  );
}
