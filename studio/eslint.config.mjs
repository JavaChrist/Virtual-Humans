import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Supabase CLI cache / secrets — never lint or commit
    "supabase/.temp/**",
  ]),
  {
    rules: {
      // Cette règle (eslint-config-next 16) interdit tout setState synchrone dans un
      // useEffect. Or on s'en sert volontairement pour des synchronisations légitimes :
      // chargement de données, réinitialisation d'état quand le personnage/lieu change,
      // clamp de valeurs selon le modèle, timer d'attente. On la garde en avertissement
      // (visible) plutôt qu'en erreur (qui bloque le build Vercel).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
