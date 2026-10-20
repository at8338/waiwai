// Run by a human administrator with ADC; never run from the app VM identity.
import { readFile, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { prepareIdentityInvitation } from '../../server/identity-invites.ts';
import type { InvitationInput } from '../../server/identity-invites.ts';

const args = process.argv.slice(2);
if (args.length !== 8 || args[0] !== '--project' || args[2] !== '--origin' || args[4] !== '--input' || args[6] !== '--output') throw new Error('Usage: node scripts/gcp/invite.ts --project PROJECT_ID --origin https://HOST --input .local/invite.json --output .local/invitation.json');
const [project, origin, inputPath, outputPath] = [args[1], args[3], resolve(args[5]), resolve(args[7])];
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || new URL(origin).origin !== origin || !origin.startsWith('https://') || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Invalid project/origin or emulator configured');
const input = JSON.parse(await readFile(inputPath, 'utf8')) as InvitationInput;
// Reserve the destination before changing cloud users; never overwrite an invitation.
const output = await open(outputPath, 'wx', 0o600);
const app = initializeApp({ projectId: project, credential: applicationDefault() }, 'waiwai-invite');
try {
  const result = await prepareIdentityInvitation(getAuth(app), input, origin);
  await output.writeFile(JSON.stringify({ projectId: project, accountId: `gcip:${project}:${result.uid}`, ...result }, null, 2) + '\n');
  console.log('Completed. Result/action links saved in the private output file. No email sent.');
} catch {
  console.error('Provisioning did not complete. Check the user in the selected Identity Platform project before retrying; partial creation is possible. No credentials or action links were printed.'); process.exitCode = 1;
} finally { await output.close(); await deleteApp(app); }
