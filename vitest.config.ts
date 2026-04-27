import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Configuration Vitest pour le CRM PEV.
 *
 * - Tests en `src/**\/__tests__/*.test.ts` ou `src/**\/*.test.ts`
 * - Resolve `@/` vers `src/` (alignement avec tsconfig.json)
 * - Environnement Node (logique pure, pas de DOM)
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
