import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 5 — sin plugin de Tailwind (v3 usa PostCSS directamente)
export default defineConfig({
  plugins: [react()],
})
