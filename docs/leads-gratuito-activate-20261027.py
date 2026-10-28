import subprocess, time, json, urllib.request, os
os.chdir('/opt/orkestri')
compose=['docker','compose','-f','docker-compose.yml','-f','docker-compose.prod.yml']
def inspect(name,template):
    return subprocess.check_output(['docker','inspect','--format',template,name],text=True).strip()
site=inspect('orkestri_website','{{.Id}}')
def reload():
    subprocess.run(['docker','exec','orkestri_nginx','nginx','-t'],check=True)
    subprocess.run(['docker','exec','orkestri_nginx','nginx','-s','reload'],check=True)
subprocess.run(compose+['up','-d','--no-deps','api'],check=True)
for _ in range(90):
    if inspect('orkestri_api','{{.State.Health.Status}}')=='healthy': break
    time.sleep(1)
else: raise RuntimeError('API health failed')
reload()
subprocess.run(compose+['up','-d','--no-deps','frontend'],check=True)
for _ in range(45):
    check=subprocess.run(['docker','exec','orkestri_frontend','node','-e',"fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if check.returncode==0: break
    time.sleep(1)
else: raise RuntimeError('Frontend readiness failed')
reload()
assert inspect('orkestri_website','{{.Id}}')==site, 'website unexpectedly recreated'
for route in ['/api/health','/login','/']:
    with urllib.request.urlopen('https://www.orkiestri.com'+route,timeout=30) as response:
        assert response.status==200, 'public route failed: '+route
print(json.dumps({'activated':['api','frontend'],'health':'passed','public_routes':3,'website':'preserved','images':{name:inspect('orkestri_'+name,'{{.Image}}') for name in ['api','frontend']}}))
