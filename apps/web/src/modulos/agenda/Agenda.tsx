import { paginaDeClases, paginaDeInscriptos } from "@app/contratos";
import { useState } from "react";
import { ListaRemota, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";

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
  const [clase, elegir] = useState<{ id: string; nombre: string }>();
  const ruta = sede === "todas" ? "/agenda/clases" : "/agenda/clases?sede=" + sede;
  return (
    <section>
      <h1>Agenda</h1>
      <ListaRemota
        ruta={ruta}
        esquema={paginaDeClases}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(item) => (
              <li key={item.id}>
                <strong>{item.nombre}</strong>
                <p>
                  {dias[item.dia - 1]} · {item.hora} · {item.duracionMinutos} min ·{" "}
                  {sedes.find((s) => s.id === item.sedeId)?.nombre}
                </p>
                <p>
                  {item.inscriptos} de {item.cupo} lugares ocupados ·{" "}
                  {item.activa ? "Activa" : "De baja"}
                </p>
                <button
                  type="button"
                  aria-pressed={clase?.id === item.id}
                  onClick={() => {
                    elegir(item);
                  }}
                >
                  Ver inscriptos
                </button>
              </li>
            )}
          />
        )}
      />
      {clase && <Inscriptos clase={clase} />}
    </section>
  );
}

function Inscriptos({ clase }: { clase: { id: string; nombre: string } }) {
  return (
    <section>
      <h2>Inscriptos en {clase.nombre}</h2>
      <ListaRemota
        key={clase.id}
        ruta={`/agenda/clases/${clase.id}/inscriptos`}
        esquema={paginaDeInscriptos}
        mostrar={(datos, alIrA) => (
          <Resultados
            datos={datos}
            alIrA={alIrA}
            fila={(item) => (
              <li key={item.id}>
                {item.nombre} {item.apellido}
              </li>
            )}
          />
        )}
      />
    </section>
  );
}
