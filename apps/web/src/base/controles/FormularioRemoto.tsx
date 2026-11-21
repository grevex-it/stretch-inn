import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { enviar } from "../api.ts";
import { Aviso, mensajeDe } from "./Aviso.tsx";
import { Boton } from "./Boton.tsx";
import estilos from "./FormularioRemoto.module.css";

export function FormularioRemoto({
  ruta,
  metodo,
  cuerpo,
  children,
  etiqueta = "Guardar",
  alGuardar,
}: {
  ruta: string;
  metodo: "POST" | "PUT" | "DELETE";
  cuerpo: (datos: FormData) => unknown;
  children?: ReactNode;
  etiqueta?: string;
  /** Después de guardar bien y de volver a consultar los datos. */
  alGuardar?: () => void;
}) {
  const cliente = useQueryClient();
  const guardar = useMutation({
    mutationFn: (datos: FormData) => enviar(metodo, ruta, cuerpo(datos)),
    onSuccess: async () => {
      await cliente.invalidateQueries();
      alGuardar?.();
    },
  });
  return (
    <form
      className={estilos.formulario}
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!guardar.isPending) guardar.mutate(new FormData(evento.currentTarget));
      }}
    >
      {children && <fieldset disabled={guardar.isPending}>{children}</fieldset>}
      {guardar.isError && <Aviso tono="error">{mensajeDe(guardar.error)}</Aviso>}
      {guardar.isSuccess && <Aviso tono="ok">Cambios guardados.</Aviso>}
      <Boton tipo="submit" deshabilitado={guardar.isPending}>
        {etiqueta}
      </Boton>
    </form>
  );
}

export function FormularioDesplegable({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <details className={estilos.desplegable}>
      <summary className={estilos.resumen}>
        {titulo}
        <svg
          className={estilos.icono}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className={estilos.contenido}>{children}</div>
    </details>
  );
}
