import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { attachOffice } from './office.ts';
import { readAuthConfig, SlackAuth } from './auth.ts';

try { process.loadEnvFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const auth = new SlackAuth(readAuthConfig(process.env));

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  if (request.url === '/healthz' && (request.method === 'GET' || request.method === 'HEAD')) {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(request.method === 'HEAD' ? undefined : 'ok'); return;
  }
  try { if (await auth.handle(request, response)) return; }
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
const closeOffice = attachOffice(server, auth, { objectsFile: process.env.WAIWAI_DATA_FILE ?? '.local/office-objects.json', membersFile: process.env.WAIWAI_MEMBERS_FILE ?? '.local/office-members.json', linksFile: process.env.WAIWAI_LINKS_FILE ?? '.local/office-links.json' });
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`Waiwai: http://${host}:${port}/`));
const close = () => { closeOffice(); auth.close(); server.close(); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
