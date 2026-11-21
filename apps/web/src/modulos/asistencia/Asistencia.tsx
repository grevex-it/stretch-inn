import { AnularRecuperacion, AvisoDeAusencia, ReservarRecuperacion } from "./AccionesDeFecha.tsx";
import { MarcarAsistencia } from "./MarcarAsistencia.tsx";
import { ReglasDeLaSede } from "./ReglasDeLaSede.tsx";
import {
  paginaDeOcurrencias,
  planillaDeAsistencia,
  type PaginaDeOcurrencias,
  type PlanillaDeAsistencia,
} from "@app/contratos";
import { Fragment, useState } from "react";
import { Campo } from "../../base/controles/Campo.tsx";
import { fechaLocal, ListaRemota, Resultados } from "../../base/controles/ListaRemota.tsx";
import { usePermiso, useSesion } from "../../base/sesion.ts";
import estilos from "./Asistencia.module.css";

export function Asistencia() {
  const { data } = useSesion();
  const centro = data?.centroActivo;
  const puedeVer = usePermiso("asistencia.ver");
  const puedeVerAgenda = usePermiso("agenda.ver");
  return (
    <section className={estilos.asistencia}>
      <h1 className={estilos.titulo}>Asistencia</h1>
      {puedeVer && puedeVerAgenda && centro ? (
        centro.sedeActiva === "todas" ? (
          <p>Elegí una sede en la barra para ver sus clases.</p>
        ) : (
          // Una sola clave para las dos: cambiar de centro o de sede las vuelve a armar juntas.
          <Fragment key={centro.id + centro.sedeActiva}>
            <ReglasDeLaSede sede={centro.sedeActiva} />
            <Fechas sede={centro.sedeActiva} zona={centro.zonaHoraria} />
          </Fragment>
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
      <div className={estilos.semana}>
        <Campo
          etiqueta="Semana desde"
          tipo="date"
          valor={desde}
          alCambiar={(valor) => {
            cambiarFecha(valor);
            elegir(undefined);
          }}
        />
      </div>
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
                <FichaDeFecha
                  key={item.id}
                  item={item}
                  zona={zona}
                  elegida={fecha === item.id}
                  alElegir={elegir}
                />
              )}
            />
          )}
        />
      )}
      {fecha && <Planilla key={fecha} fecha={fecha} />}
    </>
  );
}

type Ocurrencia = PaginaDeOcurrencias["elementos"][number];

/** Una fecha: el nombre, debajo el día y la hora y, al final, «Ver planilla». */
function FichaDeFecha({
  item,
  zona,
  elegida,
  alElegir,
}: {
  item: Ocurrencia;
  zona: string;
  elegida: boolean;
  alElegir: (id: string) => void;
}) {
  return (
    <li className={estilos.fecha}>
      <strong className={estilos.nombre}>{item.nombre}</strong>
      <p className={estilos.detalle}>
        {item.fecha} · {horaLocal(item.empiezaEn, zona)}
        {item.cancelada && " · Cancelada"}
      </p>
      <button
        type="button"
        className={estilos.ver}
        aria-pressed={elegida}
        onClick={() => {
          alElegir(item.id);
        }}
      >
        Ver planilla
      </button>
    </li>
  );
}

function Planilla({ fecha }: { fecha: string }) {
  return (
    <section className={estilos.planilla}>
      <ListaRemota
        ruta={`/asistencia/fechas/${fecha}`}
        esquema={planillaDeAsistencia}
        mostrar={(datos, alIrA) => (
          <>
            <h2 className={estilos.subtitulo}>
              {datos.fecha.nombre} · {datos.fecha.fecha}
            </h2>
            <p className={estilos.detalle}>Lugares para recuperar: {datos.lugares}</p>
            {!datos.fecha.cancelada && datos.lugares > 0 && <ReservarRecuperacion fecha={fecha} />}
            <Resultados
              datos={{
                ...datos.alumnos,
                elementos: [...datos.alumnos.elementos, ...datos.recuperan.elementos],
                total: Math.max(datos.alumnos.total, datos.recuperan.total),
              }}
              alIrA={alIrA}
              fila={(item) => (
                <Alumno
                  key={item.recuperacionId ?? item.alumnoId}
                  item={item}
                  fecha={fecha}
                  cancelada={datos.fecha.cancelada}
                />
              )}
            />
          </>
        )}
      />
    </section>
  );
}

type Renglon = PlanillaDeAsistencia["alumnos"]["elementos"][number];

/** Un alumno de la planilla: el dato arriba y, debajo, sus acciones en una fila. */
function Alumno({ item, fecha, cancelada }: { item: Renglon; fecha: string; cancelada: boolean }) {
  return (
    <li className={estilos.alumno}>
      <p className={estilos.detalle}>
        <strong className={estilos.nombre}>
          {item.nombre} {item.apellido}
        </strong>{" "}
        · {item.estado ?? "Sin marcar"}
        {item.avisoId && " · Avisó ausencia"}
      </p>
      <div className={estilos.acciones}>
        {item.recuperacionId && <AnularRecuperacion id={item.recuperacionId} />}
        {!cancelada && (
          <AvisoDeAusencia fecha={fecha} alumnoId={item.alumnoId} avisoId={item.avisoId} />
        )}
        {!cancelada && (
          <MarcarAsistencia fecha={fecha} alumnoId={item.alumnoId} estado={item.estado} />
        )}
      </div>
    </li>
  );
}
