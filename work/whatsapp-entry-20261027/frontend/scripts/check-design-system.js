#!/usr/bin/env node
/**
 * Guarda do design system.
 *
 * Os três problemas abaixo têm em comum o fato de **compilarem sem erro** — o
 * build passa, o TypeScript passa, e o defeito só aparece na tela. Foi assim
 * que cada um deles entrou no código em primeiro lugar.
 *
 * Uso:  node scripts/check-design-system.js
 *       node scripts/check-design-system.js --strict   (falha também nos avisos)
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "src");
const ESTRITO = process.argv.includes("--strict");

// Páginas públicas/auth têm identidade própria fora do shell do dashboard.
const ISENTOS = [
  "app/login", "app/signup", "app/recuperar-senha", "app/primeiro-acesso",
  "app/solicitar-acesso", "app/entenda-orkiestri", "app/kb", "app/portal",
  "app/suspended",
  // Site de marketing: identidade visual própria, fora do shell do dashboard.
  // Numeral decorativo em display é escolha deliberada no hero e nos preços.
  "components/landing",
];

// Classes de token definidas em globals.css. O prefixo `hover:`/`dark:` do
// Tailwind NÃO gera CSS para elas — só para utilitários do próprio Tailwind.
const CLASSES_TOKEN = [
  "surface-card", "surface-sunken", "surface-raised", "card-o",
  "border-subtle-o", "border-accent-o", "divide-subtle-o",
  "text-primary-o", "text-secondary-o", "text-muted-o", "text-faint-o",
  "hover-surface", "accent-text", "accent-soft", "accent-solid", "focus-accent",
  "metric", "num", "mono-cap",
];

// Variantes que existem escritas à mão no globals.css (essas são válidas).
const VARIANTES_OK = new Set([
  "hover:text-primary-o", "hover:text-secondary-o", "hover:text-muted-o",
  "hover:surface-card", "hover:surface-sunken", "hover:border-subtle-o",
  "hover:accent-text", "hover:accent-soft",
  "group-hover:accent-text", "group-hover:accent-soft", "group-hover:border-accent-o",
]);

function arquivos(dir, acc = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) arquivos(p, acc);
    else if (/\.tsx?$/.test(nome)) acc.push(p);
  }
  return acc;
}

const rel = (p) => path.relative(path.join(__dirname, ".."), p).replace(/\\/g, "/");
const isento = (p) => ISENTOS.some((d) => rel(p).includes(d));

const erros = [];
const avisos = [];

for (const arquivo of arquivos(RAIZ)) {
  if (isento(arquivo)) continue;
  const src = fs.readFileSync(arquivo, "utf-8");
  const linhas = src.split("\n");

  linhas.forEach((linha, i) => {
    const ref = `${rel(arquivo)}:${i + 1}`;

    // 1. ERRO — prefixo Tailwind sobre classe de token: não gera CSS nenhum.
    //    O estado de hover some em silêncio.
    for (const cls of CLASSES_TOKEN) {
      const re = new RegExp(`\\b(hover|dark|focus|active|group-hover):${cls}\\b`, "g");
      let m;
      while ((m = re.exec(linha)) !== null) {
        const completo = `${m[1]}:${cls}`;
        if (VARIANTES_OK.has(completo)) continue;
        if (m[1] === "dark") {
          erros.push(`${ref}  "${completo}" — token já troca com o tema; remova o prefixo dark:`);
        } else {
          erros.push(`${ref}  "${completo}" — prefixo Tailwind não funciona em classe custom; escreva a variante em globals.css`);
        }
      }
    }

    // 2. ERRO — número em Syne. Numerais de largura irregular; use .metric.
    //    Título pode usar display: marque com /* ds-ok: titulo */ na linha.
    //    Duas sintaxes de tamanho: `fontSize: 26` (inline) e `text-[26px]`
    //    (Tailwind). A primeira versão desta regra só olhava a inline e deixou
    //    passar todos os cartões escritos em classe utilitária.
    const displayNaLinha = /font-display|--font-display/.test(linha);
    const inlineGrande = /fontSize:\s*(1[6-9]|[2-9]\d)/.test(linha);
    const tailwindGrande = /text-\[(1[6-9]|[2-9]\d)px\]|\btext-(xl|2xl|3xl|4xl|5xl|6xl)\b/.test(linha);
    if (displayNaLinha && (inlineGrande || tailwindGrande)) {
      const ehTitulo = /<h[1-6]\b/.test(linha) || /ds-ok/.test(linha);
      if (!ehTitulo) {
        erros.push(`${ref}  fonte display em texto grande — se for número use .metric; se for título marque /* ds-ok: titulo */`);
      }
    }

    // 3. AVISO — cor crua fora dos tokens.
    const cores = linha.match(/\b(?:bg|text|border|divide|ring|from|via|to)-(?:slate|indigo|zinc|gray|neutral|stone)-\d{2,3}\b/g);
    if (cores) avisos.push(`${ref}  ${cores.join(" ")}`);
  });
}

const cor = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);

if (erros.length) {
  console.log(cor(31, `\n✖ ${erros.length} problema(s) que compilam mas quebram na tela:\n`));
  erros.forEach((e) => console.log("  " + e));
}

if (avisos.length) {
  console.log(cor(33, `\n⚠ ${avisos.length} linha(s) com cor fora dos tokens do design system:\n`));
  const mostrar = ESTRITO ? avisos : avisos.slice(0, 15);
  mostrar.forEach((a) => console.log("  " + a));
  if (!ESTRITO && avisos.length > mostrar.length) {
    console.log(`  … e mais ${avisos.length - mostrar.length}. Use --strict para ver todas.`);
  }
}

if (!erros.length && !avisos.length) {
  console.log(cor(32, "\n✓ Design system consistente.\n"));
} else {
  console.log("");
}

// Aviso não derruba o build: os casos restantes são pontuais e legítimos.
// Erro derruba, porque é defeito silencioso.
process.exit(erros.length || (ESTRITO && avisos.length) ? 1 : 0);
