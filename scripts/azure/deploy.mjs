import { buildAuthEnv } from './auth-config.ts';
// Run after an approved Terraform apply and Slack Redirect URL registration.
// Secrets are uploaded over SSH, never passed in command arguments or Terraform.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { deploymentConfig, buildTurnConfig } from './deployment-config.mjs';
import { LinkStore } from '../../server/links.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...options });
const output = JSON.parse(run('terraform', ['-chdir=infra/environments/dev', 'output', '-json'], { encoding: 'utf8', stdio: 'pipe' }));
const { domain, publicIp: ip, privateIp, target } = deploymentConfig(output);
const source = parseEnv(await readFile(resolve(root, '.env'), 'utf8'));
const authEnv = buildAuthEnv(source, domain);
const temp = await mkdtemp(resolve(tmpdir(), 'waiwai-deploy-'));
const identity = resolve(root, '.local/azure/dev/id_ed25519');
const sshArgs = ['-i', identity, '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${resolve(root, '.local/azure/dev/known_hosts')}`];
const ssh = (command, options = {}) => run('ssh', [...sshArgs, target, command], options);
const release = run('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim() + '-' + Date.now();
let remote;
try {
  run('npm', ['ci']); run('npm', ['run', 'build']);
  const archive = resolve(temp, 'app.tar.gz');
  run('tar', ['-czf', archive, 'dist', 'server', 'src', 'scripts/chat', 'package.json', 'package-lock.json']);
  // Preserve the existing relay secret across releases; generate only on first deploy.
  let secret;
  const existing = ssh('sudo test -f /etc/waiwai/app.env && sudo cat /etc/waiwai/app.env || true', { encoding: 'utf8', stdio: 'pipe' });
  secret = parseEnv(existing).TURN_SHARED_SECRET || randomBytes(48).toString('hex');
  if (!/^[a-f0-9]{96}$/.test(secret)) throw new Error('Unexpected existing TURN secret; handle rotation explicitly.');
  const env = { HOST: '127.0.0.1', PORT: '5173', NODE_ENV: 'production', WAIWAI_DATA_FILE: '/var/lib/waiwai/office-objects.json', WAIWAI_MEMBERS_FILE: '/var/lib/waiwai/office-members.json', WAIWAI_LINKS_FILE: '/var/lib/waiwai/office-links.json', WAIWAI_CHAT_FILE: '/var/lib/waiwai/office-chat.sqlite', ...authEnv, TURN_SHARED_SECRET: secret,
    TURN_URLS: `turn:${domain}:3478?transport=udp,turn:${domain}:3478?transport=tcp,turns:${domain}:5349?transport=tcp` };
  const escaped = (value) => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
  await writeFile(resolve(temp, 'app.env'), Object.entries(env).map(([k, v]) => `${k}=${escaped(v)}`).join('\n') + '\n', { mode: 0o600 });
  await writeFile(resolve(temp, 'turnserver.conf'), buildTurnConfig({ domain, publicIp: ip, privateIp, secret }), { mode: 0o600 });
  remote = ssh('mktemp -d /tmp/waiwai-deploy-XXXXXXXX', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (!/^\/tmp\/waiwai-deploy-[A-Za-z0-9]+$/.test(remote)) throw new Error('Invalid remote staging directory.');
  // Copy local favorites once on first deploy; never replace live edits on upgrades.
  const seed = resolve(temp, 'office-links.seed.json');
  const localLinks = new LinkStore(resolve(root, source.WAIWAI_LINKS_FILE || '.local/office-links.json')).list();
  await writeFile(seed, JSON.stringify({ version: 1, ...localLinks }) + '\n', { mode: 0o600 });
  run('scp', [...sshArgs, archive, seed, resolve(temp, 'app.env'), resolve(temp, 'turnserver.conf'), resolve(root, 'scripts/azure/activate-release.sh'), `${target}:${remote}/`]);
  ssh(`sudo bash ${remote}/activate-release.sh ${remote}/app.tar.gz ${release}`);
  const health = await fetch(`https://${domain}/healthz`, { signal: AbortSignal.timeout(10_000) });
  if (!health.ok) throw new Error('External HTTPS health check failed.');
  console.log(`Deployment healthy: https://${domain}`);
  console.log('Next: Slack login, two networks with forced TURN, then the 150-client VM load test.');
} finally {
  if (remote) try { ssh(`rm -rf -- ${remote}`); } catch { /* VM activation also cleans staging. */ }
  await rm(temp, { recursive: true, force: true });
}
