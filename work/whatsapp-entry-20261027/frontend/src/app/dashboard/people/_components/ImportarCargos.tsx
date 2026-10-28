"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { positionsService, CargoSolto } from "@/lib/people/positions.service";
import { Modal, FormActions, StatusBadge } from "@/components/data-ui";
import { AlertTriangle } from "lucide-react";

/**
 * Importação dos cargos escritos à mão.
 *
 * Isto não roda numa migration de propósito: importar tudo automaticamente
 * transformaria cada erro de digitação histórico em um cargo do catálogo, que é
 * exatamente o problema que o catálogo existe para resolver.
 *
 * O que a tela acrescenta ao backend é a detecção de grafias que provavelmente
 * são o mesmo cargo — só sinalizada, nunca decidida por conta própria: só quem
 * conhece a organização sabe se "Analista N1" e "Analista N-1" são a mesma
 * coisa. O vínculo é por texto exato, então importar as duas mantém as duas.
 */

/** Minúsculas, sem acento, sem pontuação e com espaço colapsado. */
function normalizar(texto: string): string {
  return texto
    // ̀-ͯ: marcas de acentuação que o NFD separa da letra base.
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Props = {
  aberto: boolean;
  soltos: CargoSolto[];
  onFechar: () => void;
  onImportado: () => void;
};

export default function ImportarCargos({ aberto, soltos, onFechar, onImportado }: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    // Nada marcado por padrão: importar é decisão, não default.
    setMarcados(new Set());
  }, [aberto]);

  /** Títulos cuja forma normalizada colide com a de outro — provável variante. */
  const variantes = useMemo(() => {
    const porForma = new Map<string, string[]>();
    for (const s of soltos) {
      const chave = normalizar(s.cargo);
      porForma.set(chave, [...(porForma.get(chave) ?? []), s.cargo]);
    }
    const suspeitos = new Set<string>();
    for (const grupo of porForma.values()) {
      if (grupo.length > 1) grupo.forEach(t => suspeitos.add(t));
    }
    return suspeitos;
  }, [soltos]);

  function alternar(titulo: string) {
    setMarcados(m => {
      const novo = new Set(m);
      if (novo.has(titulo)) novo.delete(titulo);
      else novo.add(titulo);
      return novo;
    });
  }

  const pessoasMarcadas = soltos
    .filter(s => marcados.has(s.cargo))
    .reduce((total, s) => total + s.total, 0);

  async function importar() {
    if (marcados.size === 0) return;
    setImportando(true);
    try {
      const r = await positionsService.importar([...marcados]);
      const criados = r.data.filter(x => x.criado).length;
      const vinculados = r.data.reduce((s, x) => s + x.vinculados, 0);
      useToastStore.getState().success(
        "Cargos importados",
        `${criados} cargo(s) criado(s), ${vinculados} colaborador(es) vinculado(s).`,
      );
      onImportado();
      onFechar();
    } catch { /* interceptor */ } finally {
      setImportando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Importar cargos do cadastro antigo"
      subtitulo="Cada texto marcado vira um cargo do catálogo e recebe quem já o usa"
      onFechar={onFechar}
      largura={580}
    >
      {variantes.size > 0 && (
        <div
          style={{
            display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14,
            padding: "11px 13px", borderRadius: 10,
            background: "color-mix(in srgb, var(--accent-amber) 9%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
          }}
        >
          <AlertTriangle size={15} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Alguns títulos só diferem por acento, maiúscula ou pontuação. Se forem
            o mesmo cargo, importe <strong>um só</strong> e depois corrija os
            colaboradores do outro — importar os dois cria dois cargos.
          </span>
        </div>
      )}

      <div
        style={{
          maxHeight: 340, overflowY: "auto", borderRadius: 12,
          border: "1px solid var(--border-subtle)",
        }}
      >
        {soltos.map(s => (
          <label
            key={s.cargo}
            style={{
              display: "flex", alignItems: "center", gap: 11, cursor: "pointer",
              padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)",
              background: marcados.has(s.cargo) ? "var(--bg-hover)" : "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={marcados.has(s.cargo)}
              onChange={() => alternar(s.cargo)}
            />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
              {s.cargo}
            </span>
            {variantes.has(s.cargo) && <StatusBadge label="Grafia parecida" tone="atencao" />}
            <span className="num" style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {s.total} {s.total === 1 ? "pessoa" : "pessoas"}
            </span>
          </label>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
        {marcados.size === 0 ? (
          "Marque os títulos que devem virar cargos."
        ) : (
          <>
            <span className="metric">{marcados.size}</span>{" "}
            {marcados.size === 1 ? "cargo será criado" : "cargos serão criados"} e{" "}
            <span className="metric">{pessoasMarcadas}</span>{" "}
            {pessoasMarcadas === 1 ? "colaborador será vinculado" : "colaboradores serão vinculados"}.
          </>
        )}
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={importando}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={importar}
          disabled={importando || marcados.size === 0}
        >
          {importando ? "Importando..." : "Importar selecionados"}
        </button>
      </FormActions>
    </Modal>
  );
}
