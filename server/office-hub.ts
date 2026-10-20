import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { dirname, join } from 'node:path';
import type { OfficeAuthService } from './auth.ts';
import { attachOffice } from './office.ts';
import { ChatService, readSlackChatConfig } from './chat.ts';
import type { SlackChatConfig } from './chat.ts';
import { WorldPolicyStore } from './world-policy.ts';
import { MemberStore } from './members.ts';
import { SpaceError, SpaceStore } from './spaces.ts';
import type { SpaceAction } from '../src/game/spaces.ts';
import { spaceIdValid } from '../src/game/spaces.ts';
import { userIdentity } from '../src/game/identity.ts';

/** One office simulation and independent stores per logical server, on one host. */
export class OfficeHub {
  readonly registry: SpaceStore;
  private members: MemberStore;
  private runtimes = new Map<string, { server: Server; close: () => void; chat: ChatService }>();
  private checks = new Set<() => void>();
  private env: Record<string, string | undefined>;
  private auth: OfficeAuthService;
  private dev: boolean;
  private dataRoot: string;
  private server: Server;
  private rates = new Map<string, number[]>();
  private slack?: SlackChatConfig;
  constructor(server: Server, auth: OfficeAuthService, env: Record<string, string | undefined>, dev = false) {
    this.server = server; this.auth = auth; this.env = env; this.dev = dev;
    this.slack = readSlackChatConfig(env);
    this.dataRoot = dirname(env.WAIWAI_DATA_FILE ?? '.local/office-objects.json');
    this.members = new MemberStore(env.WAIWAI_MEMBERS_FILE ?? join(this.dataRoot, 'office-members.json'));
    const authority = new WorldPolicyStore(env.WAIWAI_POLICY_FILE ?? join(this.dataRoot, 'office-policy.json'), env.WAIWAI_ADMIN_ACCOUNT_ID);
    this.registry = new SpaceStore(env.WAIWAI_SPACES_FILE ?? join(this.dataRoot, 'office-spaces.json'), authority, this.members.list());
    server.on('upgrade', this.upgrade);
  }
  private guestAllowed(request: IncomingMessage): boolean { return this.dev && this.auth.canJoin(request) && !this.auth.identify(request); }
  private authorized(id: string, request: IncomingMessage): boolean {
    return this.auth.canJoin(request) && this.registry.allowed(id, this.auth.identify(request)?.user, this.guestAllowed(request));
  }
  private runtime(id: string) {
    const existing = this.runtimes.get(id); if (existing) return existing;
    const legacy = id === 'default', root = join(this.dataRoot, 'spaces', id);
    const file = (envKey: string, name: string) => legacy ? this.env[envKey] ?? join(this.dataRoot, name) : join(root, name);
    const memberAllowed = (account: string) => this.registry.assigned(account, id) || this.registry.isAdministrator({ accountId: account, name: '' });
    const chat = new ChatService(file('WAIWAI_CHAT_FILE', 'office-chat.sqlite'), legacy ? this.slack : undefined);
    chat.allowIdentity(account => account.startsWith('guest:') ? this.dev : memberAllowed(account));
    const server = createServer();
    let close: () => void;
    try {
      close = attachOffice(server, this.auth, {
        chat, memberStore: this.members, authorized: request => this.authorized(id, request), administratorCheck: user => this.registry.isAdministrator(user), memberAllowed,
        onAccessChange: check => { this.checks.add(check); return () => this.checks.delete(check); },
        devControls: this.dev, dummyAvatars: this.dev && this.env.WAIWAI_DUMMY_AVATARS !== 'false',
        objectsFile: file('WAIWAI_DATA_FILE', 'office-objects.json'), membersFile: file('WAIWAI_MEMBERS_FILE', 'office-members.json'),
        policyFile: file('WAIWAI_POLICY_FILE', 'office-policy.json'), linksFile: file('WAIWAI_LINKS_FILE', 'office-links.json'),
        birthdaysFile: file('WAIWAI_BIRTHDAYS_FILE', 'office-birthdays.json'), announcementsFile: file('WAIWAI_ANNOUNCEMENTS_FILE', 'office-announcements.json'),
      });
    } catch (error) { chat.close(); throw error; }
    const runtime = { server, close, chat }; this.runtimes.set(id, runtime); return runtime;
  }
  private upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (request.url?.split('?')[0] !== '/office') return;
    const query = new URL(request.url, 'http://localhost').searchParams;
    const id = query.get('space') ?? 'default';
    if (query.getAll('space').length > 1 || !spaceIdValid(id) || !this.authorized(id, request)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    try { this.runtime(id).server.emit('upgrade', request, socket, head); }
    catch { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); }
  };
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = request.url?.split('?')[0];
    // The existing Slack bridge belongs exclusively to the legacy server.
    if (path === '/api/slack/events') return this.runtime('default').chat.handle(request, response);
    if (path !== '/api/spaces') return false;
    const reply = (status: number, data: unknown) => response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(data));
    const identity = this.auth.identify(request), user = identity?.user;
    try {
      if (request.method === 'GET') {
        if (identity && this.auth.canJoin(request)) {
          await this.members.remember(user!);
          await this.registry.pin(user);
        }
        reply(200, this.registry.snapshot(this.auth.canJoin(request) ? user : undefined, this.members.list(), this.guestAllowed(request))); return true;
      }
      if (request.method !== 'POST') { reply(405, { error: 'この操作には対応していません。' }); return true; }
      let sameOrigin = false;
      try { sameOrigin = !!request.headers.origin && new URL(request.headers.origin).host === request.headers.host; } catch { /* Invalid origin. */ }
      if (!sameOrigin || !identity || !this.auth.canJoin(request) || !this.registry.isAdministrator(user)) { reply(403, { error: '管理者だけが変更できます。' }); return true; }
      if (!request.headers['content-type']?.startsWith('application/json')) { reply(415, { error: 'JSONで送信してください。' }); return true; }
      const account = userIdentity(user!), now = Date.now(), recent = (this.rates.get(account) ?? []).filter(t => now - t < 5000);
      if (recent.length >= 20) { reply(429, { error: '少し待ってから操作してください。' }); return true; }
      this.rates.set(account, [...recent, now]);
      let raw = ''; for await (const chunk of request) { raw += chunk; if (Buffer.byteLength(raw) > 32 * 1024) { reply(413, { error: '設定が大きすぎます。' }); return true; } }
      let action: SpaceAction;
      try { action = JSON.parse(raw); } catch { reply(400, { error: '設定を読み取れません。' }); return true; }
      if (!action || typeof action !== 'object' || !Number.isSafeInteger(action.revision)) { reply(400, { error: '最新の設定を読み込んでください。' }); return true; }
      await this.registry.apply(action, user, this.members.list(), () => this.auth.identify(request)?.id === identity.id && this.auth.canJoin(request));
      for (const check of this.checks) check();
      reply(200, this.registry.snapshot(user, this.members.list()));
    } catch (error) { reply(error instanceof SpaceError ? 409 : 503, { error: error instanceof SpaceError ? error.message : '設定を保存できませんでした。時間をおいて試してください。' }); }
    return true;
  }
  close(): void {
    this.server.off('upgrade', this.upgrade);
    for (const runtime of this.runtimes.values()) runtime.close();
    this.runtimes.clear(); this.checks.clear();
  }
}
