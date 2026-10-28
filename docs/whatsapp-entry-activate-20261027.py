import json, subprocess, time, os

os.chdir('/opt/orkestri')
compose = ['docker', 'compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.prod.yml']
def inspect(name, template):
    return subprocess.check_output(['docker', 'inspect', '--format', template, name], text=True).strip()
frontend = inspect('orkestri_frontend', '{{.Id}}')
subprocess.run(compose + ['up', '-d', '--no-deps', 'api'], check=True)
for attempt in range(90):
    state = inspect('orkestri_api', '{{.State.Health.Status}}')
    if state == 'healthy':
        break
    time.sleep(1)
else:
    raise RuntimeError('API health did not pass; website was not activated')
subprocess.run(compose + ['-f', 'website/deploy/docker-compose.website.yml', 'up', '-d', '--no-deps', 'website'], check=True)
subprocess.run(['docker', 'exec', 'orkestri_nginx', 'nginx', '-t'], check=True)
subprocess.run(['docker', 'exec', 'orkestri_nginx', 'nginx', '-s', 'reload'], check=True)
assert inspect('orkestri_frontend', '{{.Id}}') == frontend, 'unexpected frontend recreation'
print(json.dumps({'activated': ['api', 'website'], 'api_health': state, 'frontend': 'preserved'}))
