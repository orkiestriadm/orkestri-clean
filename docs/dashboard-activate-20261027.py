import subprocess,time,json,urllib.request,urllib.error,os
os.chdir('/opt/orkestri')
compose=['docker','compose','-f','docker-compose.yml','-f','docker-compose.prod.yml']
def inspect(name,template):return subprocess.check_output(['docker','inspect','--format',template,'orkestri_'+name],text=True).strip()
preserve={name:inspect(name,'{{.Id}}') for name in ['api','website']}
subprocess.run(compose+['up','-d','--no-deps','frontend'],check=True)
for _ in range(45):
    ready=subprocess.run(['docker','exec','orkestri_frontend','node','-e',"fetch('http://127.0.0.1:3000/login',{headers:{cookie:'orkestri_token=invalid'},redirect:'manual'}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if ready.returncode==0:break
    time.sleep(1)
else:
    subprocess.run(['docker','tag','orkestri/frontend:rollback-dashboard-session-20261027','orkestri/frontend:latest'],check=True)
    subprocess.run(compose+['up','-d','--no-deps','frontend'],check=True)
    subprocess.run(['docker','exec','orkestri_nginx','nginx','-s','reload'],check=True)
    raise RuntimeError('Frontend not ready; previous image restored')
subprocess.run(['docker','exec','orkestri_nginx','nginx','-t'],check=True)
subprocess.run(['docker','exec','orkestri_nginx','nginx','-s','reload'],check=True)
for name,id in preserve.items():assert inspect(name,'{{.Id}}')==id,name+' unexpectedly recreated'
checks=[]
for host in ['orkiestri.com','www.orkiestri.com']:
    for path,cookie in [('/login',''),('/login','orkestri_token=invalid'),('/api/health','')]:
        req=urllib.request.Request('https://'+host+path,headers={'Cookie':cookie})
        with urllib.request.urlopen(req,timeout=20) as response:
            assert response.status==200,host+path
            assert response.url=='https://'+host+path,'unexpected redirect: '+response.url
            checks.append(host+path+(' stale-cookie' if cookie else ''))
    with urllib.request.urlopen('https://'+host+'/dashboard',timeout=20) as response:
        assert '/login?from=' in response.url,'unauthenticated dashboard must require login'
        checks.append(host+'/dashboard unauthenticated')
print(json.dumps({'activated':['frontend'],'preserved':list(preserve),'checks':checks,'image':inspect('frontend','{{.Image}}')}))
