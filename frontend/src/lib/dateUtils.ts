// Converte datetime-local (YYYY-MM-DDTHH:mm) para ISO string
// preservando o horario digitado pelo usuario como se fosse local
export function localToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  // datetime-local ja esta no formato local, apenas adiciona segundos
  const d = new Date(datetimeLocal);
  return d.toISOString();
}

// Converte ISO para datetime-local input value
export function isoToLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Formata para exibicao em pt-BR
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}