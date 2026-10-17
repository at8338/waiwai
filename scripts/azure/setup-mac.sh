#!/bin/bash
# User-scoped, official Microsoft tarball. Does not require Homebrew or sudo.
set -euo pipefail
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo 'This installer targets Apple Silicon macOS.' >&2; exit 1; }
command -v mise >/dev/null || { echo 'Install mise first: https://mise.jdx.dev/getting-started.html' >&2; exit 1; }
if ! command -v terraform >/dev/null; then
  mise use --global terraform@1.15.8
fi
if ! command -v az >/dev/null; then
  mise install python@3.14.8
  python_bin="$(mise where python@3.14.8)/bin/python3"
  archive=$(mktemp -t waiwai-azure-cli)
  trap 'rm -f "$archive"' EXIT
  curl --fail --location --retry 3 https://github.com/Azure/azure-cli/releases/download/azure-cli-2.91.0/azure-cli-2.91.0-macos-arm64.tar.gz -o "$archive"
  echo "dc28a3eef40d0b20f266f1e76b7a91f7a8ecdeaa28d0c855459eaa74edacbae6  $archive" | shasum -a 256 --check
  destination="$HOME/.local/share/azure-cli/2.91.0"
  mkdir -p "$destination" "$HOME/.local/bin"
  tar -xzf "$archive" -C "$destination"
  [ ! -e "$HOME/.local/bin/az" ] || { echo 'Existing az wrapper found; not overwriting.' >&2; exit 1; }
  cat > "$HOME/.local/bin/az" <<WRAPPER
#!/bin/sh
export AZ_PYTHON="$python_bin"
exec "$destination/bin/az" "\$@"
WRAPPER
  chmod 755 "$HOME/.local/bin/az"
fi
export PATH="$HOME/.local/bin:$PATH"
az config set core.collect_telemetry=no
az version
terraform version
node --version
echo 'Next: az login --use-device-code, then select the company subscription.'
