#!/bin/bash
# User-scoped official Google archive; no login, project selection or cloud writes.
set -euo pipefail
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo 'This installer targets Apple Silicon macOS.' >&2; exit 1; }
command -v mise >/dev/null || { echo 'Install mise first: https://mise.jdx.dev/getting-started.html' >&2; exit 1; }
command -v terraform >/dev/null || mise use --global terraform@1.15.8
if ! command -v gcloud >/dev/null; then
  mise install python@3.14.8
  python_bin="$(mise where python@3.14.8)/bin/python3"
  archive=$(mktemp -t waiwai-gcloud)
  staging=$(mktemp -d -t waiwai-gcloud-stage)
  trap 'rm -f "$archive"; rm -rf "$staging"' EXIT
  curl --fail --location --retry 3 https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz -o "$archive"
  echo "71b37ca07ab0f9bc43898e42c913e10f143166230ab31e0bbea3632dbc77b010  $archive" | shasum -a 256 --check
  tar -xzf "$archive" -C "$staging"
  [ "$(cat "$staging/google-cloud-sdk/VERSION")" = 589.0.0 ] || { echo 'Unexpected Google Cloud CLI release.' >&2; exit 1; }
  destination="$HOME/.local/share/google-cloud-cli/589.0.0"
  [ ! -e "$destination" ] && [ ! -e "$HOME/.local/bin/gcloud" ] || { echo 'Existing installation found; inspect it before updating.' >&2; exit 1; }
  mkdir -p "$(dirname "$destination")" "$HOME/.local/bin"
  mv "$staging/google-cloud-sdk" "$destination"
  CLOUDSDK_PYTHON="$python_bin" "$destination/install.sh" --quiet --usage-reporting=false --path-update=false --command-completion=false --install-python=false
  cat > "$HOME/.local/bin/gcloud" <<WRAPPER
#!/bin/sh
export CLOUDSDK_PYTHON="$python_bin"
export CLOUDSDK_CORE_DISABLE_USAGE_REPORTING=true
exec "$destination/bin/gcloud" "\$@"
WRAPPER
  chmod 755 "$HOME/.local/bin/gcloud"
fi
export PATH="$HOME/.local/bin:$PATH"
gcloud version
terraform version
node --version
echo 'Installed only. For account/project setup, follow doc-gcp/setup.md.'
