// Uso: pnpm db:semilla. Crea el centro de prueba para desarrollo local (lee el .env).
// Nunca contra producción: aborta si NODE_ENV es production.
import { sembrar } from "./semilla.ts";

const urlDueno = process.env["DATABASE_URL_MIGRACIONES"];
if (urlDueno === undefined) {
  console.error("Falta DATABASE_URL_MIGRACIONES. Copiá .env.example a .env.");
  process.exit(1);
}
if (process.env["NODE_ENV"] === "production") {
  console.error("La semilla es solo para desarrollo local.");
  process.exit(1);
}

const cuenta = {
  email: process.env["SEMILLA_EMAIL"] ?? "admin@prueba.local",
  clave: process.env["SEMILLA_CLAVE"] ?? "clave de prueba local",
};
const { creado } = await sembrar(urlDueno, cuenta);
console.log(
  creado
    ? `Centro de prueba creado. Entrá con ${cuenta.email} / ${cuenta.clave}`
    : `La cuenta ${cuenta.email} ya existía: no se cambió nada.`,
);
