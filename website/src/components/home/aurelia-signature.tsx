import { AureliaCapture } from "./aurelia-capture";

/** A primeira dobra também mostra o produto funcionando, com captura real. */
export function AureliaSignature() {
  return <div className="relative mx-auto w-full max-w-[460px] rounded-[28px] border border-white/10 bg-panel p-5 shadow-2xl sm:p-7">
    <AureliaCapture index={1} priority />
  </div>;
}
