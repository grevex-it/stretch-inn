import { AccionDeAlumno } from "../../base/controles/AccionDeAlumno.tsx";
import type { Clase } from "@app/contratos";
import { FormularioDesplegable, FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { CamasDeLaSede } from "./CamasDeLaSede.tsx";
import { EditarClase } from "./EditarClase.tsx";
import { paginaDeClases, paginaDeInscriptos } from "@app/contratos";
import { useId, useState } from "react";
import { ListaRemota, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import estilos from "./Agenda.module.css";

const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function Agenda() {
  const { data } = useSesion();
  const centro = data?.centroActivo;
  const permitido = usePermiso("agenda.ver");
  if (!permitido || !centro) return <p>No tenés acceso a Agenda.</p>;
  const sede = centro.sedeActiva;
  return <AgendaDeSede key={centro.id + sede} sede={sede} sedes={centro.sedes} />;
}

function AgendaDeSede({
  sede,
  sedes,
}: {
  sede: string;
  sedes: readonly { id: string; nombre: string }[];
}) {
  const gestionar = usePermiso("agenda.gestionar");
  const [abierta, abrir] = useState<string>();
  const ruta = sede === "todas" ? "/agenda/clases" : "/agenda/clases?sede=" + sede;
  return (
    <section className={estilos.agenda}>
      <Encabezado sede={sede} gestionar={gestionar} />
      <ListaRemota
        ruta={ruta}
        esquema={paginaDeClases}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(item) => (
              <FichaDeClase
                key={item.id}
                item={item}
                sede={sedes.find((s) => s.id === item.sedeId)?.nombre}
                gestionar={gestionar}
                abierta={abierta === item.id}
                alTocar={() => {
                  abrir((actual) => (actual === item.id ? undefined : item.id));
                }}
              />
            )}
          />
        )}
      />
    </section>
  );
}

/** Los inscriptos de la clase abierta, dentro de su tarjeta y debajo de sus botones. */
function Inscriptos({ clase, id }: { clase: Clase; id: string }) {
  const inscribir = usePermiso("agenda.inscribir");
  const buscar = usePermiso("personas.ver");
  return (
    <section id={id} className={estilos.inscriptos}>
      <h2 className={estilos.subtitulo}>Inscriptos</h2>
      {inscribir && buscar && clase.activa && (
        <AccionDeAlumno
          ruta={`/agenda/clases/${clase.id}/inscriptos`}
          etiqueta="Inscribir alumno"
        />
      )}
      <ListaRemota
        ruta={`/agenda/clases/${clase.id}/inscriptos`}
        esquema={paginaDeInscriptos}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(item) => (
              <li key={item.id} className={estilos.inscripto}>
                {item.nombre} {item.apellido}
                {inscribir && <BajaInscripcion id={item.id} />}
              </li>
            )}
          />
        )}
      />
    </section>
  );
}

function Encabezado({ sede, gestionar }: { sede: string; gestionar: boolean }) {
  return (
    <>
      <h1 className={estilos.titulo}>Agenda</h1>
      {gestionar && sede !== "todas" && (
        <>
          <CamasDeLaSede sede={sede} />
          <FormularioDesplegable titulo="Nueva clase">
            <EditarClase sede={sede} />
          </FormularioDesplegable>
        </>
      )}
    </>
  );
}

/** Una clase: el nombre, debajo el dato (horario, sede, lugares y estado), después «Editar
 * clase» y «Ver inscriptos» en la misma fila y, si está abierta, sus inscriptos. */
function FichaDeClase({
  item,
  sede,
  gestionar,
  abierta,
  alTocar,
}: {
  item: Clase;
  sede: string | undefined;
  gestionar: boolean;
  abierta: boolean;
  alTocar: () => void;
}) {
  const id = useId();
  return (
    <li className={estilos.clase}>
      <strong className={estilos.nombre}>{item.nombre}</strong>
      <p className={estilos.detalle}>
        {dias[item.dia - 1]} · {item.hora} · {item.duracionMinutos} min · {sede}
      </p>
      <p className={estilos.detalle}>
        {item.inscriptos} de {item.cupo} lugares ocupados · {item.activa ? "Activa" : "De baja"}
      </p>
      <div className={estilos.acciones}>
        {gestionar && <Edicion item={item} />}
        <button
          type="button"
          className={estilos.ver}
          aria-expanded={abierta}
          aria-controls={abierta ? id : undefined}
          onClick={alTocar}
        >
          Ver inscriptos
        </button>
      </div>
      {abierta && <Inscriptos clase={item} id={id} />}
    </li>
  );
}

function Edicion({ item }: { item: Clase }) {
  return (
    <FormularioDesplegable titulo="Editar clase">
      <EditarClase clase={item} sede={item.sedeId} />
    </FormularioDesplegable>
  );
}

function BajaInscripcion({ id }: { id: string }) {
  return (
    <FormularioDesplegable titulo="Dar de baja inscripción">
      <FormularioRemoto
        ruta={`/agenda/inscripciones/${id}`}
        metodo="DELETE"
        etiqueta="Confirmar baja"
        cuerpo={() => undefined}
      />
    </FormularioDesplegable>
  );
}
