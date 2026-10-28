import hashlib, json, pathlib, subprocess, tarfile, datetime

root = pathlib.Path('/opt/orkestri')
manifest = json.loads(pathlib.Path('/tmp/evento-alerta-release-20261027.json').read_text())
def digest(path):
    return hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest() if path.exists() else None
for item in manifest['files']:
    path = (root / item['path']).resolve()
    assert root in path.parents, 'unsafe path'
    assert digest(path) in (item['baseline'], item['sha256'], item.get('previous',item['baseline'])), 'source conflict: '+item['path']
backup = root / 'backups' / ('evento-alerta-before-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gz')
with tarfile.open(backup,'w:gz') as archive:
    for item in manifest['files']:
        if (root/item['path']).exists(): archive.add(root/item['path'],arcname=item['path'])
tag = 'orkestri/api:rollback-evento-alerta-20261027'
if subprocess.run(['docker','image','inspect',tag],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
    subprocess.run(['docker','tag','orkestri/api:latest',tag],check=True)
with tarfile.open('/tmp/evento-alerta-release-20261027.tar.gz') as archive:
    allowed = {item['path'][8:] for item in manifest['files']}
    for member in archive.getmembers():
        assert member.name in allowed and member.isfile(), 'unexpected archive member'
    archive.extractall(root/'backend')
for item in manifest['files']:
    assert digest(root/item['path'])==item['sha256'], 'checksum mismatch: '+item['path']
print(json.dumps({'files':len(manifest['files']),'checksums':'passed','backup':str(backup)}))
