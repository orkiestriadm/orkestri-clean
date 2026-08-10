"use client";
export const dynamic = "force-dynamic";

import { MARCA } from "@/lib/marca";
import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { VERSAO, VERSAO_DATA, VERSAO_NOME, HISTORICO } from "@/lib/version";
import { PageBody, PageHeader, Panel, PermissionDenied } from "@/components/data-ui";
import { Info, Copy, Check } from "lucide-react";
import { useAuthStore } from "@/lib/store";

/**
 * Sobre — versão do sistema.
 *
 * Serve a um propósito prático: dar referência exata ao relatar problema.
 *
 * O botão de copiar leva a versão da TELA e a da API juntas. Se as duas
 * divergirem, o deploy saiu pela metade — e essa é a primeira hipótese a
 * descartar em qualquer diagnóstico, antes de procurar bug no código.
 *
 * RESTRITA A MASTER/SA. A verificação mora aqui e não só no menu: esconder o
 * link não fecha a porta, e `/dashboard/sobre` continuaria abrindo para quem
 * digitasse a URL ou tivesse o atalho salvo.
 *
 * Isto é ocultação de tela, não proteção de dado: a versão da API segue
 * respondendo em `GET /api/health` sem autenticação, como um health check exige.
 */

const fmtData = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

export default function SobrePage() {
  const user = useAuthStore(s => s.user);
  const [versaoApi, setVersaoApi] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const permitido = !!user?.isMaster || !!user?.isSuperAdmin;

  useEffect(() => {
    if (!permitido) return;
    // `silent`: a tela continua útil mesmo se a API não responder.
    api.get("/health", { silent: true })
      .then(r => setVersaoApi(r.data?.version ?? null))
      .catch(() => setVersaoApi(null));
  }, [permitido]);

  const divergente = !!versaoApi && versaoApi !== VERSAO;

  async function copiar() {
    const texto =
      `${MARCA} — sistema ${VERSAO} (${VERSAO_DATA})\n` +
      `API: ${versaoApi ?? "não respondeu"}\n` +
      `Navegador: ${navigator.userAgent}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* área de transferência bloqueada: os números estão visíveis na tela */
    }
  }

  if (!permitido) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <PageBody>
            <PageHeader
              icon={<Info size={19} />}
              title="Sobre"
              subtitle="Restrito à administração do sistema"
            />
            <PermissionDenied hint="Esta tela é restrita ao master da organização. Para informar a versão ao relatar um problema, peça a um administrador." />
          </PageBody>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <PageHeader
            icon={<Info size={19} />}
            title={`Sobre o ${MARCA}`}
            subtitle="Versão em uso e o que mudou em cada entrega"
            actions={
              <button type="button" className="btn btn-ghost" onClick={copiar}>
                {copiado ? <Check size={14} /> : <Copy size={14} />}
                {copiado ? "Copiado" : "Copiar dados da versão"}
              </button>
            }
          />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Cartao rotulo="Sistema" valor={VERSAO} nota={fmtData(VERSAO_DATA)} destaque />
            <Cartao
              rotulo="API"
              valor={versaoApi ?? "—"}
              nota={
                versaoApi === null ? "sem resposta"
                  : divergente ? "divergente"
                  : "igual ao sistema"
              }
              alerta={divergente}
            />
            <Cartao rotulo="Entrega" valor={VERSAO_NOME} nota={`desde ${fmtData(VERSAO_DATA)}`} />
          </div>

          {divergente && (
            <div
              style={{
                padding: "13px 15px", borderRadius: 14, marginBottom: 16,
                background: "color-mix(in srgb, var(--accent-amber) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
                fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>Versões diferentes.</strong>{" "}
              A tela está na <span className="metric">{VERSAO}</span> e a API na{" "}
              <span className="metric">{versaoApi}</span>. Isso indica deploy incompleto —
              parte do sistema pode se comportar de forma inesperada. Informe os dois
              números ao relatar qualquer problema.
            </div>
          )}

          <Panel title="O QUE MUDOU">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {HISTORICO.map(v => (
                <div key={v.versao}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span className="metric" style={{ fontSize: 15, fontWeight: 700 }}>{v.versao}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{v.titulo}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{fmtData(v.data)}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {v.itens.map(item => (
                      <li key={item} style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </PageBody>
      </div>
    </div>
  );
}

function Cartao({
  rotulo, valor, nota, destaque, alerta,
}: {
  rotulo: string; valor: string; nota: string; destaque?: boolean; alerta?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 18px", borderRadius: 14, minWidth: 175,
        background: "var(--bg-secondary)",
        border: `1px solid ${
          alerta ? "color-mix(in srgb, var(--accent-amber) 35%, transparent)" : "var(--border-subtle)"
        }`,
      }}
    >
      <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 6 }}>{rotulo}</div>
      <div
        className="metric"
        style={{
          fontSize: 22, fontWeight: 600,
          color: alerta ? "var(--accent-amber)" : destaque ? "var(--accent-violet)" : undefined,
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{nota}</div>
    </div>
  );
}
