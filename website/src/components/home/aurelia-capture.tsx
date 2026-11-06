"use client";

import { useState } from "react";
import { CheckCheck, RotateCcw } from "lucide-react";
import { Celular } from "@/components/ui/celular";
import { ChatHeader, ChatComposer } from "@/components/ui/whatsapp";

const cenas = [
  [["Oi, Aurélia! O que tenho para hoje?", true], ["Bom dia! Quer consultar a agenda ou marcar um compromisso?", false], ["Consultar a agenda", true], ["Você tem uma reunião às 10h e uma visita às 15h.", false]],
  [["Marca uma reunião com a equipe amanhã às 10h.", true], ["Reunião com a equipe\nAmanhã · 10h\nPosso salvar na agenda?", false], ["Pode confirmar.", true], ["Pronto! Reunião salva. Eu te aviso antes.", false]],
  [["Lembrete da sua agenda", false], ["A reunião com a equipe começa em 15 minutos.\nHoje · 10h", false], ["Obrigada, Aurélia!", true]],
] as const;

export function AureliaCapture({ index, orbita = true }: { index: number; orbita?: boolean }) {
  const [replay, setReplay] = useState(0);
  return <figure className="mx-auto w-full max-w-[350px]">
    <Celular orbita={orbita} largura={320}>
      <div className="wa-screen wa-light">
        <ChatHeader />
        <div className="wa-thread" key={index + "-" + replay}>
          <span className="wa-date">Hoje</span>
          {cenas[index].map(([text, sent], i) => <div key={text} className={"wa-bubble wa-enter " + (sent ? "wa-sent" : "wa-received")} style={{ animationDelay: i * 650 + "ms" }}>
            <p className="whitespace-pre-line">{text}</p>
            <small>09:{i < 2 ? "41" : "42"} {sent && <CheckCheck size={13} />}</small>
          </div>)}
        </div>
        <ChatComposer />
      </div>
    </Celular>
    <figcaption className="text-center"><button type="button" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-chalk-dim hover:text-chalk" onClick={() => setReplay(n => n + 1)}><RotateCcw size={13}/> Reproduzir conversa</button></figcaption>
  </figure>;
}
