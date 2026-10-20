import { isIPv4 } from 'node:net';

export function deploymentConfig(output, projectId) {
  const get = key => output?.[key]?.value;
  const domain = get('domain'), publicIp = get('public_ip'), privateIp = get('private_ip');
  const vm = get('vm_name'), zone = get('zone'), bucket = get('release_bucket');
  if (get('cloud') !== 'gcp' || get('environment') !== 'dev' || get('project_id') !== projectId || get('identity_project_id') !== projectId) throw new Error('Expected GCP dev project outputs.');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain ?? '') || !isIPv4(publicIp ?? '') || !isIPv4(privateIp ?? '') || !/^dev-[a-z0-9-]+$/.test(vm ?? '') || !/^asia-northeast1-[a-c]$/.test(zone ?? '') || !/^dev-[a-z0-9-]+-gcs-release-[0-9]{3}-[a-f0-9]{8}$/.test(bucket ?? '')) throw new Error('Invalid deployment endpoints.');
  if (get('identity_origin') !== `https://${domain}` || !/^[A-Za-z0-9_-]{20,200}$/.test(get('identity_api_key') ?? '')) throw new Error('Missing deployed Identity Platform configuration.');
  return { domain, publicIp, privateIp, vm, zone, bucket, projectId, apiKey: get('identity_api_key') };
}

export function runtimeEnv(config, invitation, secret) {
  if (invitation.projectId !== config.projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(invitation.uid ?? '') || invitation.accountId !== `gcip:${config.projectId}:${invitation.uid}` || !/^[a-f0-9]{96}$/.test(secret ?? '')) throw new Error('Invalid immutable administrator identity or TURN secret.');
  return {
    HOST: '127.0.0.1', PORT: '5173', NODE_ENV: 'production',
    WAIWAI_DATA_FILE: '/var/lib/waiwai/office-objects.json',
    WAIWAI_MEMBERS_FILE: '/var/lib/waiwai/office-members.json',
    WAIWAI_LINKS_FILE: '/var/lib/waiwai/office-links.json',
    WAIWAI_CHAT_FILE: '/var/lib/waiwai/office-chat.sqlite',
    WAIWAI_PERSONAL_FILE: '/var/lib/waiwai/office-personal.sqlite',
    REQUIRE_IDENTITY_PLATFORM_LOGIN: 'true', REQUIRE_ENTRA_LOGIN: 'false', REQUIRE_SLACK_LOGIN: 'false',
    GCIP_PROJECT_ID: config.projectId, GCIP_API_KEY: config.apiKey, GCIP_ORIGIN: `https://${config.domain}`,
    WAIWAI_ADMIN_ACCOUNT_ID: invitation.accountId, SLACK_CHAT_ENABLED: 'false',
    TURN_SHARED_SECRET: secret,
    TURN_URLS: `turn:${config.domain}:3478?transport=udp,turn:${config.domain}:3478?transport=tcp,turns:${config.domain}:5349?transport=tcp`,
  };
}

export function buildTurnConfig({ domain, publicIp, privateIp }, secret) {
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain ?? '') || !isIPv4(publicIp ?? '') || !isIPv4(privateIp ?? '') || !/^[a-f0-9]{96}$/.test(secret ?? '')) throw new Error('Invalid TURN configuration.');
  const denied = ['0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255', '100.64.0.0-100.127.255.255', '127.0.0.0-127.255.255.255', '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255', '192.168.0.0-192.168.255.255', '224.0.0.0-255.255.255.255', '::1', 'fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'];
  return `listening-port=3478\ntls-listening-port=5349\nlistening-ip=${privateIp}\nrelay-ip=${privateIp}\nexternal-ip=${publicIp}/${privateIp}\nrealm=${domain}\nfingerprint\nuse-auth-secret\nstatic-auth-secret=${secret}\nmin-port=49160\nmax-port=49959\ntotal-quota=600\nuser-quota=32\nmax-bps=128000\nbps-capacity=16000000\nno-multicast-peers\nno-rfc5780\nno-stun-backward-compatibility\nno-tcp-relay\nno-cli\nno-dtls\nno-tlsv1\nno-tlsv1_1\ncert=/etc/waiwai-turn/tls.crt\npkey=/etc/waiwai-turn/tls.key\nlog-file=stdout\nsimple-log\nno-stdout-log\n` + denied.map(range => `denied-peer-ip=${range}`).join('\n') + '\n';
}
