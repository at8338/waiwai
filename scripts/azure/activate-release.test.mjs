import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readlink, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const original = await readFile(new URL('./activate-release.sh', import.meta.url), 'utf8');
async function fixture(t, first = false) {
  const root = await mkdtemp(join(tmpdir(), 'waiwai-release-test-')), staging = await mkdtemp('/tmp/waiwai-deploy-');
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(staging, { recursive: true, force: true })]));
  for (const dir of ['bin', 'run/lock', 'opt/waiwai/releases/old', 'etc/waiwai', 'etc/waiwai-turn', 'var/lib/waiwai']) await mkdir(join(root, dir), { recursive: true });
  const script = original.replaceAll('/run/', `${root}/run/`).replaceAll('/opt/waiwai', `${root}/opt/waiwai`).replaceAll('/etc/waiwai', `${root}/etc/waiwai`).replaceAll('/var/lib/waiwai', `${root}/var/lib/waiwai`).replaceAll('/usr/local/sbin/waiwai-sync-turn-cert', `${root}/bin/cert`);
  await writeFile(join(staging, 'activate-release.sh'), script);
  for (const command of ['flock', 'cloud-init', 'systemd-run', 'npm', 'chown', 'sleep', 'cert', 'find']) await writeFile(join(root, 'bin', command), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/mountpoint'), '#!/bin/bash\nexit "${FAIL_MOUNT:-0}"\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/curl'), '#!/bin/bash\nexit "${FAIL_HEALTH:-0}"\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/systemctl'), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$TEST_LOG"\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/mv'), '#!/usr/bin/env node\nconst fs = require("node:fs"); fs.renameSync(process.argv.at(-2), process.argv.at(-1));\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/install'), '#!/bin/bash\nargs=()\nwhile [ "$#" -gt 0 ]; do\ncase "$1" in -o|-g) shift 2 ;; *) args+=("$1"); shift ;; esac\ndone\nexec /usr/bin/install "${args[@]}"\n', { mode: 0o755 });
  if (!first) {
    await symlink(join(root, 'opt/waiwai/releases/old'), join(root, 'opt/waiwai/current'));
    await writeFile(join(root, 'etc/waiwai/app.env'), 'old-app'); await writeFile(join(root, 'etc/waiwai-turn/turnserver.conf'), 'old-turn');
  }
  await writeFile(join(staging, 'app.env'), 'new-app'); await writeFile(join(staging, 'turnserver.conf'), 'new-turn');
  await writeFile(join(staging, 'package.json'), '{}');
  execFileSync('tar', ['-czf', join(staging, 'app.tar.gz'), '-C', staging, 'package.json']);
  const release = 'abcdef123456-1234';
  const run = (mode = 'prepare', env = {}) => execFileSync('bash', [join(staging, 'activate-release.sh'), ...(mode === 'prepare' ? [join(staging, 'app.tar.gz'), release] : [mode, release, staging])], { env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, TEST_LOG: join(root, 'systemctl.log'), ...env }, encoding: 'utf8', stdio: 'pipe' });
  return { root, staging, release, run };
}
test('external failure rolls back prepared code and both configs; successful external check can commit', async t => {
  const f = await fixture(t); f.run();
  assert.equal(await readlink(join(f.root, 'opt/waiwai/current')), join(f.root, `opt/waiwai/releases/${f.release}`));
  await access(join(f.staging, 'previous.env')); await access(join(f.root, 'run/waiwai-deploy-active'));
  f.run('rollback'); assert.match(await readlink(join(f.root, 'opt/waiwai/current')), /releases\/old$/);
  assert.equal(await readFile(join(f.root, 'etc/waiwai/app.env'), 'utf8'), 'old-app'); assert.equal(await readFile(join(f.root, 'etc/waiwai-turn/turnserver.conf'), 'utf8'), 'old-turn');
  const committed = await fixture(t); committed.run(); committed.run('commit');
  assert.match(await readlink(join(committed.root, 'opt/waiwai/current')), new RegExp(committed.release));
  await assert.rejects(access(committed.staging)); await assert.rejects(access(join(committed.root, 'run/waiwai-deploy-active')));
});
test('failed first deployment removes new configs and stops services; an unmounted data disk blocks activation', async t => {
  const first = await fixture(t, true); assert.throws(() => first.run('prepare', { FAIL_HEALTH: '1' }));
  await assert.rejects(access(join(first.root, 'etc/waiwai/app.env'))); await assert.rejects(access(join(first.root, 'opt/waiwai/current')));
  assert.match(await readFile(join(first.root, 'systemctl.log'), 'utf8'), /stop waiwai.service waiwai-turn.service/);
  const unmounted = await fixture(t); assert.throws(() => unmounted.run('prepare', { FAIL_MOUNT: '1' }));
  assert.equal(await readFile(join(unmounted.root, 'etc/waiwai/app.env'), 'utf8'), 'old-app');
});
