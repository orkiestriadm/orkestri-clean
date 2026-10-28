import json, re, urllib.request, urllib.parse, html

links = 0
for route in ['/', '/demo', '/blog', '/products/orkiestri-one']:
    with urllib.request.urlopen('https://www.orkiestri.com' + route, timeout=30) as response:
        assert response.status == 200, route
        body = response.read().decode()
    found = re.findall(r'href="(https://wa\.me/[^" ]+)"', body)
    assert found, 'missing signup links: ' + route
    for link in found:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(html.unescape(link)).query)
        assert query.get('text') == ['CADASTRO'], 'wrong signup link: ' + route
        links += 1
    assert 'CADASTRO AGENDA' not in body, 'legacy command in public page'
    if route == '/':
        assert '3.3.1' in body, 'old website version'
        assert 'Cadastre-se' in body, 'signup label missing'
for path in ['/login', '/api/health']:
    with urllib.request.urlopen('https://www.orkiestri.com' + path, timeout=30) as response:
        assert response.status == 200, path
print(json.dumps({'public_routes': 6, 'whatsapp_links': links, 'website_version': '3.3.1', 'api_health': 'passed'}))
