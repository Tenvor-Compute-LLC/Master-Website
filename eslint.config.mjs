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
    // vendored minified port of the live Swarm Build component (see the file header)
    "lib/swarm-build.js",
  ]),
  {
    // plain <img> keeps the Swarm Build engine's IMG detection working
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
