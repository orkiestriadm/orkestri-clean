import subprocess, time, json, urllib.request, os

os.chdir('/opt/orkestri')
compose = ['docker','compose','-f','docker-compose.yml','-f','docker-compose.prod.yml']
def inspect(name, template):
    return subprocess.check_output(['docker','inspect','--format',template,name],text=True).strip()
preservados = {name:inspect(name,'{{.Id}}') for name in ['orkestri_frontend','orkestri_website','orkestri_nginx']}
# Migração apenas aditiva, sem executar scheduler ou iniciar aplicação candidata.
subprocess.run(compose+['run','--rm','--no-deps','-T','--entrypoint','npx','api','prisma','migrate','deploy'],check=True)
subprocess.run(compose+['up','-d','--no-deps','api'],check=True)
for attempt in range(90):
    if inspect('orkestri_api','{{.State.Health.Status}}') == 'healthy': break
    time.sleep(1)
else: raise RuntimeError('API health did not pass')
subprocess.run(['docker','exec','orkestri_nginx','nginx','-t'],check=True)
subprocess.run(['docker','exec','orkestri_nginx','nginx','-s','reload'],check=True)
for name, original in preservados.items():
    assert inspect(name,'{{.Id}}') == original, 'unexpected recreation: '+name
for route in ['/api/health','/','/login']:
    with urllib.request.urlopen('https://www.orkiestri.com'+route,timeout=30) as response:
        assert response.status==200, 'public route unavailable: '+route
print(json.dumps({'activated':['api'],'health':'passed','public_routes':3,'other_services':'preserved','image':inspect('orkestri_api','{{.Image}}')}))
