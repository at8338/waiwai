# Executed as root by the Compute Engine guest agent, with only a non-secret
# bucket/object/hash manifest embedded in instance metadata. No SSH policy changes.
import hashlib
import json
import os
from pathlib import Path
import shutil
import secrets
import subprocess
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request


def deploy(manifest):
    os.umask(0o077)
    release = manifest['release']
    marker = Path('/opt/waiwai/.deployed-release')
    if marker.exists() and marker.read_text().strip() == release:
        print('WAIWAI_DEPLOY_COMMITTED ' + release, flush=True)
        return
    staging = Path('/tmp/waiwai-deploy-' + secrets.token_hex(12))
    staging.mkdir(mode=0o700)
    prepared = False

    def metadata(path):
        request = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/' + path, headers={'Metadata-Flavor': 'Google'})
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.read()

    try:
        token = json.loads(metadata('instance/service-accounts/default/token'))['access_token']
        url = 'https://storage.googleapis.com/storage/v1/b/' + manifest['bucket'] + '/o/' + urllib.parse.quote(manifest['object'], safe='') + '?alt=media'
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
        archive = staging / 'deployment.tar.gz'
        with urllib.request.urlopen(request, timeout=180) as response, archive.open('wb') as output:
            shutil.copyfileobj(response, output)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
            raise RuntimeError('Deployment checksum mismatch')
        with tarfile.open(archive) as bundle:
            bundle.extractall(staging, filter='data')
        activate = str(staging / 'activate-release.sh')
        subprocess.run(['bash', activate, str(staging / 'app.tar.gz'), release], check=True)
        prepared = True
        print('WAIWAI_DEPLOY_PREPARED ' + release, flush=True)
        # A human-operated client checks the public TLS/auth endpoints before
        # acknowledging this exact release. Without it, restore the old release.
        for _ in range(120):
            try:
                committed = metadata('instance/attributes/waiwai-deploy-commit').decode().strip()
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
                committed = ''
            if committed == release:
                subprocess.run(['bash', activate, 'commit', release, str(staging)], check=True)
                marker.write_text(release + '\n')
                print('WAIWAI_DEPLOY_COMMITTED ' + release, flush=True)
                return
            time.sleep(3)
        raise RuntimeError('External verification acknowledgment timed out')
    except Exception as error:
        if prepared and staging.exists():
            subprocess.run(['bash', str(staging / 'activate-release.sh'), 'rollback', release, str(staging)], check=False)
        print('WAIWAI_DEPLOY_FAILED ' + release + ' ' + type(error).__name__, flush=True)
        raise
    finally:
        if not Path('/run/waiwai-deploy-active').exists():
            shutil.rmtree(staging, ignore_errors=True)
