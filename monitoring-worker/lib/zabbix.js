'use strict';
/**
 * Leitura do Zabbix para o Monitoramento Operacional do Orkestri.
 *
 * SOMENTE LEITURA — chama a API JSON-RPC do Zabbix (host.get / item.get).
 * Não toca em nenhum servidor monitorado: conversa apenas com o Zabbix,
 * que já é a fonte de verdade de serviços e desempenho.
 *
 * Config via env: ZABBIX_API_URL e ZABBIX_API_TOKEN.
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Padrões de chave que nos interessam (prefixo). O resto é descartado.
const SEARCH_KEYS = [
  'system.run[systemctl is-active',
  'system.cpu.util',
  'vm.memory.util',          // cobre vm.memory.util e vm.memory.utilization
  'system.uptime',
  'vfs.fs.dependent.size[',
];

function rpc(apiUrl, token, method, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(apiUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const headers = {
      'Content-Type': 'application/json-rpc',
      'Content-Length': Buffer.byteLength(body),
    };
    if (token && method !== 'apiinfo.version') headers['Authorization'] = 'Bearer ' + token;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers,
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.error) return reject(new Error(j.error.data || j.error.message || 'erro Zabbix'));
            resolve(j.result);
          } catch (e) {
            reject(new Error('resposta Zabbix inválida: ' + e.message));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout Zabbix')));
    req.write(body);
    req.end();
  });
}

function _num(v) {
  const n = Number(v);
  if (isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

// Classifica UM item do Zabbix em serviço ou métrica (função pura, testável).
function classifyItem(it) {
  const key = it.key_ || '';
  const val = it.lastvalue;
  if (key.startsWith('system.run[systemctl is-active')) {
    return { kind: 'service', nome: it.name || key, alvo: key, up: String(val).trim() === '1', valor: String(val) };
  }
  if (key === 'system.cpu.util') return { kind: 'metric', chave: 'cpu', rotulo: '', valor: _num(val), unidade: '%' };
  if (key === 'vm.memory.util' || key === 'vm.memory.utilization')
    return { kind: 'metric', chave: 'mem', rotulo: '', valor: _num(val), unidade: '%' };
  if (key === 'system.uptime') return { kind: 'metric', chave: 'uptime', rotulo: '', valor: _num(val), unidade: 's' };
  const m = key.match(/^vfs\.fs\.dependent\.size\[(.+),pused\]$/);
  if (m) return { kind: 'metric', chave: 'disk', rotulo: m[1], valor: _num(val), unidade: '%' };
  return null;
}

// Agrupa itens classificados por hostid -> { services:[], metrics:[] }
function classifyByHost(items) {
  const out = {};
  for (const it of items) {
    const c = classifyItem(it);
    if (!c || (c.kind === 'metric' && c.valor == null)) continue;
    const hid = String(it.hostid);
    if (!out[hid]) out[hid] = { services: [], metrics: [] };
    if (c.kind === 'service') out[hid].services.push(c);
    else out[hid].metrics.push(c);
  }
  return out;
}

// Lista hosts habilitados com seus IPs (para casar com mon_asset).
async function fetchHosts(apiUrl, token) {
  return rpc(apiUrl, token, 'host.get', {
    output: ['hostid', 'host', 'name', 'status'],
    selectInterfaces: ['ip', 'type'],
    filter: { status: 0 },
  });
}

// Puxa os itens de serviço/hardware dos hostids dados (uma chamada).
async function fetchDeepItems(apiUrl, token, hostids) {
  if (!hostids || !hostids.length) return [];
  return rpc(apiUrl, token, 'item.get', {
    output: ['name', 'key_', 'lastvalue', 'units', 'hostid'],
    hostids,
    search: { key_: SEARCH_KEYS },
    searchByAny: true,
    startSearch: true, // prefixo
  });
}

// Itens do OSA: fadami.tag.recebido + estado do serviço OSA, com host/ip.
async function fetchOsaItems(apiUrl, token) {
  const items = await rpc(apiUrl, token, 'item.get', {
    output: ['name', 'key_', 'lastvalue', 'lastclock', 'hostid'],
    search: { key_: ['fadami.tag.recebido', 'service.info["Fadami.SAGA.Mensageria.Osa"'] },
    searchByAny: true,
  });
  if (!items.length) return { items: [], hosts: {} };
  const hostids = [...new Set(items.map((i) => String(i.hostid)))];
  const hosts = await rpc(apiUrl, token, 'host.get', {
    output: ['hostid', 'host', 'name'], hostids, selectInterfaces: ['ip', 'type'],
  });
  const hostMap = {};
  for (const h of hosts) {
    const ip = (h.interfaces || []).map((i) => i.ip).find(Boolean) || '';
    hostMap[String(h.hostid)] = { nome: h.name || h.host, ip };
  }
  return { items, hosts: hostMap };
}

module.exports = { rpc, classifyItem, classifyByHost, fetchHosts, fetchDeepItems, fetchOsaItems, SEARCH_KEYS };
