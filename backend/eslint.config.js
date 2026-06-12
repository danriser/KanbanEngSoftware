import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/", "generated/prisma/"]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.ts"], // A trava que obriga a leitura de TypeScript em qualquer pasta
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": "error"
    }
  }
);