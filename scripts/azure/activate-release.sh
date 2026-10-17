#!/bin/bash
# Runs on the VM as root. No secret values in arguments, logs, or shell traces.
set -euo pipefail
bundle=$1
release=$2
[[ "$release" =~ ^[a-f0-9]{7,40}-[0-9]+$ ]]
staging=$(dirname "$bundle")
committed=false
previous=$(readlink /opt/waiwai/current || true)
rollback() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$committed" != true ]; then
    if [ -f "$staging/previous.env" ]; then install -m 0640 -o root -g waiwai "$staging/previous.env" /etc/waiwai/app.env; fi
    if [ -f "$staging/previous.turn" ]; then install -m 0640 -o root -g turnserver "$staging/previous.turn" /etc/waiwai-turn/turnserver.conf; fi
    if [ -n "$previous" ]; then
      ln -s "$previous" /opt/waiwai/current.rollback
      mv -Tf /opt/waiwai/current.rollback /opt/waiwai/current
      systemctl restart waiwai.service waiwai-turn.service || true
    fi
  fi
  rm -rf -- "$staging"
  exit "$status"
}
trap rollback EXIT
cloud-init status --wait >/dev/null
[ ! -f /etc/waiwai/app.env ] || cp /etc/waiwai/app.env "$staging/previous.env"
[ ! -f /etc/waiwai-turn/turnserver.conf ] || cp /etc/waiwai-turn/turnserver.conf "$staging/previous.turn"
install -m 0640 -o root -g waiwai "$staging/app.env" /etc/waiwai/app.env
install -d -m 0750 -o root -g turnserver /etc/waiwai-turn
install -m 0640 -o root -g turnserver "$staging/turnserver.conf" /etc/waiwai-turn/turnserver.conf
install -d -m 0750 -o waiwai -g waiwai /var/lib/waiwai
if [ ! -e /var/lib/waiwai/office-links.json ] && [ -f "$staging/office-links.seed.json" ]; then
  install -m 0600 -o waiwai -g waiwai "$staging/office-links.seed.json" /var/lib/waiwai/office-links.json
fi
target="/opt/waiwai/releases/$release"
install -d -m 0755 "$target"
tar -xzf "$bundle" -C "$target"
cd "$target"
# Lockfile controls dependencies. No lifecycle scripts run during server install.
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:waiwai "$target"
chmod -R o-rwx "$target"
ln -s "$target" /opt/waiwai/current.next
mv -Tf /opt/waiwai/current.next /opt/waiwai/current
systemctl restart waiwai.service
ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:5173/healthz >/dev/null; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Release failed health check; rolling back code and configuration.' >&2; exit 1; fi
# Caddy may still be obtaining its initial certificate. Never start TURN without TLS.
cert_ready=false
for attempt in $(seq 1 30); do
  if /usr/local/sbin/waiwai-sync-turn-cert 2>/dev/null; then cert_ready=true; break; fi
  sleep 2
done
if [ "$cert_ready" != true ]; then echo 'HTTPS certificate not ready; check Caddy and retry deployment.' >&2; exit 1; fi
systemctl restart waiwai-turn.service
systemctl is-active --quiet waiwai.service waiwai-turn.service caddy.service
committed=true
# Retain three releases; secrets are in /etc, not these directories.
find /opt/waiwai/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d ' ' -f 2- | while read -r old; do
  [ "$old" = "$target" ] || [ "$old" = "$previous" ] || rm -rf -- "$old"
done
echo 'Waiwai application, HTTPS and TURN services are active.'
