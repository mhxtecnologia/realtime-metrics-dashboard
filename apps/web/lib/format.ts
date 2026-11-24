import { summarize } from './window';
import type { MetricsSample } from '@realtime-metrics/protocol';

const clockFormat = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// Um formatador por quantidade de casas decimais: criar Intl.NumberFormat a cada render custa caro.
const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatClock(ts: number): string {
  return clockFormat.format(ts);
}

export function formatNumber(value: number, fractionDigits = 0): string {
  let format = numberFormats.get(fractionDigits);
  if (format === undefined) {
    format = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(fractionDigits, format);
  }
  return format.format(value);
}

export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

export const WAITING_FOR_DATA = 'Waiting for data…';

/** Resumo em texto corrido, lido pela região `aria-live`. */
export function formatSummary(window: readonly MetricsSample[], paused: boolean): string {
  const summary = summarize(window);
  if (summary === null) return WAITING_FOR_DATA;
  const { latest } = summary;
  const text =
    `At ${formatClock(latest.ts)}: ${formatNumber(latest.salesPerMinute, 1)} sales per minute, ` +
    `latency p50 ${formatNumber(latest.latencyP50Ms)} ms and p95 ${formatNumber(latest.latencyP95Ms)} ms, ` +
    `${formatNumber(latest.errorsPerMinute)} errors per minute, ` +
    `${formatNumber(latest.onlineUsers)} users online. ` +
    `Over the last ${summary.count} samples: ${formatNumber(summary.averageSales, 1)} sales per minute on average, ` +
    `peak p95 latency ${formatNumber(summary.peakP95Ms)} ms.`;
  return paused ? `Updates paused. ${text}` : text;
}
