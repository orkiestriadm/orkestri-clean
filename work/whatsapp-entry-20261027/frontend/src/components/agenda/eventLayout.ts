/**
 * eventLayout.ts — algoritmo de posicionamento de eventos na timeline.
 *
 * Resolve dois problemas visuais:
 *  1. Altura proporcional à duração (evento de 30min ≠ evento de 2h)
 *  2. Eventos sobrepostos se distribuem lado a lado em colunas
 *
 * Abordagem (clássica em calendars tipo Google):
 *   a) Filtra/ordena eventos do dia por início.
 *   b) Agrupa em CLUSTERS: grupos cujos eventos se sobrepõem em cadeia
 *      (A overlaps B, B overlaps C → A,B,C no mesmo cluster mesmo que A
 *      não overlap C diretamente). Cluster compartilha totalCols.
 *   c) Dentro de cada cluster, aloca cada evento na primeira coluna
 *      livre — interval graph coloring com varredura linear.
 *
 * Complexidade: O(n log n) pelo sort + O(n × k) pela alocação,
 * onde k é o tamanho máximo de cluster (≈ máximo de eventos simultâneos).
 * Para n típico de uma agenda (≤200 eventos no dia) é instantâneo.
 */

export interface LayoutInput {
  id: string;
  inicio: string;      // ISO
  fim?: string;        // ISO (assume duração padrão se ausente)
  diaTodo?: boolean;   // ignorado no layout temporal
}

export interface LayoutResult<T extends LayoutInput> {
  event: T;
  /** índice da coluna dentro do cluster (0-based) */
  colIdx: number;
  /** total de colunas no cluster — define a largura: 100% / totalCols */
  totalCols: number;
  /** topo em pixels, baseado em HOUR_HEIGHT */
  top: number;
  /** altura em pixels (mínimo enforced por minHeight no caller) */
  height: number;
}

/** duração padrão (ms) quando o evento não tem `fim` definido. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/**
 * Calcula layout de eventos de UM dia (timed events apenas).
 *
 * @param events    lista — deve ter inicio (ISO). diaTodo = ignorado.
 * @param dayStart  início do dia (00h00 local). Eventos antes são truncados.
 * @param hourHeight  altura em pixels de uma hora (usado para top/height).
 */
export function layoutEvents<T extends LayoutInput>(
  events: T[],
  dayStart: Date,
  hourHeight: number,
): LayoutResult<T>[] {
  // 1. Filtra eventos com horário (não dia-todo) e calcula timestamps
  const timed = events
    .filter(e => !e.diaTodo && e.inicio)
    .map(e => {
      const start = new Date(e.inicio).getTime();
      const end = e.fim ? new Date(e.fim).getTime() : start + DEFAULT_DURATION_MS;
      return { event: e, start, end: Math.max(end, start + 5 * 60 * 1000) }; // mínimo 5min
    })
    // 2. Ordena por início (ascendente)
    .sort((a, b) => a.start - b.start);

  if (timed.length === 0) return [];

  // 3. Agrupa em clusters por overlap transitivo
  type Cluster = { items: typeof timed; rangeEnd: number };
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;

  for (const it of timed) {
    if (current && it.start < current.rangeEnd) {
      current.items.push(it);
      if (it.end > current.rangeEnd) current.rangeEnd = it.end;
    } else {
      current = { items: [it], rangeEnd: it.end };
      clusters.push(current);
    }
  }

  // 4. Para cada cluster, aloca colunas via first-fit
  const results: LayoutResult<T>[] = [];
  const dayStartMs = dayStart.getTime();

  for (const cluster of clusters) {
    // cols[c] = end timestamp do último evento alocado naquela coluna
    const cols: number[] = [];
    // mapeia evento → colIdx (pra atualizar totalCols depois)
    const assigned: { item: typeof timed[0]; colIdx: number }[] = [];

    for (const it of cluster.items) {
      let colIdx = cols.findIndex(end => end <= it.start);
      if (colIdx === -1) {
        cols.push(it.end);
        colIdx = cols.length - 1;
      } else {
        cols[colIdx] = it.end;
      }
      assigned.push({ item: it, colIdx });
    }

    const totalCols = cols.length;
    for (const { item, colIdx } of assigned) {
      const minutesFromDayStart = (item.start - dayStartMs) / 60000;
      const durationMinutes = (item.end - item.start) / 60000;
      results.push({
        event: item.event,
        colIdx,
        totalCols,
        top: (minutesFromDayStart / 60) * hourHeight,
        height: (durationMinutes / 60) * hourHeight,
      });
    }
  }

  return results;
}
