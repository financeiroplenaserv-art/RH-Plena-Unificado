import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Regra experimental que proíbe setState no corpo do useEffect.
      // Carregar dados assíncronos no useEffect e depois setar o estado é padrão React,
      // por isso desabilitamos para evitar falsos positivos em toda a base.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
