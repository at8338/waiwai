// Run only for an approved deployment. Never loads the development .env file.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { deploymentConfig, runtimeEnv, buildTurnConfig } from './deployment-config.mjs';

process.umask(0o077);
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--project' || args[2] !== '--account' || args[4] !== '--invitation') throw new Error('Usage: node scripts/gcp/deploy.mjs --project PROJECT --account OPERATOR_EMAIL --invitation PRIVATE_INVITATION_FILE');
const [project, account, invitationFile] = [args[1], args[3], resolve(args[5])];
const gcloud = process.env.WAIWAI_GCLOUD || 'gcloud';
const run = (cmd, argv, options = {}) => execFileSync(cmd, argv, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024, ...options });
const gc = argv => run(gcloud, [...argv, '--project=' + project, '--configuration=waiwai-dev', '--quiet']);
if (run(gcloud, ['config', 'get', 'core/account', '--configuration=waiwai-dev']).trim() !== account || run(gcloud, ['config', 'get', 'core/project', '--configuration=waiwai-dev']).trim() !== project) throw new Error('gcloud operator/project mismatch.');
const config = deploymentConfig(JSON.parse(run('terraform', ['-chdir=infra-gcp/environments/dev', 'output', '-json'])), project);
if ((await stat(invitationFile)).mode & 0o077) throw new Error('Invitation file must be private.');
const invitation = JSON.parse(await readFile(invitationFile, 'utf8'));
const base = resolve(root, '.local/gcp/dev');
await mkdir(base, { recursive: true, mode: 0o700 });
const secretPath = resolve(base, 'turn-secret');
let secret;
try { secret = (await readFile(secretPath, 'utf8')).trim(); }
catch (error) { if (error.code !== 'ENOENT') throw error; secret = randomBytes(48).toString('hex'); await writeFile(secretPath, secret + '\n', { mode: 0o600, flag: 'wx' }); }
const env = runtimeEnv(config, invitation, secret);
const release = run('git', ['rev-parse', '--short=12', 'HEAD']).trim() + '-' + Date.now();
const work = resolve(base, 'deploy-' + release);
await mkdir(work, { mode: 0o700 });
const vmArgs = ['--zone=' + config.zone];
const describe = () => JSON.parse(gc(['compute', 'instances', 'describe', config.vm, ...vmArgs, '--format=json']));
const vm = describe();
if (vm.status !== 'RUNNING' || vm.metadata.items.some(item => ['startup-script', 'startup-script-url', 'waiwai-deploy-commit'].includes(item.key))) throw new Error('VM is not ready or an existing deployment/startup script needs review.');
if (!vm.metadata.items.some(item => item.key === 'enable-oslogin' && item.value === 'TRUE') || !vm.metadata.items.some(item => item.key === 'enable-oslogin-2fa' && item.value === 'TRUE')) throw new Error('OS Login and 2FA must remain enabled.');
const escaped = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
await writeFile(resolve(work, 'app.env'), Object.entries(env).map(([key, value]) => `${key}=${escaped(value)}`).join('\n') + '\n', { mode: 0o600 });
await writeFile(resolve(work, 'turnserver.conf'), buildTurnConfig(config, secret), { mode: 0o600 });
await writeFile(resolve(work, 'activate-release.sh'), await readFile(resolve(root, 'scripts/gcp/activate-release.sh')), { mode: 0o600 });
// Build before invoking this script; record the exact bundle checksum. Never
// include .env, .local, node_modules, Git state or operator credentials.
run('tar', ['--no-xattrs', '-czf', resolve(work, 'app.tar.gz'), 'dist', 'server', 'src', 'scripts/chat', 'package.json', 'package-lock.json'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
run('tar', ['--no-xattrs', '-czf', resolve(work, 'deployment.tar.gz'), '-C', work, 'app.tar.gz', 'app.env', 'turnserver.conf', 'activate-release.sh'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
const object = `releases/${release}/deployment.tar.gz`;
const sha256 = createHash('sha256').update(await readFile(resolve(work, 'deployment.tar.gz'))).digest('hex');
const manifest = { bucket: config.bucket, object, release, sha256 };
const loader = await readFile(resolve(root, 'scripts/gcp/startup-deploy.py'), 'utf8');
const startup = '#!/bin/bash\nset -euo pipefail\nexec /usr/bin/python3 -u - <<\'WAIWAI_PYTHON\'\n' + loader + '\ndeploy(' + JSON.stringify(manifest) + ')\nWAIWAI_PYTHON\n';
await writeFile(resolve(work, 'startup.sh'), startup, { mode: 0o600 });
gc(['storage', 'cp', resolve(work, 'deployment.tar.gz'), `gs://${config.bucket}/${object}`]);
let metadataSet = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const serial = () => gc(['compute', 'instances', 'get-serial-port-output', config.vm, ...vmArgs, '--port=1']);
try {
  gc(['compute', 'instances', 'add-metadata', config.vm, ...vmArgs, '--metadata-from-file=startup-script=' + resolve(work, 'startup.sh')]); metadataSet = true;
  gc(['compute', 'instances', 'reset', config.vm, ...vmArgs]);
  console.log('Private release uploaded; VM restarted for deployment: ' + release);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    await sleep(3000);
    try {
      const r = await fetch(`https://${config.domain}/healthz`, { signal: AbortSignal.timeout(5000) });
      if (r.ok && (await r.text()).trim() === 'ok') { ready = true; break; }
    } catch { /* VM is rebooting or app dependencies are still being installed. */ }
    if (attempt % 10 === 9 && serial().includes('WAIWAI_DEPLOY_FAILED ' + release)) throw new Error('VM rejected deployment. Inspect private serial log.');
  }
  if (!ready) throw new Error('External HTTPS health did not become ready.');
  let prepared = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const log = serial();
    if (log.includes('WAIWAI_DEPLOY_PREPARED ' + release)) { prepared = true; break; }
    if (log.includes('WAIWAI_DEPLOY_FAILED ' + release)) throw new Error('VM preparation failed.');
    await sleep(2000);
  }
  if (!prepared) throw new Error('The exact new release has not finished preparation.');
  const json = async path => { const r = await fetch(`https://${config.domain}${path}`, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('Endpoint unavailable: ' + path); return r.json(); };
  const session = await json('/api/auth/session');
  if (session.required !== true || session.identityPlatform !== true || session.user !== null || session.loginUrl !== null || session.microsoftLoginUrl !== null) throw new Error('Mandatory authentication gate failed.');
  const login = await json('/api/auth/identity/config');
  if (login.projectId !== project || login.apiKey !== config.apiKey) throw new Error('Identity configuration mismatch.');
  const spaces = await json('/api/spaces');
  if (spaces.administrator || spaces.spaces.length) throw new Error('Anonymous space access was granted.');
  for (const path of ['/auth/slack', '/auth/microsoft']) if ((await fetch(`https://${config.domain}${path}`, { signal: AbortSignal.timeout(10000) })).status !== 403) throw new Error('Legacy login bypass detected.');
  const home = await fetch(`https://${config.domain}/`, { signal: AbortSignal.timeout(10000) });
  if (!home.ok || !(await home.text()).includes('type="module"')) throw new Error('Built application entry is missing.');
  gc(['compute', 'instances', 'add-metadata', config.vm, ...vmArgs, '--metadata=waiwai-deploy-commit=' + release]);
  let committed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(2000); const log = serial(); await writeFile(resolve(work, 'serial.log'), log, { mode: 0o600 });
    if (log.includes('WAIWAI_DEPLOY_COMMITTED ' + release)) { committed = true; break; }
    if (log.includes('WAIWAI_DEPLOY_FAILED ' + release)) throw new Error('VM rejected release commit.');
  }
  if (!committed) throw new Error('Release commit could not be confirmed.');
  const status = { release, project, account, url: `https://${config.domain}`, administratorAccountId: invitation.accountId, externalHealth: true, mandatoryIdentityAuth: true, anonymousAccessDenied: true, committed: true, at: new Date().toISOString() };
  await writeFile(resolve(work, 'result.json'), JSON.stringify(status, null, 2) + '\n', { mode: 0o600 });
  await writeFile(resolve(base, 'deployment-status.json'), JSON.stringify(status, null, 2) + '\n', { mode: 0o600 });
  console.log('Deployment committed; HTTPS and required Identity Platform login verified.');
} catch (error) {
  try { await writeFile(resolve(work, 'serial.log'), serial(), { mode: 0o600 }); } catch { /* Preserve the primary error. */ }
  throw new Error('Deployment did not complete. No secrets were printed; inspect private deployment logs and allow the VM rollback timer to finish.', { cause: error });
} finally {
  // Metadata is a temporary command channel, not the source of runtime secrets.
  if (metadataSet) gc(['compute', 'instances', 'remove-metadata', config.vm, ...vmArgs, '--keys=startup-script,waiwai-deploy-commit']);
}
