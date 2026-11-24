import type { MetricsSample } from '@realtime-metrics/protocol';

/**
 * Funções puras da janela deslizante. Toda alteração devolve um array novo
 * (ou o mesmo, quando nada muda), para os seletores do store compararem por referência.
 */

/** Acrescenta uma amostra no fim; descarta amostra repetida ou fora de ordem e corta no limite. */
export function appendSample(
  window: readonly MetricsSample[],
  sample: MetricsSample,
  max: number,
): readonly MetricsSample[] {
  const last = window[window.length - 1];
  if (last !== undefined && sample.ts <= last.ts) return window;
  const start = Math.max(0, window.length + 1 - max);
  const next = window.slice(start);
  next.push(sample);
  return next;
}

/** Junta um lote (ex.: o snapshot da reconexão) à janela, ordenado e sem duplicatas por `ts`. */
export function mergeSamples(
  window: readonly MetricsSample[],
  incoming: readonly MetricsSample[],
  max: number,
): readonly MetricsSample[] {
  if (incoming.length === 0) return window;
  const byTs = new Map<number, MetricsSample>();
  for (const sample of window) byTs.set(sample.ts, sample);
  for (const sample of incoming) byTs.set(sample.ts, sample);
  return [...byTs.values()].sort((a, b) => a.ts - b.ts).slice(-max);
}

export interface WindowSummary {
  latest: MetricsSample;
  count: number;
  averageSales: number;
  peakP95Ms: number;
}

export function summarize(window: readonly MetricsSample[]): WindowSummary | null {
  const latest = window[window.length - 1];
  if (latest === undefined) return null;
  let sales = 0;
  let peakP95Ms = 0;
  for (const sample of window) {
    sales += sample.salesPerMinute;
    peakP95Ms = Math.max(peakP95Ms, sample.latencyP95Ms);
  }
  return { latest, count: window.length, averageSales: sales / window.length, peakP95Ms };
}
