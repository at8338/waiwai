import { isIPv4 } from 'node:net';

export function deploymentConfig(output) {
  const get = (key) => output?.[key]?.value;
  const domain = get('domain'), publicIp = get('public_ip'), privateIp = get('private_ip'), target = get('ssh_target');
  if (get('environment') !== 'dev' || !/^dev-[a-z0-9-]+$/.test(get('vm_name') ?? '') || !/^dev-[a-z0-9-]+$/.test(get('resource_group') ?? '')) throw new Error('Deployment requires dev Terraform outputs.');
  if (typeof domain !== 'string' || !/^[a-z0-9.-]+\.japaneast\.cloudapp\.azure\.com$/.test(domain) || !isIPv4(publicIp ?? '') || !isIPv4(privateIp ?? '') || target !== `waiwaiadmin@${domain}`) throw new Error('Unexpected Terraform endpoint outputs.');
  return { domain, publicIp, privateIp, target };
}

export function buildTurnConfig({ domain, publicIp, privateIp, secret }) {
  if (typeof domain !== 'string' || !/^[a-z0-9.-]+\.japaneast\.cloudapp\.azure\.com$/.test(domain) || !isIPv4(publicIp ?? '') || !isIPv4(privateIp ?? '') || !/^[a-f0-9]{96}$/.test(secret ?? '')) throw new Error('Invalid TURN configuration.');
  const turn = `listening-port=3478\ntls-listening-port=5349\nlistening-ip=${privateIp}\nrelay-ip=${privateIp}\nexternal-ip=${publicIp}/${privateIp}\nrealm=${domain}\nfingerprint\nuse-auth-secret\nstatic-auth-secret=${secret}\nmin-port=49160\nmax-port=49959\ntotal-quota=600\nuser-quota=32\nmax-bps=128000\nbps-capacity=16000000\nno-multicast-peers\nno-rfc5780\nno-stun-backward-compatibility\nno-tcp-relay\nno-cli\nno-dtls\nno-tlsv1\nno-tlsv1_1\ncert=/etc/waiwai-turn/tls.crt\npkey=/etc/waiwai-turn/tls.key\nlog-file=stdout\nsimple-log\nno-stdout-log\n`;
  // coturn 4.6.1 already blocks loopback by default; its official example
  // replaces the obsolete no-loopback-peers flag with an opt-in allow flag.
  // Never enable that flag. Explicit IPv4/IPv6 loopback denials below remain.
  // https://github.com/coturn/coturn/blob/4.6.1/examples/etc/turnserver.conf#L568-L578
  // Block private infrastructure targets; TURN relay peers must be Internet clients.
  const denied = ['0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255', '100.64.0.0-100.127.255.255', '127.0.0.0-127.255.255.255', '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255', '192.168.0.0-192.168.255.255', '224.0.0.0-255.255.255.255', '::1', 'fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'];
  return turn + denied.map((range) => `denied-peer-ip=${range}`).join('\n') + '\n';
}
