import { describe, expect, it } from 'vitest';
import { metricsSampleSchema } from '@realtime-metrics/protocol';
import { mulberry32 } from './random';
import { createSimulator } from './simulator';

const START = 1_700_000_000_000;

function run(seed: number, ticks: number) {
  const simulator = createSimulator(mulberry32(seed));
  return Array.from({ length: ticks }, (_, i) => simulator.next(START + i * 1000));
}

describe('mulberry32', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('simulator', () => {
  it('produces samples that always satisfy the wire protocol', () => {
    for (const sample of run(123, 5000)) {
      expect(metricsSampleSchema.safeParse(sample).success).toBe(true);
    }
  });

  it('is reproducible with the same seed', () => {
    expect(run(99, 200)).toEqual(run(99, 200));
    expect(run(99, 200)).not.toEqual(run(100, 200));
  });

  it('keeps p95 latency at or above p50', () => {
    for (const sample of run(5, 2000)) {
      expect(sample.latencyP95Ms).toBeGreaterThanOrEqual(sample.latencyP50Ms);
    }
  });

  it('simulates incidents with error spikes', () => {
    const errors = run(2024, 5000).map((sample) => sample.errorsPerMinute);
    expect(Math.max(...errors)).toBeGreaterThan(10);
  });
});
