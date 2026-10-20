// Validate only disposable copies with mocked Google APIs, never a live backend.
import { execFileSync } from 'node:child_process';
import { cp, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--plugin-dir')) throw new Error('Usage: npm run infra:gcp:check -- [--plugin-dir <provider-mirror>]');
const pluginDir = args.length ? resolve(args[1]) : null;
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('TF_CLI_ARGS') && !['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CREDENTIALS', 'GOOGLE_ACCESS_TOKEN', 'GOOGLE_BACKEND_CREDENTIALS', 'GOOGLE_BACKEND_ACCESS_TOKEN'].includes(key)));
const run = (args, cwd = root) => execFileSync('terraform', args, { cwd, stdio: 'inherit', env: { ...cleanEnv, TF_DATA_DIR: resolve(cwd, '.terraform'), TF_IN_AUTOMATION: '1', TF_WORKSPACE: 'default' } });
run(['fmt', '-check', '-recursive', 'infra-gcp']);
execFileSync('bash', ['-n', 'scripts/gcp/setup-mac.sh'], { cwd: root, stdio: 'inherit' });
const temp = await mkdtemp(resolve(tmpdir(), 'waiwai-gcp-check-'));
try {
  await cp(resolve(root, 'infra-gcp'), resolve(temp, 'infra-gcp'), { recursive: true, filter: path => {
    const name = basename(path);
    return name !== '.terraform' && !name.endsWith('.tfstate') && !name.includes('.tfstate.') && !name.endsWith('.tfplan') && !name.endsWith('.tfvars') && !name.endsWith('.tfvars.json') && name !== 'backend.hcl';
  } });
  for (const target of ['modules/naming', 'modules/network', 'modules/office-vm', 'modules/terraform-state', 'bootstrap', 'bootstrap-dns', 'environments/dev']) {
    const cwd = resolve(temp, 'infra-gcp', target);
    if (target !== 'modules/naming') await copyFile(resolve(root, 'infra-gcp/environments/dev/.terraform.lock.hcl'), resolve(cwd, '.terraform.lock.hcl'));
    console.log(`\nChecking GCP ${target}`);
    run(['init', '-backend=false', '-input=false', '-lockfile=readonly', '-no-color', ...(pluginDir ? [`-plugin-dir=${pluginDir}`] : [])], cwd);
    run(['validate', '-no-color'], cwd);
    run(['test', '-no-color'], cwd);
  }
} finally { await rm(temp, { recursive: true, force: true }); }
