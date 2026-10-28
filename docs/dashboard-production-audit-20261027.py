import subprocess, json, hashlib, pathlib
root=pathlib.Path('/opt/orkestri')
info=json.loads(subprocess.check_output(['docker','inspect','orkestri_api'],text=True))[0]
env=dict(item.split('=',1) for item in info['Config']['Env'] if '=' in item)
keys=['MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','MP_PLAN_BUSINESS_CLOUD','MP_PLAN_BUSINESS_PLUS']
files=['backend/src/modules/billing/billing.module.ts','frontend/src/middleware.ts','frontend/src/lib/api.ts','frontend/src/app/dashboard/layout.tsx']
print(json.dumps({'payment_config_present':{k:bool(env.get(k)) for k in keys},'source_hashes':{p:hashlib.sha256((root/p).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for p in files}}))
