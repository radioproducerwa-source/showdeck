import { defineConfig } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The codebase leans on `any` for Supabase rows; tightening this is a
      // follow-up project, not a lint gate.
      '@typescript-eslint/no-explicit-any': 'off',
      // Literal apostrophes/quotes in JSX copy are fine — React escapes them.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**'],
  },
])
