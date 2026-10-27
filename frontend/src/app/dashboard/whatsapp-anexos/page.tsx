"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { PageBody,PageHeader,Panel } from "@/components/data-ui";
import { api } from "@/lib/api";
export default function AnexosWhatsApp(){
  const [rows,setRows]=useState<any[]>([]),[erro,setErro]=useState(""),[busy,setBusy]=useState(false);
  async function atualizar(){setErro("");try{setRows((await api.get("/whatsapp-anexos")).data);}catch{setErro("Não foi possível carregar seus anexos.");}}
  useEffect(()=>{atualizar();},[]);
  async function excluir(id:string){setBusy(true);try{await api.delete(`/whatsapp-anexos/${id}`);await atualizar();}catch{setErro("Não foi possível excluir o anexo.");}finally{setBusy(false);}}
  return <><Topbar/><div className="page-content"><PageBody>
    <PageHeader icon={<Paperclip size={22}/>} title="Seus anexos do WhatsApp" subtitle="PDF e imagens enviados no contexto pessoal"/>
    <p>Arquivos privados, disponíveis por 30 dias. Limite de 5 MB por arquivo e 100 MB por conta.</p>
    <p><Link href="/dashboard/whatsapp-operacao">Ver operação do WhatsApp</Link></p>
    {erro&&<p role="alert">{erro}</p>}
    <Panel title="Arquivos recebidos"><div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Arquivo</th><th>Tamanho</th><th>Expira em</th><th>Ações</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id}><td>{r.nome}</td><td>{Math.ceil(r.tamanho/1024)} KB</td><td>{new Date(r.expira_em).toLocaleDateString("pt-BR")}</td><td><a href={`/api/whatsapp-anexos/${r.id}/download`} className="btn">Baixar</a> <button className="btn" disabled={busy} onClick={()=>excluir(r.id)}>Excluir</button></td></tr>)}
    </tbody></table></div>{!rows.length&&<p>Envie um PDF ou imagem para a Aurélia no contexto pessoal para guardá-lo aqui.</p>}</Panel>
  </PageBody></div></>;
}
