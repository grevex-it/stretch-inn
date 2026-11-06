// Pantalla Equipo: quién trabaja en el centro, con qué rol en cada sede, y las acciones de quien
// gestiona usuarios (0017). Ocultar botones es solo UX: la API aplica cada regla.
import type { AltaHecha } from "@app/contratos";
import { useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import { ClaveTemporal } from "./ClaveTemporal.tsx";
import { useEquipo } from "./consultas.ts";
import estilos from "./Equipo.module.css";
import { FormularioDeAlta } from "./FormularioDeAlta.tsx";
import { TablaDeEquipo } from "./TablaDeEquipo.tsx";

/** Lo último que se hizo: la clave temporal a pasar, o null si la cuenta ya existía. */
type Resultado = { nombre: string; clave: string | null } | null;

function AvisoDeResultado({ resultado, alCerrar }: { resultado: Resultado; alCerrar: () => void }) {
  if (resultado === null) return null;
  if (resultado.clave === null) {
    return (
      <Aviso tono="ok">
        {resultado.nombre} ya tenía cuenta: entra con su contraseña de siempre.
      </Aviso>
    );
  }
  return <ClaveTemporal nombre={resultado.nombre} clave={resultado.clave} alCerrar={alCerrar} />;
}

function Lista(props: {
  gestiona: boolean;
  nombresDeSedes: ReadonlyMap<string, string>;
  alGenerarClave: (nombre: string, clave: string) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const equipo = useEquipo(pagina);
  if (equipo.error !== null) return <Aviso tono="error">{mensajeDe(equipo.error)}</Aviso>;
  if (equipo.data === undefined) return null;
  return <TablaDeEquipo pagina={equipo.data} alIrA={setPagina} {...props} />;
}

function Encabezado({ conBoton, alSumar }: { conBoton: boolean; alSumar: () => void }) {
  return (
    <div className={estilos.encabezado}>
      <h1 id="titulo-equipo" className={estilos.titulo}>
        Equipo
      </h1>
      {conBoton && <Boton alHacerClic={alSumar}>Sumar persona</Boton>}
    </div>
  );
}

export function Equipo() {
  const [sumando, setSumando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const gestiona = usePermiso("usuarios.gestionar");
  const sedes = useSesion().data?.centroActivo?.sedes ?? [];
  const alTerminarAlta = (nombre: string, alta: AltaHecha) => {
    setSumando(false);
    setResultado({ nombre, clave: alta.claveTemporal });
  };
  return (
    <section className={estilos.equipo} aria-labelledby="titulo-equipo">
      <Encabezado
        conBoton={gestiona && !sumando}
        alSumar={() => {
          setResultado(null);
          setSumando(true);
        }}
      />
      <AvisoDeResultado
        resultado={resultado}
        alCerrar={() => {
          setResultado(null);
        }}
      />
      {sumando && (
        <FormularioDeAlta
          sedes={sedes}
          alTerminar={alTerminarAlta}
          alCancelar={() => {
            setSumando(false);
          }}
        />
      )}
      <Lista
        gestiona={gestiona}
        nombresDeSedes={new Map(sedes.map((sede) => [sede.id, sede.nombre]))}
        alGenerarClave={(nombre, clave) => {
          setResultado({ nombre, clave });
        }}
      />
    </section>
  );
}
