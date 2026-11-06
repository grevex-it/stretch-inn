// Entrar con email y contraseña (0017). Ante cualquier falla, el mensaje que manda la API.
import { useState } from "react";
import { Aviso, mensajeDe } from "../controles/Aviso.tsx";
import { Boton } from "../controles/Boton.tsx";
import { Campo } from "../controles/Campo.tsx";
import { Formulario } from "../controles/Formulario.tsx";
import { useEntrar } from "../sesion.ts";
import { TarjetaDeAcceso } from "./TarjetaDeAcceso.tsx";

export function Login() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const entrar = useEntrar();
  const error = mensajeDe(entrar.error);

  return (
    <TarjetaDeAcceso titulo="Entrá al panel" bajada="Usá el email y la contraseña de tu cuenta.">
      <Formulario
        alEnviar={() => {
          entrar.mutate({ email, clave });
        }}
      >
        <Campo
          etiqueta="Email"
          tipo="email"
          valor={email}
          alCambiar={setEmail}
          autoComplete="username"
        />
        <Campo
          etiqueta="Contraseña"
          tipo="password"
          valor={clave}
          alCambiar={setClave}
          autoComplete="current-password"
        />
        {error !== undefined && <Aviso tono="error">{error}</Aviso>}
        <Boton tipo="submit" deshabilitado={entrar.isPending}>
          {entrar.isPending ? "Entrando…" : "Entrar"}
        </Boton>
      </Formulario>
    </TarjetaDeAcceso>
  );
}
