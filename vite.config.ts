import { defineConfig } from 'vite';
import type { Server } from 'node:http';
import { attachOffice } from './server/office.ts';

export default defineConfig({
  plugins: [{
    name: 'waiwai-office',
    configureServer(server) {
      if (server.httpServer) {
        const close = attachOffice(server.httpServer as Server);
        server.httpServer.once('close', close);
      }
    },
  }],
});
