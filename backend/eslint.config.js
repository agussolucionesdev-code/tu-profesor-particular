import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["coverage"] },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        sourceType: "module",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // `varsIgnorePattern` viene de frontend/ y web/: mismo criterio en los
      // tres proyectos. `argsIgnorePattern` es propio del backend: Express
      // detecta los manejadores de error por la aridad de la función, así que
      // el cuarto parámetro tiene que existir aunque no se use. `_next` marca
      // esa intención sin apagar la regla.
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
      ],
    },
  },
];
