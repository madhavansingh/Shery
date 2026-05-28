import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeUrl(value) {
  const normalized = (value || '').trim().replace(/\/+$/, '');

  if (!normalized) return '';
  if (/\.railway\.internal(?::\d+)?(?:\/|$)/i.test(normalized)) return '';
  if (/^\/\//.test(normalized)) return `https:${normalized}`;
  if (/^\//.test(normalized)) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(normalized)) {
    return `http://${normalized}`;
  }

  return `https://${normalized}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = normalizeUrl(env.VITE_API_BASE_URL);

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: apiBaseUrl
        ? {
            '/api': {
              target: apiBaseUrl,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          },
        },
      },
    },
  };
});
