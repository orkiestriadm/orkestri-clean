"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToastStore } from "@/lib/toast";
import {
  employeesService, DadosColaborador, ColaboradorDetalhe, StatusColaborador,
} from "@/lib/people/employees.service";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";

/**
 * Cadastro e edição de colaborador.
 *
 * O vínculo com usuário é opcional e a escolha muda o que é obrigatório:
 * com usuário, o nome vem dele; sem usuário, o nome próprio passa a ser
 * exigido — senão não há como exibir a pessoa em lugar nenhum.
 * Ver docs/people/ADR-001.
 */

type Props = {
  aberto: boolean;
  colaborador?: ColaboradorDetalhe | null;
  onFechar: () => void;
  onSalvo: () => void;
};

type Opcao = { id: string; nome: string };

const SITUACOES: { value: StatusColaborador; label: string }[] = [
  { value: "ATIVO", label: "Ativo" },
  { value: "AFASTADO", label: "Afastado" },
  { value: "SUSPENSO", label: "Suspenso" },
  { value: "INATIVO", label: "Inativo" },
];

const VINCULOS = ["CLT", "PJ", "Estágio", "Aprendiz", "Temporário", "Terceirizado"];
const SENIORIDADES = ["Júnior", "Pleno", "Sênior", "Especialista", "Liderança"];

/** ISO do backend → `yyyy-MM-dd` que o `input[type=date]` exige. */
const paraInputDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export default function ColaboradorForm({ aberto, colaborador, onFechar, onSalvo }: Props) {
  const editando = !!colaborador;

  const [form, setForm] = useState<DadosColaborador>({});
  const [comAcesso, setComAcesso] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const [usuarios, setUsuarios] = useState<Opcao[]>([]);
  const [setores, setSetores] = useState<Opcao[]>([]);
  const [gestores, setGestores] = useState<{ id: string; nomeExibicao: string }[]>([]);
  const [cargos, setCargos] = useState<{ id: string; titulo: string; ativo: boolean }[]>([]);

  // Repovoa a cada abertura: reaproveitar estado entre aberturas já vazou
  // dado de um registro para o outro em telas parecidas.
  useEffect(() => {
    if (!aberto) return;
    setErros({});
    if (colaborador) {
      setComAcesso(!!colaborador.userId);
      setForm({
        nomeCompleto: colaborador.nomeCompleto ?? "",
        matricula: colaborador.matricula ?? "",
        emailCorporativo: colaborador.emailCorporativo ?? "",
        emailPessoal: colaborador.emailPessoal ?? "",
        telefone: colaborador.telefone ?? "",
        celular: colaborador.celular ?? "",
        dataNascimento: paraInputDate(colaborador.dataNascimento),
        dataAdmissao: paraInputDate(colaborador.dataAdmissao),
        genero: colaborador.genero ?? "",
        estadoCivil: colaborador.estadoCivil ?? "",
        nacionalidade: colaborador.nacionalidade ?? "",
        cargo: colaborador.cargo ?? "",
        positionId: colaborador.position?.id ?? "",
        setorId: colaborador.setor?.id ?? "",
        gestorId: colaborador.gestor?.id ?? "",
        senioridade: colaborador.senioridade ?? "",
        squad: colaborador.squad ?? "",
        tipoVinculo: colaborador.tipoVinculo ?? "",
        jornadaHorasDia: colaborador.jornadaHorasDia ?? undefined,
        turno: colaborador.turno ?? "",
        escala: colaborador.escala ?? "",
      });
    } else {
      setComAcesso(false);
      setForm({ status: "ATIVO" });
    }
  }, [aberto, colaborador]);

  // Combos de apoio: `silent` porque falta de permissão num cadastro auxiliar
  // não deve encher a tela de alerta vermelho.
  useEffect(() => {
    if (!aberto) return;
    api.get("/setores", { silent: true })
      .then(r => setSetores(r.data ?? [])).catch(() => setSetores([]));
    api.get("/v1/people/employees", { params: { tamanho: 200, status: "ATIVO" }, silent: true })
      .then(r => setGestores(r.data?.data ?? [])).catch(() => setGestores([]));
    api.get("/v1/people/cargos", { silent: true })
      .then(r => setCargos(r.data?.data ?? [])).catch(() => setCargos([]));
    if (!editando) {
      // `picklist` e não `/users`: aquele exige `usuarios:ver`, permissão de
      // administrar contas que um analista de RH não precisa ter para escolher
      // a quem vincular o colaborador.
      api.get("/users/picklist", { silent: true })
        .then(r => setUsuarios(r.data ?? [])).catch(() => setUsuarios([]));
    }
  }, [aberto, editando]);

  const gestoresDisponiveis = useMemo(
    () => gestores.filter(g => g.id !== colaborador?.id),
    [gestores, colaborador?.id],
  );

  /**
   * Cargo desativado some da lista, menos se for o do próprio colaborador —
   * senão editar o telefone de alguém apagaria o cargo dele sem querer.
   */
  const cargosAtivos = useMemo(
    () => cargos.filter(c => c.ativo || c.id === colaborador?.position?.id),
    [cargos, colaborador?.position?.id],
  );

  function alterar<K extends keyof DadosColaborador>(campo: K, valor: DadosColaborador[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => (e[campo as string] ? { ...e, [campo as string]: "" } : e));
  }

  /** Valida no cliente só o que dá para saber sem ir ao servidor. */
  function validar(): boolean {
    const novos: Record<string, string> = {};

    if (!editando && comAcesso && !form.userId) {
      novos.userId = "Escolha o usuário do sistema";
    }
    if ((!comAcesso || editando) && !form.nomeCompleto?.trim()) {
      // Com usuário vinculado o nome pode vir dele; sem usuário, é obrigatório.
      if (!comAcesso) novos.nomeCompleto = "Informe o nome completo";
    }
    if (form.dataNascimento && new Date(form.dataNascimento) > new Date()) {
      novos.dataNascimento = "Data de nascimento no futuro";
    }
    if (form.dataAdmissao && form.dataNascimento
        && new Date(form.dataAdmissao) < new Date(form.dataNascimento)) {
      novos.dataAdmissao = "Admissão anterior ao nascimento";
    }

    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;

    setSalvando(true);
    try {
      const payload: DadosColaborador = { ...form };
      if (!editando && !comAcesso) delete payload.userId;

      if (editando) {
        await employeesService.atualizar(colaborador!.id, payload);
        useToastStore.getState().success("Colaborador atualizado");
      } else {
        await employeesService.criar(payload);
        useToastStore.getState().success("Colaborador cadastrado");
      }
      onSalvo();
      onFechar();
    } catch (err: any) {
      // O interceptor do axios já avisa 403/409/500. Aqui tratamos a regra de
      // negócio (400), que chega com mensagem específica do backend.
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        useToastStore.getState().error(
          "Não foi possível salvar",
          Array.isArray(msg) ? msg.join(". ") : msg,
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={editando ? "Editar colaborador" : "Novo colaborador"}
      subtitulo={editando ? colaborador?.nomeExibicao : "Dados básicos — o restante pode ser completado no perfil"}
      onFechar={onFechar}
      largura={720}
    >
      <form onSubmit={salvar} noValidate>
        {/* ── Vínculo com usuário ── */}
        {!editando && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <OpcaoAcesso
                ativa={!comAcesso}
                titulo="Sem acesso ao sistema"
                descricao="Aparece no quadro e nos relatórios, mas não faz login"
                onClick={() => { setComAcesso(false); alterar("userId", undefined); }}
              />
              <OpcaoAcesso
                ativa={comAcesso}
                titulo="Com acesso ao sistema"
                descricao="Vinculado a um usuário existente"
                onClick={() => setComAcesso(true)}
              />
            </div>
          </div>
        )}

        <FormGrid>
          {!editando && comAcesso && (
            <FormField label="Usuário do sistema" obrigatorio erro={erros.userId} largura="total">
              <select
                className="input-o"
                value={form.userId ?? ""}
                onChange={e => alterar("userId", e.target.value || undefined)}
              >
                <option value="">Selecione...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </FormField>
          )}

          <FormField
            label="Nome completo"
            obrigatorio={!comAcesso}
            erro={erros.nomeCompleto}
            dica={comAcesso ? "Se vazio, usa o nome do usuário vinculado" : undefined}
            largura="total"
          >
            <input
              className="input-o"
              value={form.nomeCompleto ?? ""}
              onChange={e => alterar("nomeCompleto", e.target.value)}
              placeholder="Maria Oliveira dos Santos"
            />
          </FormField>

          <FormField label="Matrícula" dica="Deixe vazio para gerar depois">
            <input className="input-o" value={form.matricula ?? ""} onChange={e => alterar("matricula", e.target.value)} />
          </FormField>

          <FormField label="Situação">
            <select className="input-o" value={form.status ?? "ATIVO"} onChange={e => alterar("status", e.target.value as StatusColaborador)}>
              {SITUACOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>

          <FormField label="E-mail corporativo">
            <input type="email" className="input-o" value={form.emailCorporativo ?? ""} onChange={e => alterar("emailCorporativo", e.target.value)} />
          </FormField>

          <FormField label="Celular">
            <input className="input-o" value={form.celular ?? ""} onChange={e => alterar("celular", e.target.value)} />
          </FormField>

          <FormField label="Data de nascimento" erro={erros.dataNascimento}>
            <input type="date" className="input-o" value={form.dataNascimento ?? ""} onChange={e => alterar("dataNascimento", e.target.value)} />
          </FormField>

          <FormField label="Data de admissão" erro={erros.dataAdmissao}>
            <input type="date" className="input-o" value={form.dataAdmissao ?? ""} onChange={e => alterar("dataAdmissao", e.target.value)} />
          </FormField>

          {/* Com catálogo, escolher. Sem catálogo, digitar — exigir o select
              antes de existir cargo cadastrado travaria o cadastro inteiro, e
              o que for digitado agora entra pela importação depois. */}
          <FormField
            label="Cargo"
            dica={cargosAtivos.length === 0 ? "Cadastre cargos para padronizar" : undefined}
          >
            {cargosAtivos.length > 0 ? (
              <select
                className="input-o"
                value={form.positionId ?? ""}
                onChange={e => alterar("positionId", e.target.value)}
              >
                <option value="">—</option>
                {cargosAtivos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            ) : (
              <input
                className="input-o"
                value={form.cargo ?? ""}
                onChange={e => alterar("cargo", e.target.value)}
                placeholder="Analista de Sistemas"
              />
            )}
          </FormField>

          <FormField label="Senioridade">
            <select className="input-o" value={form.senioridade ?? ""} onChange={e => alterar("senioridade", e.target.value)}>
              <option value="">—</option>
              {SENIORIDADES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          <FormField label="Setor">
            <select className="input-o" value={form.setorId ?? ""} onChange={e => alterar("setorId", e.target.value)}>
              <option value="">—</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </FormField>

          <FormField label="Gestor">
            <select className="input-o" value={form.gestorId ?? ""} onChange={e => alterar("gestorId", e.target.value)}>
              <option value="">—</option>
              {gestoresDisponiveis.map(g => <option key={g.id} value={g.id}>{g.nomeExibicao}</option>)}
            </select>
          </FormField>

          <FormField label="Tipo de vínculo">
            <select className="input-o" value={form.tipoVinculo ?? ""} onChange={e => alterar("tipoVinculo", e.target.value)}>
              <option value="">—</option>
              {VINCULOS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </FormField>

          <FormField label="Jornada (horas/dia)">
            <input
              type="number" min={1} max={24} step={0.5} className="input-o"
              value={form.jornadaHorasDia ?? ""}
              onChange={e => alterar("jornadaHorasDia", e.target.value ? Number(e.target.value) : undefined)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function OpcaoAcesso({
  ativa, titulo, descricao, onClick,
}: { ativa: boolean; titulo: string; descricao: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      style={{
        flex: 1, minWidth: 200, textAlign: "left", cursor: "pointer",
        padding: "11px 14px", borderRadius: 12,
        background: ativa ? "var(--accent-violet-dim)" : "var(--bg-secondary)",
        border: `1px solid ${ativa ? "var(--accent-violet)" : "var(--border-subtle)"}`,
        transition: "border-color .2s ease, background .2s ease",
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ativa ? "var(--accent-violet)" : "var(--text-primary)" }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{descricao}</div>
    </button>
  );
}
