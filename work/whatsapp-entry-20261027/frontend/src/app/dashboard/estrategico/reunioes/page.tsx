"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied, StatusBadge,
  RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Presentation, Plus, Trash2 } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { ReuniaoResumo, Filtros } from "@/lib/estrategico/types";
import { BASE, pode, mensagemErro, Nota } from "../_components/comuns";

const ROTULO_STATUS: Record<string, [string, "neutro" | "info" | "ok" | "atencao"]> = {
  planejada: ["Planejada", "info"], em_andamento: ["Em andamento", "atencao"], encerrada: ["Encerrada", "ok"], cancelada: ["Cancelada", "neutro"],
};

export default function ReunioesPage() {
  const user = useAuthStore(s => s.user);
  const router = useRouter();
  const [lista, setLista] = useState<ReuniaoResumo[] | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);
  const toast = useToastStore();
  const conduz = pode(user, "estrategico.reuniao:conduzir");

  const carregar = useCallback(async () => {
    setErro(null);
    try { setLista(await estrategicoService.reunioes()); }
    catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar as reuniões."));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(r: ReuniaoResumo) {
    const aviso = [
      `Excluir a reunião "${r.titulo}"?`,
      r._count.decisoes ? `${r._count.decisoes} decisão(ões) já registrada(s) continuam nos assuntos.` : null,
      r.status === "encerrada"
        ? "A ata deixa de aparecer na lista; o painel passa a comparar com a reunião encerrada anterior."
        : "Os compromissos futuros desta reunião saem da agenda dos participantes.",
    ].filter(Boolean).join("\n\n");
    if (!confirm(aviso)) return;
    try {
      const res = await estrategicoService.excluirReuniao(r.id);
      toast.success("Reunião excluída", res.compromissosMantidos
        ? `${res.compromissosMantidos} compromisso(s) sincronizado(s) com calendário externo foram mantidos — remova pela agenda.`
        : undefined);
      carregar();
    } catch (e) {
      toast.error("Não foi possível excluir", mensagemErro(e, ""));
    }
  }
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader
            icon={<Presentation size={19} />}
            title="Reuniões Estratégicas"
            subtitle="Pauta gerada dos dados: críticos, vencidos, sem atualização, o que mudou, oportunidades novas, decisões e ações pendentes"
            actions={pode(user, "estrategico.reuniao:conduzir") ? <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}><Plus size={14} /> Nova reunião</button> : undefined}
          />
          {semPermissao ? <PermissionDenied /> : erro ? <ErrorState detail={erro} onRetry={carregar} /> : (
            <TableCard>
              <thead><tr><th>Data</th><th>Reunião</th><th>Participantes</th><th>Decisões</th><th>Status</th>{conduz && <th />}</tr></thead>
              <tbody>
                {lista == null ? <LoadingRows colSpan={conduz ? 6 : 5} /> : lista.length === 0 ? (
                  <EmptyState colSpan={conduz ? 6 : 5} title="Nenhuma reunião ainda" hint="A primeira pauta considera os últimos 30 dias; as seguintes, o que mudou desde a anterior." />
                ) : lista.map(r => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`${BASE}/reunioes/${r.id}`)}>
                    <td className="num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(r.dataReuniao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{r.titulo}{r.local && <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{r.local}</div>}</td>
                    <td style={{ fontSize: 12 }}>{(r.participantes ?? []).map(p => p.nome).join(", ") || "—"}</td>
                    <td className="num">{r._count.decisoes}</td>
                    <td><StatusBadge label={ROTULO_STATUS[r.status]?.[0] ?? r.status} tone={ROTULO_STATUS[r.status]?.[1] ?? "neutro"} /></td>
                    {conduz && (
                      <td onClick={e => e.stopPropagation()}>
                        <RowActions>
                          <RowAction tone="danger" title="Excluir reunião" onClick={() => excluir(r)}><Trash2 size={13} /></RowAction>
                        </RowActions>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
          <NovaReuniaoModal aberto={criando} filtros={filtros} onFechar={() => setCriando(false)} onCriada={id => router.push(`${BASE}/reunioes/${id}`)} />
        </PageBody>
      </div>
    </div>
  );
}

function NovaReuniaoModal({ aberto, filtros, onFechar, onCriada }: { aberto: boolean; filtros: Filtros | null; onFechar: () => void; onCriada: (id: string) => void }) {
  const toast = useToastStore();
  const agora = new Date();
  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState("");
  const [local, setLocal] = useState("");
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [externos, setExternos] = useState("");
  const [agendar, setAgendar] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const mes = agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    setTitulo(`Reunião Estratégica — ${mes}`);
    const d = new Date(agora.getTime() + 86_400_000);
    d.setHours(9, 0, 0, 0);
    setQuando(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T09:00`);
    setLocal(""); setUsuarios([]); setExternos(""); setAgendar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function criar() {
    if (!titulo.trim() || !quando) { toast.error("Informe título e data"); return; }
    setSalvando(true);
    try {
      const participantes = [
        ...usuarios.map(id => ({ userId: id, nome: filtros?.usuarios.find(u => u.id === id)?.nome ?? "" })),
        ...externos.split("\n").map(n => n.trim()).filter(Boolean).map(nome => ({ nome })),
      ];
      const r = await estrategicoService.criarReuniao({ titulo: titulo.trim(), dataReuniao: new Date(quando).toISOString(), local: local.trim() || undefined, participantes, agendar });
      toast.success("Reunião criada", "A pauta foi gerada a partir dos dados atuais.");
      onCriada(r.id);
    } catch (e) { toast.error("Não foi possível criar", mensagemErro(e, "")); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo="Nova Reunião Estratégica" subtitulo="A pauta é gerada automaticamente ao criar" onFechar={onFechar} largura={640}>
      <FormGrid min={220}>
        <FormField label="Título" obrigatorio largura="total"><input className="input-o" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200} /></FormField>
        <FormField label="Data e hora" obrigatorio><input type="datetime-local" className="input-o" value={quando} onChange={e => setQuando(e.target.value)} /></FormField>
        <FormField label="Local"><input className="input-o" value={local} onChange={e => setLocal(e.target.value)} maxLength={200} /></FormField>
        <FormField label="Participantes com login" largura="total">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", maxHeight: 150, overflowY: "auto" }}>
            {(filtros?.usuarios ?? []).map(u => (
              <label key={u.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
                <input type="checkbox" checked={usuarios.includes(u.id)} onChange={e => setUsuarios(e.target.checked ? [...usuarios, u.id] : usuarios.filter(x => x !== u.id))} />
                {u.nome}
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Outros participantes" largura="total" dica="Um nome por linha (sem login no sistema)">
          <textarea className="input-o" rows={2} value={externos} onChange={e => setExternos(e.target.value)} />
        </FormField>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, gridColumn: "1 / -1" }}>
          <input type="checkbox" checked={agendar} onChange={e => setAgendar(e.target.checked)} />
          Colocar na agenda de cada participante com login
        </label>
      </FormGrid>
      <Nota>A pauta considera o que mudou desde a última reunião encerrada (ou os últimos 30 dias, se for a primeira).</Nota>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={criar} disabled={salvando}>{salvando ? "Gerando pauta…" : "Criar e gerar pauta"}</button>
      </FormActions>
    </Modal>
  );
}
