import { PersonalService } from './server/personal-data.ts';
import { OfficeHub } from './server/office-hub.ts';
import { dirname, join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import type { Server } from 'node:http';
import { readAuthConfig, readEntraConfig, OfficeAuth } from './server/auth.ts';
import { IdentityPlatformAuth, readIdentityPlatformConfig } from './server/identity-platform.ts';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const config = readAuthConfig(env);
  const entraConfig = readEntraConfig(env);
  const identityConfig = readIdentityPlatformConfig(env);
  return {
    server: { allowedHosts: [...new Set([...([config, entraConfig].filter(Boolean).map(c => new URL(c!.redirectUri).hostname)), ...(identityConfig ? [new URL(identityConfig.origin).hostname] : [])])] },
    plugins: [{
      name: 'waiwai-office',
      configureServer(server) {
        const auth = new OfficeAuth(config, entraConfig, identityConfig ? new IdentityPlatformAuth(identityConfig) : undefined);
        const hub = new OfficeHub(server.httpServer as Server, auth, env, mode !== 'production');
        const personal = new PersonalService(auth, env.WAIWAI_PERSONAL_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-personal.sqlite'));
        server.middlewares.use((request, response, next) => {
          void personal.handle(request, response).then(handled => handled || hub.handle(request, response)).then(handled => handled || auth.handle(request, response)).then((handled) => { if (!handled) next(); })
            .catch(() => { response.writeHead(500).end('Authentication unavailable'); });
        });
        if (server.httpServer) {
          server.httpServer.once('close', () => { hub.close(); personal.store.close(); auth.close(); });
        }
      },
    }],
  };
});
