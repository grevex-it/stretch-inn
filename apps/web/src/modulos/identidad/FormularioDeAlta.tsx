// Sumar a alguien al equipo: nombre, email, un rol y las sedes donde lo tiene (0017).
import type { AltaHecha } from "@app/contratos";
import { useId, useState } from "react";
import { Aviso, mensajeDe } from "../../base/controles/Aviso.tsx";
import { Boton } from "../../base/controles/Boton.tsx";
import { Campo } from "../../base/controles/Campo.tsx";
import { Formulario } from "../../base/controles/Formulario.tsx";
import { useDarDeAlta, useRoles } from "./consultas.ts";
import estilos from "./FormularioDeAlta.module.css";

interface Props {
  sedes: { id: string; nombre: string }[];
  alTerminar: (nombre: string, alta: AltaHecha) => void;
  alCancelar: () => void;
}

function useFormularioDeAlta() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rolId, setRolId] = useState("");
  const [sedeIds, setSedeIds] = useState<string[]>([]);
  const alternarSede = (sedeId: string) => {
    setSedeIds((actuales) =>
      actuales.includes(sedeId) ? actuales.filter((id) => id !== sedeId) : [...actuales, sedeId],
    );
  };
  return { nombre, setNombre, email, setEmail, rolId, setRolId, sedeIds, alternarSede };
}

function ElegirRol({ valor, alCambiar }: { valor: string; alCambiar: (rolId: string) => void }) {
  const id = useId();
  const roles = useRoles();
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        Rol
      </label>
      <select
        id={id}
        className={estilos.lista}
        value={valor}
        required
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      >
        <option value="">Elegí un rol</option>
        {roles.data?.elementos.map((rol) => (
          <option key={rol.id} value={rol.id}>
            {rol.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

function ElegirSedes(props: {
  sedes: Props["sedes"];
  elegidas: string[];
  alAlternar: (id: string) => void;
}) {
  return (
    <fieldset className={estilos.sedes}>
      <legend className={estilos.etiqueta}>Sedes</legend>
      {props.sedes.map((sede) => (
        <label key={sede.id} className={estilos.opcion}>
          <input
            type="checkbox"
            className={estilos.casilla}
            checked={props.elegidas.includes(sede.id)}
            onChange={() => {
              props.alAlternar(sede.id);
            }}
          />
          {sede.nombre}
        </label>
      ))}
    </fieldset>
  );
}

export function FormularioDeAlta({ sedes, alTerminar, alCancelar }: Props) {
  const titulo = useId();
  const datos = useFormularioDeAlta();
  const alta = useDarDeAlta();
  const enviar = () => {
    const { nombre, email, rolId, sedeIds } = datos;
    alta.mutate(
      { nombre, email, rolId, sedeIds },
      {
        onSuccess: (hecha) => {
          alTerminar(nombre.trim(), hecha);
        },
      },
    );
  };
  const error = mensajeDe(alta.error);
  return (
    <section className={estilos.alta} aria-labelledby={titulo}>
      <h2 id={titulo} className={estilos.titulo}>
        Sumar a alguien al equipo
      </h2>
      <Formulario alEnviar={enviar}>
        <Campo
          etiqueta="Nombre"
          valor={datos.nombre}
          alCambiar={datos.setNombre}
          autoComplete="off"
        />
        <Campo
          etiqueta="Email"
          tipo="email"
          valor={datos.email}
          alCambiar={datos.setEmail}
          autoComplete="off"
        />
        <ElegirRol valor={datos.rolId} alCambiar={datos.setRolId} />
        <ElegirSedes sedes={sedes} elegidas={datos.sedeIds} alAlternar={datos.alternarSede} />
        {error !== undefined && <Aviso tono="error">{error}</Aviso>}
        <div className={estilos.acciones}>
          <Boton tipo="submit" deshabilitado={alta.isPending}>
            Sumar
          </Boton>
          <Boton variante="secundario" alHacerClic={alCancelar}>
            Cancelar
          </Boton>
        </div>
      </Formulario>
    </section>
  );
}
