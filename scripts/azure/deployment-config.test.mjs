import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig, buildTurnConfig } from './deployment-config.mjs';
const domain = 'dev-waiwai-test.japaneast.cloudapp.azure.com';
const config = { environment: 'dev', vm_name: 'dev-waiwai-jpe-vm-office-001', resource_group: 'dev-waiwai-jpe-rg-office-001', domain, public_ip: '203.0.113.10', private_ip: '10.84.1.4', ssh_target: `waiwaiadmin@${domain}` };
const outputs = (values) => Object.fromEntries(Object.entries(values).map(([k,v]) => [k, { value: v }]));
test('dev outputs preserve the configurable private NIC address used by TURN', () => {
  const result = deploymentConfig(outputs(config));
  const turn = buildTurnConfig({ ...result, secret: 'a'.repeat(96) });
  assert.ok(turn.includes('listening-ip=10.84.1.4\n') && turn.includes('relay-ip=10.84.1.4\n') && turn.includes('external-ip=203.0.113.10/10.84.1.4\n'));
  assert.ok(!turn.includes('10.83.1.4'));
  assert.ok(turn.includes('min-port=49160\nmax-port=49959\n') && turn.includes('denied-peer-ip=169.254.0.0-169.254.255.255'));
});
test('deployment refuses retired production outputs, missing IPs and unexpected SSH targets', () => {
  for (const changes of [{ environment: 'production' }, { private_ip: undefined }, { ssh_target: 'root@other.example.com' }, { public_ip: '999.1.1.1' }, { vm_name: 'prd-waiwai-vm' }]) assert.throws(() => deploymentConfig(outputs({ ...config, ...changes })));
});
test('TURN rendering refuses multiline injection and malformed secrets', () => {
  const values = { domain, publicIp: config.public_ip, privateIp: config.private_ip, secret: 'a'.repeat(96) };
  for (const changes of [{ domain: `${domain}\nno-auth` }, { privateIp: '10.84.1.4\nno-auth' }, { secret: 'short' }]) assert.throws(() => buildTurnConfig({ ...values, ...changes }));
});

test('MFA preflight accepts only enabled, unconditional all-user MFA for the deployed app', async () => {
  const { verifyMfaPolicy } = await import('./deployment-config.mjs');
  const valid = { state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: [], excludeGroups: [], excludeRoles: [] }, applications: { includeApplications: ['app'], excludeApplications: [] }, clientAppTypes: ['all'], signInRiskLevels: [] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } };
  assert.doesNotThrow(() => verifyMfaPolicy(valid, 'app'));
  for (const mutate of [p => p.state = 'enabledForReportingButNotEnforced', p => p.conditions.users.excludeUsers.push('someone'), p => p.conditions.applications.includeApplications = ['other'], p => p.conditions.locations = { includeLocations: ['AllTrusted'] }, p => p.grantControls.builtInControls.push('compliantDevice'), p => p.grantControls.termsOfUse = ['some-terms'], p => p.grantControls.authenticationStrength = { id: 'some-strength' }, p => p.conditions.users.includeUsers = ['one-user'], p => p.conditions.clientAppTypes = ['browser']]) {
    const p = structuredClone(valid); mutate(p); assert.throws(() => verifyMfaPolicy(p, 'app'));
  }
});
test('Azure refuses Slack-only deployment and missing MFA policy reference', async () => {
  const { buildAuthEnv } = await import('./auth-config.ts');
  assert.throws(() => buildAuthEnv({ SLACK_CLIENT_ID: '123', SLACK_CLIENT_SECRET: 'fixture' }, domain), /Entra/);
  assert.throws(() => buildAuthEnv({ ENTRA_TENANT_ID: '11111111-1111-1111-1111-111111111111' }, domain), /MFA_POLICY/);
});
