/**
 * O `*negrito*` do WhatsApp, resolvido sem biblioteca.
 *
 * Os roteiros em `config/aurelia.ts` são escritos na mesma marcação que a
 * Aurélia usa de verdade, então a amostra sai com a cara da conversa real.
 *
 * Vive aqui, e não dentro de um dos componentes, porque a demonstração
 * clicável e a linha do tempo precisam do mesmo tratamento — duas cópias
 * acabariam divergindo na primeira vez que alguém mexesse numa delas.
 */
export function negrito(texto: string) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <strong key={i} className="font-semibold text-chalk">
        {parte.slice(1, -1)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}
