import { AccionDeAlumno } from "../../base/controles/AccionDeAlumno.tsx";
import { FormularioDesplegable, FormularioRemoto } from "../../base/controles/FormularioRemoto.tsx";
import { usePermiso } from "../../base/sesion.ts";

export function ReservarRecuperacion({ fecha }: { fecha: string }) {
  const recuperar = usePermiso("asistencia.recuperar");
  const buscar = usePermiso("personas.ver");
  if (!recuperar || !buscar) return null;
  return (
    <AccionDeAlumno
      ruta={`/asistencia/fechas/${fecha}/recuperaciones`}
      etiqueta="Reservar recuperación"
    />
  );
}

export function AvisoDeAusencia({
  fecha,
  alumnoId,
  avisoId,
}: {
  fecha: string;
  alumnoId: string;
  avisoId: string | null;
}) {
  const permitido = usePermiso("asistencia.avisar");
  if (!permitido) return null;
  const etiqueta = avisoId ? "Anular aviso de ausencia" : "Avisar ausencia";
  return (
    <FormularioDesplegable titulo={etiqueta}>
      <FormularioRemoto
        key={avisoId ?? alumnoId}
        ruta={avisoId ? `/asistencia/avisos/${avisoId}` : `/asistencia/fechas/${fecha}/avisos`}
        metodo={avisoId ? "DELETE" : "POST"}
        etiqueta="Confirmar"
        cuerpo={() => (avisoId ? undefined : { alumnoId })}
      />
    </FormularioDesplegable>
  );
}

export function AnularRecuperacion({ id }: { id: string }) {
  const permitido = usePermiso("asistencia.recuperar");
  if (!permitido) return null;
  return (
    <FormularioDesplegable titulo="Anular recuperación">
      <FormularioRemoto
        ruta={`/asistencia/recuperaciones/${id}`}
        metodo="DELETE"
        etiqueta="Confirmar anulación"
        cuerpo={() => undefined}
      />
    </FormularioDesplegable>
  );
}
