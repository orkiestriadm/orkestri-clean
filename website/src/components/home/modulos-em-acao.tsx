"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { products } from "@/config/products";
import { Notebook } from "@/components/ui/notebook";

const pedidos: Record<string, string> = {
  "one-space": "Marca a visita de quinta às 10h.",
  "one-finance": "Gastei 45 reais no almoço no débito.",
  "one-projects": "Quais tarefas estão abertas no projeto?",
  "one-desk": "Abre um chamado para revisar o acesso.",
  "one-quality": "Procura o procedimento de integração.",
};
const modulos = products.filter(p => p.screenshot);

export function ModulosEmAcao() {
  const [ativo, selecionar] = useState(0);
  const produto = modulos[ativo];
  const Icon = produto.icon;
  return <section aria-label="Explore os módulos" className="module-studio">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Escolha uma aplicação">
      {modulos.map((p, i) => <button type="button" key={p.slug} aria-pressed={i === ativo} onClick={() => selecionar(i)} className="module-tab"><p.icon size={16} />{p.short ?? p.name}</button>)}
    </div>
    <div className="mt-8 grid items-center gap-8 md:grid-cols-[minmax(0,.68fr)_minmax(0,1.32fr)]" aria-live="polite">
      <div className="module-stack">
        <div className="module-card" key={produto.slug}>
          <Icon size={30} aria-hidden/><p className="mt-5 font-mono text-xs tracking-widest">ORKIESTRI / 0{ativo + 1}</p>
          <h3 className="mt-2 text-2xl font-semibold">{produto.name}</h3>
          <p className="mt-3 text-sm">{produto.tagline}</p>
        </div>
        <p className="module-message">{pedidos[produto.slug]}</p>
      </div>
      <div>{produto.screenshot && <Notebook tela={produto.screenshot}/>}
      <Link href={"/products/" + produto.slug} className="mt-4 inline-flex items-center gap-1 text-sm text-flame-soft">Explorar {produto.short ?? produto.name} <ArrowUpRight size={14}/></Link></div>
    </div>
  </section>;
}
