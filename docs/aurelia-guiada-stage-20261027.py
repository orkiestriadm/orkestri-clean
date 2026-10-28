import hashlib,json,pathlib,subprocess,tarfile,datetime
root=pathlib.Path('/opt/orkestri')
manifest=json.loads(pathlib.Path('/tmp/aurelia-guiada-release-20261027.json').read_text())
def digest(path):return hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest() if path.exists() else None
for item in manifest['files']:
    path=(root/item['path']).resolve()
    assert root in path.parents,'unsafe path'
    assert digest(path) in (item['baseline'],item['sha256'],item.get('previous',item['baseline'])),'source conflict: '+item['path']
backup=root/'backups'/('aurelia-guiada-before-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gz')
with tarfile.open(backup,'w:gz') as archive:
    for item in manifest['files']:
        if (root/item['path']).exists():archive.add(root/item['path'],arcname=item['path'])
for service in ['api','website']:
    tag='orkestri/'+service+':rollback-aurelia-guiada-20261027'
    if subprocess.run(['docker','image','inspect',tag],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
        subprocess.run(['docker','tag','orkestri/'+service+':latest',tag],check=True)
for service in ['backend','website']:
    with tarfile.open('/tmp/aurelia-guiada-'+service+'-20261027.tar.gz') as archive:
        allowed={item['path'] if service=='backend' else item['path'][8:] for item in manifest['files'] if item['path'].startswith(service+'/')}
        for member in archive.getmembers():assert member.name in allowed and member.isfile(),'unexpected archive member'
        archive.extractall(root if service=='backend' else root/'website')
for item in manifest['files']:assert digest(root/item['path'])==item['sha256'],'checksum mismatch: '+item['path']
print(json.dumps({'files':len(manifest['files']),'checksums':'passed','backup':str(backup)}))
