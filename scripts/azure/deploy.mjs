// Run after an approved Terraform apply and Slack Redirect URL registration.
// Secrets are uploaded over SSH, never passed in command arguments or Terraform.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
const root = fileURLToPath(new URL('../../', import.meta.url));
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...options });
const output = JSON.parse(run('terraform', ['-chdir=infra/azure', 'output', '-json'], { encoding: 'utf8', stdio: 'pipe' }));
const domain = output.domain.value, ip = output.public_ip.value, target = output.ssh_target.value;
if (!/^[a-z0-9.-]+\.cloudapp\.azure\.com$/.test(domain) || !/^\d+(\.\d+){3}$/.test(ip) || target !== `waiwaiadmin@${domain}`) throw new Error('Unexpected Terraform outputs.');
const source = parseEnv(await readFile(resolve(root, '.env'), 'utf8'));
for (const key of ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET']) if (!source[key] || /[\r\n]/.test(source[key])) throw new Error(`Set ${key} in local .env.`);
const team = process.env.SLACK_TEAM_ID ?? 'T1MK78MV4';
if (!/^T[A-Z0-9]{8,39}$/.test(team)) throw new Error('Invalid Slack team.');
const temp = await mkdtemp(resolve(tmpdir(), 'waiwai-deploy-'));
const identity = resolve(root, '.local/azure/id_ed25519');
const sshArgs = ['-i', identity, '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${resolve(root, '.local/azure/known_hosts')}`];
const ssh = (command, options = {}) => run('ssh', [...sshArgs, target, command], options);
const release = run('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim() + '-' + Date.now();
let remote;
try {
  run('npm', ['ci']); run('npm', ['run', 'build']);
  const archive = resolve(temp, 'app.tar.gz');
  run('tar', ['-czf', archive, 'dist', 'server', 'src', 'package.json', 'package-lock.json']);
  // Preserve the existing relay secret across releases; generate only on first deploy.
  let secret;
  const existing = ssh('sudo test -f /etc/waiwai/app.env && sudo cat /etc/waiwai/app.env || true', { encoding: 'utf8', stdio: 'pipe' });
  secret = parseEnv(existing).TURN_SHARED_SECRET || randomBytes(48).toString('hex');
  if (!/^[a-f0-9]{96}$/.test(secret)) throw new Error('Unexpected existing TURN secret; handle rotation explicitly.');
  const env = { HOST: '127.0.0.1', PORT: '5173', NODE_ENV: 'production', WAIWAI_DATA_FILE: '/var/lib/waiwai/office-objects.json', REQUIRE_SLACK_LOGIN: 'true', SLACK_TEAM_ID: team,
    SLACK_CLIENT_ID: source.SLACK_CLIENT_ID, SLACK_CLIENT_SECRET: source.SLACK_CLIENT_SECRET,
    SLACK_REDIRECT_URI: `https://${domain}/auth/slack/callback`, TURN_SHARED_SECRET: secret,
    TURN_URLS: `turn:${domain}:3478?transport=udp,turn:${domain}:3478?transport=tcp,turns:${domain}:5349?transport=tcp` };
  const escaped = (value) => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
  await writeFile(resolve(temp, 'app.env'), Object.entries(env).map(([k, v]) => `${k}=${escaped(v)}`).join('\n') + '\n', { mode: 0o600 });
  const turn = `listening-port=3478\ntls-listening-port=5349\nlistening-ip=10.83.1.4\nrelay-ip=10.83.1.4\nexternal-ip=${ip}/10.83.1.4\nrealm=${domain}\nfingerprint\nuse-auth-secret\nstatic-auth-secret=${secret}\nmin-port=49160\nmax-port=49959\ntotal-quota=600\nuser-quota=32\nmax-bps=128000\nbps-capacity=16000000\nno-multicast-peers\nno-rfc5780\nno-stun-backward-compatibility\nno-tcp-relay\nno-cli\nno-dtls\nno-tlsv1\nno-tlsv1_1\ncert=/etc/waiwai-turn/tls.crt\npkey=/etc/waiwai-turn/tls.key\nlog-file=stdout\nsimple-log\nno-stdout-log\n`;
  // coturn 4.6.1 already blocks loopback by default; its official example
  // replaces the obsolete no-loopback-peers flag with an opt-in allow flag.
  // Never enable that flag. Explicit IPv4/IPv6 loopback denials below remain.
  // https://github.com/coturn/coturn/blob/4.6.1/examples/etc/turnserver.conf#L568-L578
  // Block private infrastructure targets; TURN relay peers must be Internet clients.
  const denied = ['0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255', '100.64.0.0-100.127.255.255', '127.0.0.0-127.255.255.255', '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255', '192.168.0.0-192.168.255.255', '224.0.0.0-255.255.255.255', '::1', 'fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'];
  await writeFile(resolve(temp, 'turnserver.conf'), turn + denied.map((range) => `denied-peer-ip=${range}`).join('\n') + '\n', { mode: 0o600 });
  remote = ssh('mktemp -d /tmp/waiwai-deploy-XXXXXXXX', { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (!/^\/tmp\/waiwai-deploy-[A-Za-z0-9]+$/.test(remote)) throw new Error('Invalid remote staging directory.');
  run('scp', [...sshArgs, archive, resolve(temp, 'app.env'), resolve(temp, 'turnserver.conf'), resolve(root, 'scripts/azure/activate-release.sh'), `${target}:${remote}/`]);
  ssh(`sudo bash ${remote}/activate-release.sh ${remote}/app.tar.gz ${release}`);
  const health = await fetch(`https://${domain}/healthz`, { signal: AbortSignal.timeout(10_000) });
  if (!health.ok) throw new Error('External HTTPS health check failed.');
  console.log(`Deployment healthy: https://${domain}`);
  console.log('Next: Slack login, two networks with forced TURN, then the 150-client VM load test.');
} finally {
  if (remote) try { ssh(`rm -rf -- ${remote}`); } catch { /* VM activation also cleans staging. */ }
  await rm(temp, { recursive: true, force: true });
}
