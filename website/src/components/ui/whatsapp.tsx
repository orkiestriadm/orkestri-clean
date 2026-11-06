import { Camera, ChevronLeft, Mic, Plus, Video } from "lucide-react";

export function ChatHeader() {
  return <div className="wa-header">
    <ChevronLeft size={19} aria-hidden />
    <span className="wa-avatar" aria-hidden>A</span>
    <div className="mr-auto"><strong>Aurélia</strong><small>Orkiestri · demonstração</small></div>
    <Video size={18} aria-hidden />
  </div>;
}

export function ChatComposer() {
  return <div className="wa-composer" aria-hidden>
    <Plus size={18}/><span>Mensagem</span><Camera size={17}/><Mic size={17}/>
  </div>;
}
