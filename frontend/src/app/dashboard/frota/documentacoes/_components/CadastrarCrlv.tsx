"use client";
/**
 * Cadastro de documento a partir do CRLV.
 *
 * O PDF é o ponto de partida: o sistema lê a placa, acha o veículo e só então
 * abre a conferência. Nada é gravado antes de o usuário olhar — leitura errada
 * de PDF viraria cadastro errado sem essa parada.
 *
 * Duas saídas travadas de propósito:
 *   - sem veículo com aquela placa não dá para seguir (o vínculo é obrigatório
 *     no schema, e deduzir veículo a partir do CRLV inventaria frota);
 *   - sem estado escolhido não dá para gravar (é o estado que decide a regra de
 *     vencimento do licenciamento).
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { FileUp, AlertTriangle, CheckCircle2, X, Loader2, ArrowRight } from "lucide-react";

type Lido = Record<string, string | null>;
type Analise = {
  lido: Lido;
  veiculo: any | null;
  encontrado: boolean;
  vencimentoSeSP: string | null;
  ufs: { sigla: string; nome: string }[];
};

const fmtData = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export default function CadastrarCrlv({ aoSalvar }: { aoSalvar: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semVeiculo, setSemVeiculo] = useState<string | null>(null);
  const [faltaEstado, setFaltaEstado] = useState(false);

  const [uf, setUf] = useState("");
  const [vencimento, setVencimento] = useState("");

  const escolher = () => { setErro(null); inputRef.current?.click(); };

  const analisar = async (f: File) => {
    setArquivo(f); setLendo(true); setErro(null); setAnalise(null);
    const fd = new FormData(); fd.append("file", f);
    try {
      const { data } = await api.post<Analise>("/frota/documentos/crlv/analisar", fd);
      if (!data.encontrado) { setSemVeiculo(data.lido?.placa || "(placa ilegivel)"); return; }
      setAnalise(data);
      // Estado sempre em branco: o DETRAN emissor do CRLV nem sempre é o estado
      // onde o veículo está registrado, então quem decide é o usuário.
      setUf("");
      setVencimento("");
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não consegui ler este PDF.");
    } finally { setLendo(false); }
  };

  // Trocar o estado é o que revela (ou apaga) o vencimento automático.
  const trocarUf = (novo: string) => {
    setUf(novo);
    setFaltaEstado(false);
    setVencimento(novo === "SP" ? fmtData(analise?.vencimentoSeSP) : "");
  };

  const salvar = async () => {
    if (!uf) { setFaltaEstado(true); return; }
    if (!arquivo || !analise?.veiculo) return;
    setSalvando(true); setErro(null);
    const fd = new FormData();
    fd.append("file", arquivo);
    fd.append("veiculoId", analise.veiculo.id);
    fd.append("uf", uf);
    if (vencimento) fd.append("dataVencimento", new Date(vencimento).toISOString());
    try {
      await api.post("/frota/documentos/crlv", fd);
      fechar();
      aoSalvar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não consegui salvar.");
    } finally { setSalvando(false); }
  };

  const fechar = () => {
    setArquivo(null); setAnalise(null); setErro(null);
    setUf(""); setVencimento(""); setFaltaEstado(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const L = analise?.lido;
  const spComRegra = uf === "SP" && !!analise?.vencimentoSeSP;

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) analisar(f); }} />

      <button className="btn btn-violet" onClick={escolher} disabled={lendo}
        style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {lendo ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        {lendo ? "Lendo CRLV..." : "Cadastrar Documento"}
      </button>

      {erro && !analise && !semVeiculo && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent-red)" }}>{erro}</div>
      )}

      {semVeiculo && (
        <Modal aoFechar={() => setSemVeiculo(null)} largura={440}>
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <AlertTriangle size={40} style={{ color: "var(--accent-amber)", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Veículo Não encontrado, cadastre-o 1º
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              O CRLV é da placa <b style={{ fontFamily: "var(--font-mono)" }}>{semVeiculo}</b>, e não há veículo
              com essa placa cadastrado.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn" onClick={() => setSemVeiculo(null)} style={{ fontSize: 12 }}>Cancelar</button>
              <button className="btn btn-violet"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => router.push("/dashboard/frota/veiculos?novo=1")}>
                Continuar <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {analise?.veiculo && L && (
        <Modal aoFechar={fechar} largura={640}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <CheckCircle2 size={18} style={{ color: "var(--accent-green)" }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>CRLV lido — confira antes de salvar</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Vinculado a <b style={{ fontFamily: "var(--font-mono)" }}>{analise.veiculo.placa}</b>
            {analise.veiculo.modelo ? " — " + analise.veiculo.modelo : ""}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
            <Campo r="Placa" v={L.placa} mono />
            <Campo r="RENAVAM" v={L.renavam} mono />
            <Campo r="Exercício" v={L.exercicio} />
            <Campo r="Chassi" v={L.chassi} mono />
            <Campo r="Marca / Modelo" v={L.marcaModelo} />
            <Campo r="Cor" v={L.cor} />
            <Campo r="Ano fab. / modelo" v={[L.anoFabricacao, L.anoModelo].filter(Boolean).join(" / ")} />
            <Campo r="Combustível" v={L.combustivel} />
            <Campo r="Proprietário" v={L.proprietario} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={rotulo}>Estado onde o veículo está cadastrado *</label>
              <select value={uf} onChange={e => trocarUf(e.target.value)}
                style={{ ...campo, borderColor: faltaEstado ? "var(--accent-red)" : "var(--border-subtle)" }}>
                <option value="">Selecione...</option>
                {analise.ufs.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={rotulo}>Vencimento do licenciamento</label>
              <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                disabled={spComRegra} style={{ ...campo, opacity: spComRegra ? 0.75 : 1 }} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {spComRegra
                  ? "Calculado pela regra de SP (final da placa), último dia útil."
                  : uf
                    ? "Fora de SP não há regra automática — informe a data."
                    : "Escolha o estado primeiro."}
              </div>
            </div>
          </div>

          {erro && <div style={{ marginTop: 12, fontSize: 12, color: "var(--accent-red)" }}>{erro}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button className="btn" onClick={fechar} style={{ fontSize: 12 }}>Cancelar</button>
            <button className="btn btn-violet" onClick={salvar} disabled={salvando} style={{ fontSize: 12 }}>
              {salvando ? "Salvando..." : "Salvar documento"}
            </button>
          </div>
        </Modal>
      )}

      {faltaEstado && (
        <Modal aoFechar={() => setFaltaEstado(false)} largura={400}>
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-amber)", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>
              Selecione o estado onde o veículo está cadastrado
            </div>
            <button className="btn btn-violet" onClick={() => setFaltaEstado(false)} style={{ fontSize: 12 }}>
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

const rotulo: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5 };
const campo: React.CSSProperties = {
  width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 8,
  border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)",
};

function Campo({ r, v, mono }: { r: string; v?: string | null; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r}</div>
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: mono ? "var(--font-mono)" : undefined }}>{v || "—"}</div>
    </div>
  );
}

function Modal({ children, aoFechar, largura }: { children: React.ReactNode; aoFechar: () => void; largura: number }) {
  return (
    <div onClick={aoFechar} style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: largura, background: "var(--bg-card)", borderRadius: 14,
        border: "1px solid var(--border-subtle)", padding: 22, position: "relative",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <button onClick={aoFechar}
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
