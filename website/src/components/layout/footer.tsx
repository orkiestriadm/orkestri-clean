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

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-gray-500">
              Construindo plataformas inteligentes para empresas que desejam
              crescer através da tecnologia.
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>

          {footerNav.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-dark">
                {col.title}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-500 transition-colors hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 text-sm text-gray-400 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName}. Todos os
            direitos reservados.
          </p>
          <p className="flex items-center gap-2">
            Engineering Business Growth.
            {/* Versão discreta: serve de referência ao relatar problema, sem
                disputar atenção com o conteúdo do rodapé. */}
            <span className="text-gray-300" title={"Site " + VERSAO_SITE + " · " + VERSAO_SITE_DATA}>
              v{VERSAO_SITE}
            </span>
          </p>
        </div>
      </Container>
    </footer>
  );
}
