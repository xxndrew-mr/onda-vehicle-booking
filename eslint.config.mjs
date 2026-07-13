import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**"]),
  ...nextCoreWebVitals,
]);

export default eslintConfig;
