import { PersonalService } from './personal-data.ts';
import { OfficeHub } from './office-hub.ts';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { readAuthConfig, readEntraConfig, OfficeAuth } from './auth.ts';
import { IdentityPlatformAuth, readIdentityPlatformConfig } from './identity-platform.ts';

try { process.loadEnvFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const identityConfig = readIdentityPlatformConfig(process.env);
const auth = new OfficeAuth(readAuthConfig(process.env), readEntraConfig(process.env), identityConfig ? new IdentityPlatformAuth(identityConfig) : undefined);

const personal = new PersonalService(auth, process.env.WAIWAI_PERSONAL_FILE ?? join(dirname(process.env.WAIWAI_DATA_FILE ?? '.local/office-objects.json'), 'office-personal.sqlite'));
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  if (request.url === '/healthz' && (request.method === 'GET' || request.method === 'HEAD')) {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(request.method === 'HEAD' ? undefined : 'ok'); return;
  }
  try { if (await personal.handle(request, response)) return; if (await hub.handle(request, response)) return; if (await auth.handle(request, response)) return; }
  catch { response.writeHead(500).end('Authentication unavailable'); return; }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404).end('Not found'); }
});
const hub = new OfficeHub(server, auth, process.env);
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`Waiwai: http://${host}:${port}/`));
const close = () => { hub.close(); personal.store.close(); auth.close(); server.close(); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
