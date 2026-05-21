import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Usa o runtime clássico JSX em vez de babel transform,
      // eliminando o uso de eval pelo react-refresh no dev
      babel: {
        plugins: [],
      },
    }),
  ],
  build: {
    target: 'es2020',
  },
})
