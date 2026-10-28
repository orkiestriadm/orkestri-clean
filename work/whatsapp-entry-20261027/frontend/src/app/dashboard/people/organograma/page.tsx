"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { orgService, NoOrganograma } from "@/lib/people/org.service";
import {
  PageBody, BackLink, PageHeader, Panel, ErrorState, PermissionDenied,
} from "@/components/data-ui";
import { Network, ChevronRight, ChevronDown, Users } from "lucide-react";

/**
 * Organograma.
 *
 * Montado pela hierarquia de GESTOR, não por setor: setor diz onde a pessoa
 * está lotada, gestor diz a quem ela responde — e é a segunda pergunta que o
 * organograma existe para responder.
 *
 * Quem não tem gestor, ou cujo gestor está fora do escopo visível, aparece
 * como raiz. Some-lo seria pior: o subordinado de alguém invisível sumiria da
 * árvore inteira.
 */

export default function OrganogramaPage() {
  const [raizes, setRaizes] = useState<NoOrganograma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setRaizes(await orgService.organograma());
    } catch (e: any) {
      setRaizes([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar o organograma.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function alternar(id: string) {
    setRecolhidos(r => {
      const novo = new Set(r);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const total = contar(raizes);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<Network size={19} />}
            title="Organograma"
            subtitle={`${total} ${total === 1 ? "colaborador ativo" : "colaboradores ativos"} por linha de reporte`}
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o organograma." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando ? (
            <span className="skeleton" style={{ display: "block", height: 320, borderRadius: 16 }} />
          ) : raizes.length === 0 ? (
            <Panel title="ORGANOGRAMA">
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <Users size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  Nenhum colaborador ativo no seu escopo. O organograma se monta
                  sozinho conforme os colaboradores recebem um gestor no cadastro.
                </p>
              </div>
            </Panel>
          ) : (
            <Panel title="LINHA DE REPORTE">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {raizes.map(no => (
                  <No
                    key={no.id}
                    no={no}
                    nivel={0}
                    recolhidos={recolhidos}
                    onAlternar={alternar}
                  />
                ))}
              </div>
            </Panel>
          )}
        </PageBody>
      </div>
    </div>
  );
}

function No({
  no, nivel, recolhidos, onAlternar,
}: {
  no: NoOrganograma;
  nivel: number;
  recolhidos: Set<string>;
  onAlternar: (id: string) => void;
}) {
  const temFilhos = no.filhos.length > 0;
  const aberto = !recolhidos.has(no.id);

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 8px", borderRadius: 9,
          // O recuo é a única pista de profundidade: a borda à esquerda
          // reforça sem transformar a lista numa árvore de linhas cruzadas.
          marginLeft: nivel * 22,
          borderLeft: nivel > 0 ? "2px solid var(--border-subtle)" : "none",
          paddingLeft: nivel > 0 ? 12 : 8,
        }}
      >
        {temFilhos ? (
          <button
            type="button"
            onClick={() => onAlternar(no.id)}
            aria-label={aberto ? "Recolher" : "Expandir"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: 5, cursor: "pointer",
              background: "none", border: "none", color: "var(--text-muted)", padding: 0,
            }}
          >
            {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 18 }} />
        )}

        <Link
          href={`/dashboard/people/${no.id}`}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
        >
          {no.nomeExibicao}
        </Link>

        {no.cargo && (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{no.cargo}</span>
        )}
        {no.setor?.nome && (
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>· {no.setor.nome}</span>
        )}
        {temFilhos && (
          <span
            className="num"
            style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}
          >
            {no.filhos.length} {no.filhos.length === 1 ? "liderado" : "liderados"}
          </span>
        )}
      </div>

      {aberto && no.filhos.map(f => (
        <No key={f.id} no={f} nivel={nivel + 1} recolhidos={recolhidos} onAlternar={onAlternar} />
      ))}
    </>
  );
}

function contar(nos: NoOrganograma[]): number {
  return nos.reduce((total, n) => total + 1 + contar(n.filhos), 0);
}
