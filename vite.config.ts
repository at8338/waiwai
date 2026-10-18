import { PersonalService } from './server/personal-data.ts';
import { ChatService, readSlackChatConfig } from './server/chat.ts';
import { dirname, join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import type { Server } from 'node:http';
import { attachOffice } from './server/office.ts';
import { readAuthConfig, readEntraConfig, OfficeAuth } from './server/auth.ts';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const config = readAuthConfig(env);
  const entraConfig = readEntraConfig(env);
  return {
    server: { allowedHosts: [...new Set([config, entraConfig].filter(Boolean).map(c => new URL(c!.redirectUri).hostname))] },
    plugins: [{
      name: 'waiwai-office',
      configureServer(server) {
        const auth = new OfficeAuth(config, entraConfig);
        const chat = new ChatService(env.WAIWAI_CHAT_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-chat.sqlite'), readSlackChatConfig(env));
        const personal = new PersonalService(auth, env.WAIWAI_PERSONAL_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-personal.sqlite'));
        server.middlewares.use((request, response, next) => {
          void personal.handle(request, response).then(handled => handled || chat.handle(request, response)).then(handled => handled || auth.handle(request, response)).then((handled) => { if (!handled) next(); })
            .catch(() => { response.writeHead(500).end('Authentication unavailable'); });
        });
        if (server.httpServer) {
          const close = attachOffice(server.httpServer as Server, auth, { chat, policyFile: env.WAIWAI_POLICY_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-policy.json'), administratorId: env.WAIWAI_ADMIN_ACCOUNT_ID, devControls: mode !== 'production', dummyAvatars: mode !== 'production' && env.WAIWAI_DUMMY_AVATARS !== 'false', objectsFile: env.WAIWAI_DATA_FILE ?? '.local/office-objects.json', membersFile: env.WAIWAI_MEMBERS_FILE ?? '.local/office-members.json', linksFile: env.WAIWAI_LINKS_FILE ?? '.local/office-links.json', birthdaysFile: env.WAIWAI_BIRTHDAYS_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-birthdays.json'), announcementsFile: env.WAIWAI_ANNOUNCEMENTS_FILE ?? join(dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-announcements.json') });
          server.httpServer.once('close', () => { close(); personal.store.close(); auth.close(); });
        }
      },
    }],
  };
});
