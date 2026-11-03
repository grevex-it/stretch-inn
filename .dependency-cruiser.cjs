// Dirección de las dependencias entre paquetes, módulos y capas.
// Ver docs/decisiones/0001-monolito-modular-en-monorepo.md y 0003-hexagonal-por-niveles.md.
const TESTS = "(^|/)test/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "sin-ciclos",
      severity: "error",
      comment: "Ningún archivo puede depender de sí mismo a través de otros.",
      from: {},
      to: { circular: true },
    },
    {
      name: "nucleo-sin-dependencias",
      severity: "error",
      comment: "@app/nucleo son tipos puros: no importa nada fuera de sí mismo.",
      from: { path: "^paquetes/nucleo/src/" },
      to: { pathNot: "^paquetes/nucleo/src/" },
    },
    {
      name: "paquetes-no-usan-modulos-ni-apps",
      severity: "error",
      comment: "Los paquetes son la base: no conocen a los módulos ni a las apps.",
      from: { path: "^paquetes/" },
      to: { path: "^(modulos|apps)/" },
    },
    {
      name: "modulos-no-usan-apps",
      severity: "error",
      comment: "Las apps arman los módulos; un módulo no conoce a las apps.",
      from: { path: "^modulos/" },
      to: { path: "^apps/" },
    },
    {
      name: "solo-index-de-otro-modulo",
      severity: "error",
      comment: "Un módulo usa a otro solo por su index.ts.",
      from: { path: "^modulos/([^/]+)/" },
      to: {
        path: "^modulos/[^/]+/",
        pathNot: ["^modulos/$1/", "^modulos/[^/]+/src/index\\.ts$"],
      },
    },
    {
      name: "dominio-puro",
      severity: "error",
      comment:
        "dominio/ solo importa su propio dominio y @app/nucleo: ni base, ni HTTP, ni librerías.",
      from: { path: "^modulos/([^/]+)/src/dominio/", pathNot: TESTS },
      to: { pathNot: ["^modulos/$1/src/dominio/", "^paquetes/nucleo/src/"] },
    },
    {
      name: "aplicacion-sin-adaptadores",
      severity: "error",
      comment: "aplicacion/ declara puertos; no importa infraestructura/ ni http/.",
      from: { path: "^modulos/([^/]+)/src/aplicacion/", pathNot: TESTS },
      to: { path: "^modulos/$1/src/(infraestructura|http)/" },
    },
    {
      name: "sin-codigo-de-tests-en-produccion",
      severity: "error",
      comment: "El código de producción no importa archivos de test.",
      from: { pathNot: TESTS },
      to: { path: TESTS },
    },
  ],
  options: {
    exclude: { path: "(^|/)(node_modules|dist|coverage|\\.turbo)/|^docs/" },
    doNotFollow: { path: "(^|/)node_modules/" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "default"],
      extensions: [".ts", ".tsx", ".js"],
    },
  },
};
