import hashlib, json, pathlib, subprocess, tarfile, datetime

root = pathlib.Path('/opt/orkestri')
manifest = json.loads(pathlib.Path('/tmp/whatsapp-entry-release-20261027.json').read_text())
superseded_path = pathlib.Path('/tmp/whatsapp-entry-superseded-20261027.json')
superseded = json.loads(superseded_path.read_text()) if superseded_path.exists() else {}
def digest(path):
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest() if path.exists() else None
for item in manifest['files']:
    path = (root / item['path']).resolve()
    assert root in path.parents, 'unsafe release path'
    assert digest(path) in (item['baseline'], item['sha256'], superseded.get(item['path'], item['baseline'])), 'source conflict: ' + item['path']
backup = root / 'backups' / ('whatsapp-entry-before-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.tar.gz')
backup.parent.mkdir(exist_ok=True)
with tarfile.open(backup, 'w:gz') as archive:
    for item in manifest['files']:
        if (root / item['path']).exists():
            archive.add(root / item['path'], arcname=item['path'])
for service, tag in [('api', 'rollback-whatsapp-entry-20261027'), ('website', 'rollback-before-3.3.1-20261027')]:
    exists = subprocess.run(['docker', 'image', 'inspect', 'orkestri/' + service + ':' + tag], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if not exists:
        subprocess.run(['docker', 'tag', 'orkestri/' + service + ':latest', 'orkestri/' + service + ':' + tag], check=True)
for service in ['backend', 'website']:
    archive_path = '/tmp/whatsapp-entry-' + service + '-20261027.tar.gz'
    with tarfile.open(archive_path) as archive:
        allowed = {item['path'][len(service)+1:] for item in manifest['files'] if item['path'].startswith(service + '/')}
        for member in archive.getmembers():
            assert member.name in allowed and member.isfile(), 'unexpected archive entry'
        archive.extractall(root / service)
for item in manifest['files']:
    assert digest(root / item['path']) == item['sha256'], 'release checksum mismatch: ' + item['path']
print(json.dumps({'staged_files': len(manifest['files']), 'backup': str(backup), 'checksums': 'passed'}))
