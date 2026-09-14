import { Controller, Get, Injectable, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../cache/cache.service";

/**
 * Últimas notícias do site institucional do cliente, exibidas na tela de login.
 *
 * Pedido de 14/09/2026 para o Hub da Triunfo Transbrasiliana: no lugar do texto
 * de apresentação do produto, as notícias de triunfotransbrasiliana.com.br.
 *
 * Só funciona onde `LOGIN_NOTICIAS_WP_URL` está definido (compose do servidor).
 * Sem a variável — produção — devolve lista vazia e a tela mantém o texto de
 * sempre. O site é WordPress: a leitura é pela API REST pública
 * (`/wp-json/wp/v2/posts`), não raspando o HTML, porque a grade de notícias da
 * home é carregada por AJAX e não vem no HTML.
 *
 * A rota é pública (a tela de login não tem sessão), por isso:
 *  · o navegador nunca chama o site do cliente — só esta rota, com cache de
 *    30 min no Redis. Mil aberturas do login viram 2 chamadas por hora ao site;
 *  · devolve só texto puro (HTML removido) e links/imagens do próprio domínio;
 *  · se o site cair, serve a última lista boa por até 7 dias.
 */

export type NoticiaLogin = { titulo: string; resumo: string; data: string; link: string; imagem: string | null };

const CHAVE = "cache:login-noticias:v1";
const CHAVE_ULTIMA = "cache:login-noticias:v1:ultima";
const TTL = 30 * 60;
const TTL_FALHA = 5 * 60;
const TTL_ULTIMA = 7 * 24 * 3600;
const QUANTIDADE = 4;

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

/** Texto puro a partir do HTML do WordPress. Exportada para teste. */
export function textoPuro(html: string): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, nome) => ENTIDADES[nome.toLowerCase()] ?? m)
    .replace(/\[(?:…|\.\.\.)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resumir(texto: string, max = 180): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(" ") > 120 ? corte.lastIndexOf(" ") : max).trim() + "…";
}

/** Aceita só https do próprio site — a rota é pública e o link vira <a>/<img>. */
function mesmoSite(url: unknown, host: string): string | null {
  try {
    const u = new URL(String(url));
    const h = u.hostname.replace(/^www\./, "");
    return u.protocol === "https:" && h === host ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Converte a resposta da API do WordPress. Exportada para teste. */
export function converterPosts(posts: any[], base: string): NoticiaLogin[] {
  const host = new URL(base).hostname.replace(/^www\./, "");
  const itens: NoticiaLogin[] = [];
  for (const p of Array.isArray(posts) ? posts : []) {
    const link = mesmoSite(p?.link, host);
    const titulo = textoPuro(p?.title?.rendered);
    if (!link || !titulo) continue;
    const midia = p?._embedded?.["wp:featuredmedia"]?.[0];
    const tamanhos = midia?.media_details?.sizes || {};
    const imagem = mesmoSite(tamanhos.medium_large?.source_url || tamanhos.medium?.source_url || midia?.source_url, host);
    itens.push({ titulo, resumo: resumir(textoPuro(p?.excerpt?.rendered)), data: String(p?.date || ""), link, imagem });
    if (itens.length === QUANTIDADE) break;
  }
  return itens;
}

@Injectable()
export class LoginNoticiasService {
  private readonly logger = new Logger(LoginNoticiasService.name);
  constructor(private readonly config: ConfigService, private readonly cache: CacheService) {}

  private get base(): string | null {
    const url = String(this.config.get("LOGIN_NOTICIAS_WP_URL", "") || "").trim().replace(/\/+$/, "");
    return url.startsWith("https://") ? url : null;
  }

  async listar(): Promise<{ fonte: string | null; itens: NoticiaLogin[] }> {
    const base = this.base;
    if (!base) return { fonte: null, itens: [] };

    const emCache = await this.cache.get<NoticiaLogin[]>(CHAVE);
    if (emCache) return { fonte: base, itens: emCache };

    try {
      const campos = "id,date,link,title,excerpt,_links,_embedded";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${base}/wp-json/wp/v2/posts?per_page=${QUANTIDADE + 2}&_embed=wp:featuredmedia&_fields=${campos}`, {
        headers: { "User-Agent": "HubLogin/1.0", Accept: "application/json" },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const itens = converterPosts(await r.json(), base);
      await this.cache.set(CHAVE, itens, itens.length ? TTL : TTL_FALHA);
      if (itens.length) await this.cache.set(CHAVE_ULTIMA, itens, TTL_ULTIMA);
      return { fonte: base, itens };
    } catch (e: any) {
      this.logger.warn(`Notícias do login indisponíveis (${base}): ${e?.message}`);
      const ultima = (await this.cache.get<NoticiaLogin[]>(CHAVE_ULTIMA)) || [];
      await this.cache.set(CHAVE, ultima, TTL_FALHA);
      return { fonte: base, itens: ultima };
    }
  }
}

@Controller("login-noticias")
class LoginNoticiasController {
  constructor(private readonly servico: LoginNoticiasService) {}

  @Get()
  listar() {
    return this.servico.listar();
  }
}

@Module({ controllers: [LoginNoticiasController], providers: [LoginNoticiasService] })
export class LoginNoticiasModule {}
