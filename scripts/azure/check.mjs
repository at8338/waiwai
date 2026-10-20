// Credential-free verification. All init/test state lives in a disposable copy,
// so checking infra never reconfigures the operator's real Azure backend.
import { execFileSync } from 'node:child_process';
import { cp, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--plugin-dir')) throw new Error('Usage: npm run infra:azure:check -- [--plugin-dir <provider-mirror>]');
const pluginDir = args.length ? resolve(args[1]) : null;
const run = (args, cwd = root) => execFileSync('terraform', args, { cwd, stdio: 'inherit', env: { ...process.env, TF_DATA_DIR: resolve(cwd, '.terraform'), TF_IN_AUTOMATION: '1', TF_WORKSPACE: 'default' } });
run(['fmt', '-check', '-recursive', 'infra-azure']);
execFileSync(process.execPath, ['--test', 'scripts/azure/deployment-config.test.mjs', 'scripts/azure/activate-release.test.mjs'], { cwd: root, stdio: 'inherit' });
const temp = await mkdtemp(resolve(tmpdir(), 'waiwai-infra-check-'));
try {
  await cp(resolve(root, 'infra-azure'), resolve(temp, 'infra-azure'), { recursive: true, filter: (path) => {
    const name = basename(path);
    return name !== '.terraform' && name !== 'azure' && !name.endsWith('.tfstate') && !name.includes('.tfstate.') && !name.endsWith('.tfplan') && !name.endsWith('.tfvars') && !name.endsWith('.tfvars.json') && name !== 'backend.hcl';
  } });
  for (const target of ['modules/naming', 'modules/network', 'modules/office-vm', 'modules/terraform-state', 'bootstrap', 'environments/dev']) {
    const cwd = resolve(temp, 'infra-azure', target);
    // Child-module checks use the same reviewed provider lock as the deployable root.
    if (target !== 'modules/naming') await copyFile(resolve(root, 'infra-azure/environments/dev/.terraform.lock.hcl'), resolve(cwd, '.terraform.lock.hcl'));
    console.log(`\nChecking ${target}`);
    run(['init', '-backend=false', '-input=false', '-lockfile=readonly', '-no-color', ...(pluginDir ? [`-plugin-dir=${pluginDir}`] : [])], cwd);
    run(['validate', '-no-color'], cwd);
    run(['test', '-no-color'], cwd);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
