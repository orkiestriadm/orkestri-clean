import Link from "next/link";
import { Linkedin, Github, Instagram } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { VERSAO_SITE, VERSAO_SITE_DATA } from "@/lib/version";

const socials = [
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: Linkedin },
  { label: "GitHub", href: siteConfig.social.github, icon: Github },
  { label: "Instagram", href: siteConfig.social.instagram, icon: Instagram },
];

/**
 * Rodapé — escuro em TODAS as páginas, com 6 colunas alinhadas em uma única
 * linha no desktop (`lg:grid-cols-[1.45fr_repeat(5,minmax(0,1fr))]`), evitando
 * que a última coluna ("Contato") quebre sozinha para uma segunda fileira.
 */
export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-ink">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.45fr_repeat(5,minmax(0,1fr))] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-4 sm:col-span-2 md:col-span-3 lg:col-span-1">
            <Logo tone="light" />
            <p className="max-w-[28ch] text-sm leading-relaxed text-chalk-dim">
              A sua agenda, as suas contas e os seus projetos num lugar só — com
              aviso no WhatsApp na hora em que ainda dá tempo.
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.02] text-chalk-dim transition-all duration-200 hover:border-flame/50 hover:bg-flame/[0.08] hover:text-flame-soft"
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          {footerNav.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <span className="text-[0.8125rem] font-semibold tracking-wide text-chalk">
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
            Sua rotina, no ritmo certo.
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
