import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // .tsx too — component and hook specs render JSX.
    include: ['tests/int/**/*.int.spec.ts?(x)', 'tests/unit/**/*.spec.ts?(x)'],
  },
})
