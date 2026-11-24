import type { MetricsSample } from '@realtime-metrics/protocol';

export const T0 = 1_700_000_000_000;

export function makeSample(index: number, overrides: Partial<MetricsSample> = {}): MetricsSample {
  return {
    ts: T0 + index * 1000,
    salesPerMinute: 100 + index,
    latencyP50Ms: 90,
    latencyP95Ms: 200,
    errorsPerMinute: 2,
    onlineUsers: 1234,
    ...overrides,
  };
}

export function sampleMessage(index: number, overrides: Partial<MetricsSample> = {}): string {
  return JSON.stringify({ type: 'sample', data: makeSample(index, overrides) });
}
