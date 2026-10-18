#!/bin/bash
# Two-phase release: the caller must commit after its external HTTPS check.
set -euo pipefail
mode=prepare
if [ "$1" = commit ] || [ "$1" = rollback ]; then
  mode=$1; release=$2; staging=$3
else
  bundle=$1; release=$2; staging=$(dirname "$bundle")
fi
[[ "$release" =~ ^[a-f0-9]{7,40}-[0-9]+$ ]]
[[ "$staging" =~ ^/tmp/waiwai-deploy-[A-Za-z0-9]+$ ]]
exec 9>/run/lock/waiwai-deploy.lock
flock -x 9
active=/run/waiwai-deploy-active
unit="waiwai-rollback-$release"
target="/opt/waiwai/releases/$release"
stop_timer() { systemctl stop "$unit.timer" 2>/dev/null || true; }
restore() {
  if [ ! -f "$active" ]; then return; fi
  [ "$(cat "$active")" = "$staging" ] || { echo 'Another deployment is active; refusing rollback.' >&2; return 1; }
  previous=$(cat "$staging/previous-target")
  if [ -f "$staging/previous.env" ]; then install -m 0640 -o root -g waiwai "$staging/previous.env" /etc/waiwai/app.env; else rm -f /etc/waiwai/app.env; fi
  if [ -f "$staging/previous.turn" ]; then install -m 0640 -o root -g turnserver "$staging/previous.turn" /etc/waiwai-turn/turnserver.conf; else rm -f /etc/waiwai-turn/turnserver.conf; fi
  if [ -n "$previous" ]; then
    ln -s "$previous" /opt/waiwai/current.rollback
    mv -Tf /opt/waiwai/current.rollback /opt/waiwai/current
    systemctl restart waiwai.service waiwai-turn.service
  else
    systemctl stop waiwai.service waiwai-turn.service
    rm -f /opt/waiwai/current
  fi
  rm -f "$active"
  stop_timer
  rm -rf -- "$staging"
}
if [ "$mode" = rollback ]; then restore; exit; fi
if [ "$mode" = commit ]; then
  [ "$(cat "$active")" = "$staging" ]
  [ "$(readlink /opt/waiwai/current)" = "$target" ]
  [ -f "$staging/prepared" ]
  systemctl is-active --quiet waiwai.service waiwai-turn.service caddy.service
  rm -f "$active"
  stop_timer
  # Keep rollback targets until commit, then retain the three most recent releases.
  previous=$(cat "$staging/previous-target")
  find /opt/waiwai/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d ' ' -f 2- | while read -r old; do
    [ "$old" = "$target" ] || [ "$old" = "$previous" ] || rm -rf -- "$old"
  done
  rm -rf -- "$staging"
  echo 'External HTTPS verified; release committed.'
  exit
fi
[ ! -e "$active" ] || { echo 'Finish or roll back the active deployment first.' >&2; exit 1; }
cloud-init status --wait >/dev/null
# Refuse to write application data to a replacement VM's empty OS filesystem.
mountpoint -q /var/lib/waiwai
readlink /opt/waiwai/current > "$staging/previous-target" || : > "$staging/previous-target"
[ ! -f /etc/waiwai/app.env ] || cp /etc/waiwai/app.env "$staging/previous.env"
[ ! -f /etc/waiwai-turn/turnserver.conf ] || cp /etc/waiwai-turn/turnserver.conf "$staging/previous.turn"
printf '%s\n' "$staging" > "$active"
failed() {
  status=$?
  if [ "$status" -ne 0 ]; then
    trap - EXIT
    restore || { echo 'Automatic rollback failed; preserve staging and recover through SSH.' >&2; exit 2; }
  fi
  exit "$status"
}
trap failed EXIT
# If the SSH client disappears after activation, the VM restores the old release on its own.
systemd-run --quiet --unit="$unit" --on-active=10min /bin/bash "$staging/activate-release.sh" rollback "$release" "$staging"
install -m 0640 -o root -g waiwai "$staging/app.env" /etc/waiwai/app.env
install -d -m 0750 -o root -g turnserver /etc/waiwai-turn
install -m 0640 -o root -g turnserver "$staging/turnserver.conf" /etc/waiwai-turn/turnserver.conf
if [ ! -e /var/lib/waiwai/office-links.json ] && [ -f "$staging/office-links.seed.json" ]; then
  install -m 0600 -o waiwai -g waiwai "$staging/office-links.seed.json" /var/lib/waiwai/office-links.json
fi
install -d -m 0755 "$target"
tar -xzf "$bundle" -C "$target"
cd "$target"
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
if [ "$ready" != true ]; then echo 'Local health check failed; rolling back.' >&2; exit 1; fi
cert_ready=false
for attempt in $(seq 1 30); do
  if /usr/local/sbin/waiwai-sync-turn-cert 2>/dev/null; then cert_ready=true; break; fi
  sleep 2
done
if [ "$cert_ready" != true ]; then echo 'HTTPS certificate not ready; rolling back.' >&2; exit 1; fi
systemctl restart waiwai-turn.service
systemctl is-active --quiet waiwai.service waiwai-turn.service caddy.service
touch "$staging/prepared"
echo 'Release prepared; awaiting external HTTPS verification.'
