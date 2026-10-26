import Link from "next/link";
import { Linkedin, Github, Instagram, Youtube } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { VERSAO_SITE, VERSAO_SITE_DATA } from "@/lib/version";

const socials = [
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: Linkedin },
  { label: "GitHub", href: siteConfig.social.github, icon: Github },
  { label: "Instagram", href: siteConfig.social.instagram, icon: Instagram },
  { label: "YouTube", href: siteConfig.social.youtube, icon: Youtube },
];

/**
 * Rodapé — escuro em TODAS as páginas, inclusive nas claras.
 *
 * A home passou a ser escura (26/10/2026) e um rodapé branco embaixo dela
 * cortava a página ao meio. Escurecer só na home resolveria a emenda e
 * criaria outra: dois rodapés diferentes no mesmo site. Rodapé escuro sob
 * conteúdo claro é leitura corrente e fecha a página nos dois casos.
 */
export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-ink">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo tone="light" />
            <p className="max-w-xs text-sm leading-relaxed text-chalk-dim">
              A sua agenda, as suas contas e os seus projetos num lugar só —
              com aviso no WhatsApp na hora em que ainda dá tempo.
            </p>
            <div className="mt-2 flex gap-2">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] text-chalk-dim transition-colors hover:border-flame/40 hover:text-flame-soft"
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          {footerNav.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              {/* Sem caixa alta espaçada: o título de coluna de rodapé em
                  versal tracked é o mesmo adereço de template que saiu das
                  seções da home. Aqui basta ser menor e mais apagado. */}
              <span className="text-[0.8125rem] font-medium text-chalk-faint">
                {col.title}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <LinkDoRodape href={item.href}>{item.label}</LinkDoRodape>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-8 text-sm text-chalk-faint sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName}. Todos os
            direitos reservados.
          </p>
          <p className="flex items-center gap-2">
            Engineering Business Growth.
            {/* Versão discreta: serve de referência ao relatar problema, sem
                disputar atenção com o conteúdo do rodapé. */}
            <span
              className="text-white/25"
              title={"Site " + VERSAO_SITE + " · " + VERSAO_SITE_DATA}
            >
              v{VERSAO_SITE}
            </span>
          </p>
        </div>
      </Container>
    </footer>
  );
}

/**
 * O rodapé passou a ter um destino externo (o WhatsApp do cadastro), e o
 * `Link` do Next para fora do site não abre em nova aba nem leva o `rel`
 * de segurança. Quem decide é o protocolo do href.
 */
function LinkDoRodape({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const classe =
    "text-sm text-chalk-dim transition-colors hover:text-flame-soft";

  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classe}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classe}>
      {children}
    </Link>
  );
}
