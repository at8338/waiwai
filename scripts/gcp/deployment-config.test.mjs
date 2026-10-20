import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig, runtimeEnv, buildTurnConfig } from './deployment-config.mjs';

const project = 'waiwai-dev-example';
const values = { cloud: 'gcp', environment: 'dev', project_id: project, identity_project_id: project, domain: 'office.example.com', public_ip: '203.0.113.10', private_ip: '10.84.1.10', vm_name: 'dev-waiwai-tky-vm-office-001', zone: 'asia-northeast1-a', release_bucket: 'dev-waiwai-tky-gcs-release-001-1234abcd', identity_origin: 'https://office.example.com', identity_api_key: 'a'.repeat(39) };
const outputs = v => Object.fromEntries(Object.entries(v).map(([key, value]) => [key, { value }]));
test('GCP deployment refuses wrong projects, endpoints and non-dev output', () => {
  assert.equal(deploymentConfig(outputs(values), project).privateIp, '10.84.1.10');
  for (const patch of [{ project_id: 'another-project' }, { cloud: 'azure' }, { environment: 'production' }, { domain: 'office.example.com\nno-auth' }, { public_ip: 'bad' }, { release_bucket: 'state-bucket' }, { identity_origin: 'https://other.example.com' }]) assert.throws(() => deploymentConfig(outputs({ ...values, ...patch }), project));
});
test('GCP release requires immutable administrator UID, invite project and mandatory MFA auth mode', () => {
  const c = deploymentConfig(outputs(values), project), invitation = { projectId: project, uid: 'admin-uid', accountId: `gcip:${project}:admin-uid` };
  const env = runtimeEnv(c, invitation, 'a'.repeat(96));
  assert.equal(env.REQUIRE_IDENTITY_PLATFORM_LOGIN, 'true'); assert.equal(env.REQUIRE_SLACK_LOGIN, 'false'); assert.equal(env.REQUIRE_ENTRA_LOGIN, 'false'); assert.equal(env.WAIWAI_ADMIN_ACCOUNT_ID, invitation.accountId);
  for (const patch of [{ projectId: 'other-project' }, { accountId: 'tt-asahara@example.com' }, { uid: '' }]) assert.throws(() => runtimeEnv(c, { ...invitation, ...patch }, 'a'.repeat(96)));
  assert.throws(() => runtimeEnv(c, invitation, 'short'));
});
test('GCP TURN binds actual NIC and refuses anonymous relay or private targets', () => {
  const c = deploymentConfig(outputs(values), project), turn = buildTurnConfig(c, 'a'.repeat(96));
  assert.ok(turn.includes('external-ip=203.0.113.10/10.84.1.10\n')); assert.ok(turn.includes('use-auth-secret\n')); assert.ok(turn.includes('denied-peer-ip=169.254.0.0-169.254.255.255')); assert.ok(turn.includes('min-port=49160\nmax-port=49959\n')); assert.ok(!turn.includes('no-auth'));
  assert.throws(() => buildTurnConfig({ ...c, domain: 'office.example.com\nno-auth' }, 'a'.repeat(96)));
});
