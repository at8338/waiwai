import { dirname, join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import type { Server } from 'node:http';
import { attachOffice } from './server/office.ts';
import { readAuthConfig, SlackAuth } from './server/auth.ts';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const config = readAuthConfig(env);
  return {
    server: { allowedHosts: config ? [new URL(config.redirectUri).hostname] : [] },
    plugins: [{
      name: 'waiwai-office',
      configureServer(server) {
        const auth = new SlackAuth(config);
        server.middlewares.use((request, response, next) => {
          void auth.handle(request, response).then((handled) => { if (!handled) next(); })
            .catch(() => { response.writeHead(500).end('Authentication unavailable'); });
        });
        if (server.httpServer) {
          const close = attachOffice(server.httpServer as Server, auth, { devControls: mode !== 'production', objectsFile: env.WAIWAI_DATA_FILE ?? '.local/office-objects.json', membersFile: env.WAIWAI_MEMBERS_FILE ?? '.local/office-members.json', linksFile: env.WAIWAI_LINKS_FILE ?? '.local/office-links.json', birthdaysFile: env.WAIWAI_BIRTHDAYS_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-birthdays.json'), announcementsFile: env.WAIWAI_ANNOUNCEMENTS_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-announcements.json') });
          server.httpServer.once('close', () => { close(); auth.close(); });
        }
      },
    }],
  };
});
