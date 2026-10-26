import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler advisory lints — flag legitimate patterns (async
      // MFA resume, scroll-into-view effects, Date.now in a shipped filter).
      // Build + typecheck remain the hard gate.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**"]),
]);

export default config;
