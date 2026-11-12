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
}: {
  ruta: string;
  metodo: "POST" | "PUT" | "DELETE";
  cuerpo: (datos: FormData) => unknown;
  children?: ReactNode;
  etiqueta?: string;
}) {
  const cliente = useQueryClient();
  const guardar = useMutation({
    mutationFn: (datos: FormData) => enviar(metodo, ruta, cuerpo(datos)),
    onSuccess: async () => {
      await cliente.invalidateQueries();
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
    <details>
      <summary>{titulo}</summary>
      {children}
    </details>
  );
}
