// Local preparation only. Does not create Azure resources or select a subscription.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = resolve(root, '.local/azure');
const [subscription, cidr, email] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/i.test(subscription ?? '') || !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr ?? '') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) {
  throw new Error('Usage: node scripts/azure/prepare.mjs <company-subscription-id> <operator-ip/32> <operations-email>');
}
const account = JSON.parse(execFileSync('az', ['account', 'show', '--subscription', subscription, '--output', 'json'], { encoding: 'utf8' }));
if (account.state !== 'Enabled') throw new Error('Subscription is not enabled.');
await mkdir(dir, { recursive: true, mode: 0o700 });
const key = resolve(dir, 'id_ed25519');
try { await access(key); } catch {
  execFileSync('ssh-keygen', ['-t', 'ed25519', '-f', key, '-N', '', '-C', 'waiwai-azure-deploy'], { stdio: 'inherit' });
}
const publicKey = (await readFile(key + '.pub', 'utf8')).trim();
const vars = { subscription_id: account.id, location: 'japaneast', name: 'waiwai', vm_size: 'Standard_B2als_v2', ssh_public_key: publicKey, admin_cidr: cidr, acme_email: email };
await writeFile(resolve(dir, 'terraform.tfvars.json'), JSON.stringify(vars, null, 2) + '\n', { mode: 0o600 });
await writeFile(resolve(dir, 'bootstrap.tfvars.json'), JSON.stringify({ subscription_id: account.id, location: vars.location }, null, 2) + '\n', { mode: 0o600 });
console.log('Prepared local SSH key and Terraform variables. No Azure resources were created.');
