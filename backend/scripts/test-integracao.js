#!/usr/bin/env node
/**
 * Roda a suíte de integração do zero: sobe um Postgres descartável, aplica as
 * migrations, executa os testes e derruba tudo.
 *
 * POR QUE ISTO EXISTE
 *
 * A suíte de integração do People ficou MESES sem rodar. Não porque estava
 * quebrada — quando finalmente rodou, os 53 testes passaram de primeira. Ficou
 * parada porque exigia um banco que ninguém tinha à mão, e porque `npm test`
 * a pulava em SILÊNCIO: a saída dizia "todos passando" enquanto o caminho que
 * realmente toca o banco não era exercitado.
 *
 * Um teste que exige preparação manual é um teste que não roda. Este script
 * remove a preparação: `npm run test:it` e pronto.
 */

const { execSync, spawnSync } = require("child_process");

const CONTAINER = "orkiestri_test_db";
const PORTA = process.env.PORTA_TESTE || "55432";
const URL = `postgresql://it:it@localhost:${PORTA}/people_it`;

const log = (m) => console.log(`\x1b[36m→\x1b[0m ${m}`);
const erro = (m) => console.error(`\x1b[31m✗\x1b[0m ${m}`);

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts });
}

function docker(args, opts = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...opts });
}

function temDocker() {
  return docker(["--version"]).status === 0;
}

function derrubar() {
  docker(["rm", "-f", CONTAINER], { stdio: "ignore" });
}

function subirBanco() {
  derrubar(); // resto de execução anterior interrompida
  log(`subindo Postgres descartável em :${PORTA}`);
  const r = docker([
    "run", "-d", "--name", CONTAINER,
    "-e", "POSTGRES_PASSWORD=it", "-e", "POSTGRES_USER=it", "-e", "POSTGRES_DB=people_it",
    "-p", `${PORTA}:5432`,
    "postgres:16-alpine",
  ]);
  if (r.status !== 0) throw new Error(`docker run falhou: ${r.stderr?.trim()}`);
}

function esperarBanco() {
  log("aguardando o banco aceitar conexão");
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    if (docker(["exec", CONTAINER, "pg_isready", "-U", "it"]).status === 0) return;
    // Espera ativa curta: o container sobe em poucos segundos e um sleep longo
    // só atrasaria o retorno.
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},700)"]);
  }
  throw new Error("o banco não ficou pronto em 60s");
}

function migrar() {
  log("aplicando migrations");
  sh("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: URL } });
}

function testar() {
  log("rodando a suíte de integração");
  // `--runInBand`: os testes compartilham o mesmo banco e a mesma organização.
  // Sem isso, dois workers apagariam os dados um do outro no meio do caminho.
  //
  // `shell: true` não é preguiça: desde a correção do CVE-2024-27980, o Node
  // recusa executar `.cmd` sem shell e devolve EINVAL — o jest simplesmente não
  // rodava no Windows, com o script terminando em silêncio como se tivesse.
  // Padrão ABERTO (`.*integration`) e não o nome de um arquivo: a versão
  // anterior fixava `people.integration` e teria pulado, em silêncio, o
  // arquivo de isolamento de escopo criado depois. Filtro que exclui teste
  // novo sem avisar é o mesmo defeito que este script existe para corrigir.
  const r = spawnSync(
    "npx jest src/modules/people/.*integration --runInBand --testTimeout=60000",
    {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, PEOPLE_IT_DATABASE_URL: URL },
    },
  );
  if (r.error) throw new Error(`falha ao executar o jest: ${r.error.message}`);
  return r.status ?? 1;
}

(function principal() {
  if (!temDocker()) {
    erro("Docker não encontrado. A suíte de integração precisa de um Postgres descartável.");
    erro("Instale o Docker ou aponte PEOPLE_IT_DATABASE_URL para um banco DESCARTÁVEL e rode o jest direto.");
    process.exit(1);
  }

  let saida = 1;
  try {
    subirBanco();
    esperarBanco();
    migrar();
    saida = testar();
  } catch (e) {
    erro(e.message);
    saida = 1;
  } finally {
    log("derrubando o banco de teste");
    derrubar();
  }
  process.exit(saida);
})();
