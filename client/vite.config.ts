import path from 'path';
import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const customLogger = createLogger();
const originalLoggerError = customLogger.error;

customLogger.error = (msg, options) => {
  // Suppress harmless proxy socket reset errors during backend reboots or client disconnects
  if (
    (typeof msg === 'string' && (msg.includes('ECONNRESET') || msg.includes('ws proxy error') || msg.includes('ECONNREFUSED'))) ||
    options?.error?.message?.includes('ECONNRESET') ||
    (options?.error as unknown as { code?: string })?.code === 'ECONNRESET'
  ) {
    return;
  }
  originalLoggerError(msg, options);
};

// https://vite.dev/config/
export default defineConfig({
  customLogger,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const code = (err as unknown as { code?: string })?.code;
            if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
              return;
            }
          });
        },
      },
    },
  },
});
