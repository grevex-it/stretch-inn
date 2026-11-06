// Reglas de código para todo el repo. Ver docs/decisiones/0004-stack.md.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const TESTS_SALTEADOS =
  "CallExpression[callee.object.name=/^(it|test|describe)$/][callee.property.name=/^(skip|only|todo)$/]";

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "db/migraciones/"] },
  {
    // Ningún comentario puede apagar una regla: si molesta, se discute (regla 9 del AGENTS.md).
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: true }],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "no-restricted-syntax": [
        "error",
        { selector: TESTS_SALTEADOS, message: "No se saltean ni se aíslan tests." },
      ],
    },
  },
  {
    // Las funciones de los tests (describe) agrupan casos y pueden ser largas.
    files: ["**/test/**/*.{ts,tsx}"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    files: ["apps/web/**/*.tsx", "apps/portal/**/*.tsx"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.js"],
    languageOptions: { globals: globals.node },
  },
);
