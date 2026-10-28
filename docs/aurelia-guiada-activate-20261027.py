import subprocess,time,json,urllib.request,os
os.chdir('/opt/orkestri')
compose=['docker','compose','-f','docker-compose.yml','-f','docker-compose.prod.yml']
def inspect(name,template):return subprocess.check_output(['docker','inspect','--format',template,name],text=True).strip()
frontend=inspect('orkestri_frontend','{{.Id}}')
subprocess.run(compose+['up','-d','--no-deps','api'],check=True)
for _ in range(90):
    if inspect('orkestri_api','{{.State.Health.Status}}')=='healthy':break
    time.sleep(1)
else:raise RuntimeError('API health failed')
subprocess.run(compose+['-f','website/deploy/docker-compose.website.yml','up','-d','--no-deps','website'],check=True)
for _ in range(30):
    ready=subprocess.run(['docker','exec','orkestri_website','node','-e',"fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if ready.returncode==0:break
    time.sleep(1)
else:raise RuntimeError('Website not ready')
subprocess.run(['docker','exec','orkestri_nginx','nginx','-t'],check=True)
subprocess.run(['docker','exec','orkestri_nginx','nginx','-s','reload'],check=True)
assert inspect('orkestri_frontend','{{.Id}}')==frontend,'frontend unexpectedly recreated'
for route in ['/api/health','/login','/','/demo']:
    with urllib.request.urlopen('https://www.orkiestri.com'+route,timeout=30) as response:
        assert response.status==200,'public route failed: '+route
        if route=='/':
            body=response.read().decode()
            assert '3.3.2' in body,'old website version'
            assert 'Responda uma pergunta por vez' in body,'old demonstration copy'
print(json.dumps({'activated':['api','website'],'health':'passed','public_routes':4,'frontend':'preserved','images':{name:inspect('orkestri_'+name,'{{.Image}}') for name in ['api','website']}}))
