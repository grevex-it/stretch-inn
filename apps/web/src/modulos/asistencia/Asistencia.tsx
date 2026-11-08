import { AnularRecuperacion, AvisoDeAusencia, ReservarRecuperacion } from "./AccionesDeFecha.tsx";
import { MarcarAsistencia } from "./MarcarAsistencia.tsx";
import { paginaDeOcurrencias, planillaDeAsistencia } from "@app/contratos";
import { useState } from "react";
import { fechaLocal, ListaRemota, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";

export function Asistencia() {
  const { data } = useSesion();
  const centro = data?.centroActivo;
  const puedeVer = usePermiso("asistencia.ver");
  const puedeVerAgenda = usePermiso("agenda.ver");
  return (
    <section>
      <h1>Asistencia</h1>
      {puedeVer && puedeVerAgenda && centro ? (
        centro.sedeActiva === "todas" ? (
          <p>Elegí una sede en la barra para ver sus clases.</p>
        ) : (
          <Fechas
            key={centro.id + centro.sedeActiva}
            sede={centro.sedeActiva}
            zona={centro.zonaHoraria}
          />
        )
      ) : (
        <p>Necesitás acceso a Asistencia y Agenda para consultar las planillas.</p>
      )}
    </section>
  );
}

function horaLocal(instante: string, zona: string) {
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
  });
  return hora.format(new Date(instante));
}

function Fechas({ sede, zona }: { sede: string; zona: string }) {
  const [desde, cambiarFecha] = useState(() => fechaLocal(zona));
  const [fecha, elegir] = useState<string>();
  const ruta = `/agenda/ocurrencias?sede=${sede}&desde=${desde}`;
  return (
    <>
      <label>
        Semana desde{" "}
        <input
          type="date"
          value={desde}
          onChange={(evento) => {
            cambiarFecha(evento.target.value);
            elegir(undefined);
          }}
        />
      </label>
      {desde && (
        <ListaRemota
          key={ruta}
          ruta={ruta}
          esquema={paginaDeOcurrencias}
          mostrar={(datos, alIrA) => (
            <Resultados
              datos={datos}
              alIrA={alIrA}
              fila={(item) => (
                <li key={item.id}>
                  <strong>{item.nombre}</strong> · {item.fecha} · {horaLocal(item.empiezaEn, zona)}
                  {item.cancelada && " · Cancelada"}{" "}
                  <button
                    type="button"
                    aria-pressed={fecha === item.id}
                    onClick={() => {
                      elegir(item.id);
                    }}
                  >
                    Ver planilla
                  </button>
                </li>
              )}
            />
          )}
        />
      )}
      {fecha && <Planilla key={fecha} fecha={fecha} />}
    </>
  );
}

function Planilla({ fecha }: { fecha: string }) {
  return (
    <ListaRemota
      ruta={`/asistencia/fechas/${fecha}`}
      esquema={planillaDeAsistencia}
      mostrar={(datos, alIrA) => (
        <>
          <h2>
            {datos.fecha.nombre} · {datos.fecha.fecha}
          </h2>
          <p>Lugares para recuperar: {datos.lugares}</p>
          {!datos.fecha.cancelada && datos.lugares > 0 && <ReservarRecuperacion fecha={fecha} />}
          <Resultados
            datos={{
              ...datos.alumnos,
              elementos: [...datos.alumnos.elementos, ...datos.recuperan.elementos],
              total: Math.max(datos.alumnos.total, datos.recuperan.total),
            }}
            alIrA={alIrA}
            fila={(item) => (
              <li key={item.recuperacionId ?? item.alumnoId}>
                {item.nombre} {item.apellido} · {item.estado ?? "Sin marcar"}
                {item.avisoId && " · Avisó ausencia"}
                {item.recuperacionId && <AnularRecuperacion id={item.recuperacionId} />}
                {!datos.fecha.cancelada && (
                  <AvisoDeAusencia fecha={fecha} alumnoId={item.alumnoId} avisoId={item.avisoId} />
                )}
                {!datos.fecha.cancelada && (
                  <MarcarAsistencia fecha={fecha} alumnoId={item.alumnoId} estado={item.estado} />
                )}
              </li>
            )}
          />
        </>
      )}
    />
  );
}
