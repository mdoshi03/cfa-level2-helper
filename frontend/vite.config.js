import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/cfa-level2-helper/',
  plugins: [react()],
})
