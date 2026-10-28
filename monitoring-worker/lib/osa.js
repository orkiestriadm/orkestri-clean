'use strict';
/**
 * Coletor OSA — lê SÓ os metadados de um diretório remoto via SMB (smbclient)
 * para descobrir o último arquivo .tag recebido. Não abre, não baixa, não lê
 * conteúdo de arquivo: apenas `ls` no diretório (listagem + data).
 *
 * Credenciais SMB compartilhadas via env: OSA_SMB_USER, OSA_SMB_PASS, OSA_SMB_DOMAIN.
 */
const { execFile } = require('child_process');

const MES = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// Converte "D:\Fadami\OSA\Recebidos" (+ share opcional) em { share, subpath } SMB.
// Sem share: usa o admin share do drive (D: -> D$). Subpath sempre com "\".
function resolverAlvo(caminho, shareOverride) {
  let c = String(caminho || '').trim().replace(/\//g, '\\');
  // remove UNC se vier "\\ip\share\..."
  const unc = c.match(/^\\\\[^\\]+\\([^\\]+)\\?(.*)$/);
  if (unc) return { share: shareOverride || unc[1], subpath: unc[2] || '' };
  const drive = c.match(/^([A-Za-z]):\\?(.*)$/);
  if (drive) {
    return { share: shareOverride || (drive[1].toUpperCase() + '$'), subpath: drive[2] || '' };
  }
  // caminho relativo puro
  return { share: shareOverride || c.split('\\')[0], subpath: shareOverride ? c : c.split('\\').slice(1).join('\\') };
}

// Extrai série/sequencial de "172.289251.tag"
function extrairSerieSeq(nome) {
  const base = nome.replace(/\.tag$/i, '');
  const i = base.indexOf('.');
  if (i < 0) return { serie: null, sequencial: base };
  return { serie: base.slice(0, i), sequencial: base.slice(i + 1) };
}

// Parser da saída do `smbclient ... -c 'ls *.tag'`.
// Linha típica: "  172.289251.tag      A    12345  Mon Jun 16 13:06:06 2026"
function parseSmbLs(out, filtroRegex) {
  const re = /^\s+(\S.*?)\s+[A-Za-z]*\s+\d+\s+\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s*$/;
  const arr = [];
  for (const raw of String(out).split(/\r?\n/)) {
    const m = raw.match(re);
    if (!m) continue;
    const nome = m[1].trim();
    if (nome === '.' || nome === '..') continue;
    if (filtroRegex && !filtroRegex.test(nome)) continue;
    const mes = MES[m[2]];
    if (mes == null) continue;
    const ts = new Date(Number(m[7]), mes, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
    arr.push({ nome, ts });
  }
  return arr;
}

// Converte filtro "*.tag" em regex
function filtroToRegex(filtro) {
  const f = (filtro || '*.tag').trim();
  const esc = f.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + esc + '$', 'i');
}

// Escolhe o arquivo mais recente (por mtime; empate -> maior sequencial numérico).
function maisRecente(files) {
  if (!files.length) return null;
  return files.slice().sort((a, b) => {
    const dt = b.ts - a.ts;
    if (dt !== 0) return dt;
    const sa = Number(extrairSerieSeq(a.nome).sequencial) || 0;
    const sb = Number(extrairSerieSeq(b.nome).sequencial) || 0;
    return sb - sa;
  })[0];
}

// Executa o smbclient (read-only) e devolve a saída do ls. Timeout p/ não travar.
// IMPORTANTE: o erro reportado vem SÓ do stderr (NT_STATUS) — nunca da linha de
// comando, que contém a senha. Não logar/guardar a senha em lugar nenhum.
function smbList(ip, share, subpath, filtro, cred, timeoutMs) {
  return new Promise((resolve, reject) => {
    const user = (cred.domain ? cred.domain + '\\' : '') + (cred.user || '');
    const auth = user + '%' + (cred.pass || '');
    const cmds = (subpath ? `cd "${subpath}"; ` : '') + `ls "${filtro}"`;
    const args = [`//${ip}/${share}`, '-U', auth, '-N', '-c', cmds];
    execFile('smbclient', args, { timeout: timeoutMs || 12000, maxBuffer: 1024 * 1024 * 8 },
      (err, stdout, stderr) => {
        const se = String(stderr || '');
        // Nenhum arquivo casou o filtro → diretório acessível, porém vazio (não é erro).
        if (/NT_STATUS_NO_SUCH_FILE|NT_STATUS_NO_MORE_FILES/i.test(se)) return resolve(stdout || '');
        if (err && !stdout) {
          const linhas = se.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          const motivo = linhas.find((l) => /NT_STATUS|denied|failed|refused|timed? out|No such/i.test(l))
            || linhas[0] || `falha smbclient (code ${err.code || '?'})`;
          return reject(new Error(motivo.slice(0, 200))); // SEM a linha de comando (sem senha)
        }
        resolve(stdout || '');
      });
  });
}

module.exports = { resolverAlvo, extrairSerieSeq, parseSmbLs, filtroToRegex, maisRecente, smbList };
