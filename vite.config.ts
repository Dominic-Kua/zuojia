import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron compatibility
  server: {
    port: 5173,
    // Fail instead of drifting to another port — the Electron dev launchers
    // assume Vite answers on exactly this port.
    strictPort: true,
  },
})
