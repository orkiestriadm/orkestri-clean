"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Modal, SearchInput, StatusBadge, TableCard, EmptyState, type BadgeTone } from "@/components/data-ui";
import { Link2, X, Unlink } from "lucide-react";

/**
 * Administrador × Microsoft 365: todos os usuários da organização e a situação
 * da integração de cada um. "Integrar 365" libera; a pessoa recebe o aviso e
 * conecta a própria conta uma vez. Pedidos pendentes aparecem primeiro.
 */

type Usuario = {
  id: string;
  nome: string;
  email: string;
  acesso: "nenhum" | "pendente" | "liberado" | "recusado" | "removido";
  solicitadoEm: string | null;
  conexao: { status: string; email: string | null; lastSyncAt: string | null } | null;
};

type Filtro = "todos" | "pedidos" | "liberados" | "conectados";

function situacao(u: Usuario): { label: string; tone: BadgeTone } {
  if (u.conexao?.status === "REAUTH_REQUIRED") return { label: "Precisa reconectar", tone: "atencao" };
  if (u.conexao?.status === "ERROR") return { label: "Erro na sincronização", tone: "critico" };
  if (u.conexao) return { label: "Conectado", tone: "ok" };
  switch (u.acesso) {
    case "pendente": return { label: "Pediu integração", tone: "atencao" };
    case "liberado": return { label: "Liberado — falta conectar", tone: "info" };
    case "recusado": return { label: "Recusado", tone: "neutro" };
    case "removido": return { label: "Removido", tone: "neutro" };
    default: return { label: "Sem integração", tone: "neutro" };
  }
}

function quando(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export default function UsuariosMicrosoft365Modal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await api.get<Usuario[]>("/integracoes/microsoft/usuarios");
      setUsuarios(data || []);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não foi possível carregar os usuários.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (aberto) carregar(); }, [aberto, carregar]);

  const decidir = async (u: Usuario, acao: "liberar" | "recusar" | "remover") => {
    if (acao === "remover" && !confirm(`Remover a integração de ${u.nome}? A conta Microsoft é desconectada e os compromissos futuros do Outlook saem da agenda dele (o histórico fica).`)) return;
    setOcupado(u.id + acao);
    setErro(null);
    try {
      await api.post(`/integracoes/microsoft/usuarios/${u.id}/${acao}`);
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não foi possível concluir a ação.");
    } finally { setOcupado(null); }
  };

  const contagem = useMemo(() => ({
    pedidos: usuarios.filter(u => u.acesso === "pendente" && !u.conexao).length,
    liberados: usuarios.filter(u => u.acesso === "liberado" && !u.conexao).length,
    conectados: usuarios.filter(u => !!u.conexao).length,
  }), [usuarios]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const peso = (u: Usuario) => (u.acesso === "pendente" && !u.conexao ? 0 : 1);
    return usuarios
      .filter(u => !termo || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo))
      .filter(u => filtro === "todos"
        || (filtro === "pedidos" && u.acesso === "pendente" && !u.conexao)
        || (filtro === "liberados" && u.acesso === "liberado" && !u.conexao)
        || (filtro === "conectados" && !!u.conexao))
      .sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [usuarios, busca, filtro]);

  const chips: { id: Filtro; label: string }[] = [
    { id: "todos", label: `Todos (${usuarios.length})` },
    { id: "pedidos", label: `Pedidos (${contagem.pedidos})` },
    { id: "liberados", label: `Liberados (${contagem.liberados})` },
    { id: "conectados", label: `Conectados (${contagem.conectados})` },
  ];

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      largura={920}
      titulo="Usuários e Microsoft 365"
      subtitulo="Libere quem pode integrar a agenda do Space com o Outlook. Depois de liberado, o próprio usuário conecta a conta uma vez."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Filtrar usuários">
            {chips.map(c => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={filtro === c.id}
                onClick={() => setFiltro(c.id)}
                className={filtro === c.id ? "btn btn-primary" : "btn btn-ghost"}
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <div style={{ padding: "9px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}>{erro}</div>
        )}

        <TableCard>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Situação</th>
              <th>Conta Microsoft</th>
              <th style={{ textAlign: "right" }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {carregando && !usuarios.length ? (
              <tr><td colSpan={4} style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Carregando usuários…</td></tr>
            ) : !lista.length ? (
              <EmptyState colSpan={4} title="Nenhum usuário neste filtro" />
            ) : lista.map(u => {
              const s = situacao(u);
              const divergente = !!(u.conexao?.email && u.conexao.email.toLowerCase() !== u.email.toLowerCase());
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{u.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{u.email}</div>
                  </td>
                  <td>
                    <StatusBadge label={s.label} tone={s.tone} />
                    {u.acesso === "pendente" && !u.conexao && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>pedido em {quando(u.solicitadoEm)}</div>
                    )}
                  </td>
                  <td>
                    {u.conexao ? (
                      <>
                        <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>{u.conexao.email || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>sincronizado {quando(u.conexao.lastSyncAt)}</div>
                        {divergente && (
                          <div style={{ fontSize: 11, color: "var(--accent-amber, #f59e0b)", marginTop: 2 }}>e-mail diferente do cadastro</div>
                        )}
                      </>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {!u.conexao && u.acesso !== "liberado" && (
                        <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
                          disabled={!!ocupado} onClick={() => decidir(u, "liberar")}>
                          <Link2 size={13} /> Integrar 365
                        </button>
                      )}
                      {u.acesso === "pendente" && !u.conexao && (
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
                          disabled={!!ocupado} onClick={() => decidir(u, "recusar")}>
                          <X size={13} /> Recusar
                        </button>
                      )}
                      {(u.conexao || u.acesso === "liberado") && (
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-red)" }}
                          disabled={!!ocupado} onClick={() => decidir(u, "remover")}>
                          <Unlink size={13} /> Remover integração
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      </div>
    </Modal>
  );
}
