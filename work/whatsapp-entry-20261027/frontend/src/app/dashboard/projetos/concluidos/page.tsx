import ProjetosView from "../_components/ProjetosView";

/** Projetos Concluídos: os que chegaram a 100%. Reabrir uma tarefa devolve à fila. */
export default function ProjetosConcluidosPage() {
  return <ProjetosView modo="concluidos" />;
}
