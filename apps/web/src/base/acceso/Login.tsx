// Entrar con email y contraseña (0017). Ante cualquier falla, el mensaje que manda la API.
import logo from "@app/ui/assets/logo-crema.png";
import { useState } from "react";
import { Aviso, mensajeDe } from "../controles/Aviso.tsx";
import { Boton } from "../controles/Boton.tsx";
import { Campo } from "../controles/Campo.tsx";
import { Formulario } from "../controles/Formulario.tsx";
import { useEntrar } from "../sesion.ts";
import estilos from "./Login.module.css";

export function Login() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const entrar = useEntrar();
  const error = mensajeDe(entrar.error);

  return (
    <main className={estilos.login}>
      <div className={estilos.marca}>
        <img src={logo} alt="Stretch Inn · Bienestar postural" />
      </div>
      <div className={estilos.acceso}>
        <section className={estilos.tarjeta} aria-labelledby="titulo-acceso">
          <header>
            <h1 id="titulo-acceso">Bienvenido de nuevo</h1>
            <p>Ingresá al panel de tu centro.</p>
          </header>
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
            <CampoDeClave clave={clave} setClave={setClave} />
            {error !== undefined && <Aviso tono="error">{error}</Aviso>}
            <Boton tipo="submit" deshabilitado={entrar.isPending}>
              {entrar.isPending ? "Entrando…" : "Entrar"}
            </Boton>
          </Formulario>
          <p className={estilos.ayuda}>
            <strong>¿Olvidaste tu contraseña?</strong>
            Pedile a quien administra tu centro que la restablezca.
          </p>
        </section>
        <footer>
          Desarrollado por <strong>GREVEX</strong>
        </footer>
      </div>
    </main>
  );
}

function CampoDeClave({ clave, setClave }: { clave: string; setClave: (clave: string) => void }) {
  const [claveVisible, setClaveVisible] = useState(false);
  return (
    <div className={estilos.clave}>
      <Campo
        etiqueta="Contraseña"
        tipo={claveVisible ? "text" : "password"}
        valor={clave}
        alCambiar={setClave}
        autoComplete="current-password"
      />
      <button
        type="button"
        aria-label="Mostrar contraseña"
        aria-pressed={claveVisible}
        onClick={() => {
          setClaveVisible(!claveVisible);
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          {claveVisible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
}
