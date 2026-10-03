import { defineConfig, globalIgnores } from 'eslint/config'
import next from 'eslint-config-next'

const eslintConfig = defineConfig([
  ...next,
  globalIgnores(['node_modules/**', '.next/**', 'out/**', 'coverage/**', '.data/**']),
  {
    rules: {
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
])

export default eslintConfig
