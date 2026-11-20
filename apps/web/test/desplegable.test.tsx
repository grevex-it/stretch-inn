// FormularioDesplegable: el título se lee tal cual (el ícono es decorativo) y el contenido
// aparece al abrirlo.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormularioDesplegable } from "../src/base/controles/FormularioRemoto.tsx";

afterEach(() => {
  cleanup();
});

describe("FormularioDesplegable", () => {
  it("el título se lee solo, sin el ícono, y al tocarlo muestra el contenido", async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <FormularioDesplegable titulo="Nuevo plan">
        <p>Contenido del formulario</p>
      </FormularioDesplegable>,
    );
    const resumen = container.querySelector("summary");
    expect(resumen?.textContent).toBe("Nuevo plan");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("details")?.open).toBe(false);

    await usuario.click(screen.getByText("Nuevo plan"));

    expect(container.querySelector("details")?.open).toBe(true);
    expect(screen.getByText("Contenido del formulario")).toBeDefined();
  });
});
