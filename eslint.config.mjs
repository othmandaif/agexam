import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Le code serveur ne doit jamais être importé côté client par erreur :
      // les fichiers de src/server importent "server-only".
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/supabase-js"],
              message:
                "Utiliser les clients de src/server/supabase (le navigateur ne parle qu'à notre API).",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Seul le client admin (clé secrète) utilise directement supabase-js.
    files: ["src/server/supabase/admin.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Couche domaine : règles métier pures, sans framework ni accès aux données.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/*",
                "@/features/*",
                "@/components/*",
                "@/app/*",
                "next",
                "next/*",
                "react",
              ],
              message: "src/domain doit rester pur : aucune dépendance au framework ni à la base.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "drizzle/**", "next-env.d.ts"]),
]);
