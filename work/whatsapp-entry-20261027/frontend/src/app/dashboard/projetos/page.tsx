import ProjetosView from "./_components/ProjetosView";

/** Fila de projetos em andamento. Os que chegam a 100% vão para /concluidos. */
export default function ProjetosPage() {
  return <ProjetosView modo="ativos" />;
}
