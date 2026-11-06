import { Screenshot } from "./screenshot";
import type { Screenshot as Tela } from "@/types";

export function Notebook({ tela }: { tela: Tela }) {
  return <div className="notebook">
    <div className="notebook-display">
      <span className="notebook-camera" aria-hidden />
      <Screenshot {...tela} reflection={false} zoomOnHover={false} bordered={false} />
    </div>
    <div className="notebook-base" aria-hidden />
  </div>;
}
