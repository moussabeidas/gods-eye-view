import { defineConfig } from 'vite';
import './server/env.js';
import { handleApi } from './server/api.js';

// Mounts the API on the dev server so `npm run dev` runs the full platform.
const api = {
  name: 'investment-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? handleApi(req, res) : next()));
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? handleApi(req, res) : next()));
  },
};

export default defineConfig({
  plugins: [api],
  server: { port: 5173, fs: { deny: ['.env', '.env.*'] } },
  build: { chunkSizeWarningLimit: 1600 },
});
