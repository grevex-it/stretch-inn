import { describe, expect, it } from "vitest";
import { falla, ok } from "../src/index.ts";

describe("resultado", () => {
  it("distingue éxito de falla por el campo ok", () => {
    expect(ok(3)).toEqual({ ok: true, valor: 3 });
    expect(falla("sin-cupo")).toEqual({ ok: false, error: "sin-cupo" });
  });
});
