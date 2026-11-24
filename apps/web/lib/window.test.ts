import { describe, expect, it } from 'vitest';
import { makeSample } from '@/test/fixtures';
import { appendSample, mergeSamples, summarize } from './window';

describe('appendSample', () => {
  it('appends in order and returns a new array', () => {
    const window = [makeSample(0)];
    const next = appendSample(window, makeSample(1), 10);
    expect(next).not.toBe(window);
    expect(next.map((s) => s.ts)).toEqual([makeSample(0).ts, makeSample(1).ts]);
  });

  it('keeps at most `max` samples, dropping the oldest', () => {
    let window: ReturnType<typeof appendSample> = [];
    for (let i = 0; i < 25; i += 1) window = appendSample(window, makeSample(i), 10);
    expect(window).toHaveLength(10);
    expect(window[0]?.ts).toBe(makeSample(15).ts);
    expect(window[9]?.ts).toBe(makeSample(24).ts);
  });

  it('ignores duplicated and out-of-order samples, keeping the same reference', () => {
    const window = [makeSample(0), makeSample(5)];
    expect(appendSample(window, makeSample(5), 10)).toBe(window);
    expect(appendSample(window, makeSample(3), 10)).toBe(window);
  });
});

describe('mergeSamples', () => {
  it('merges, sorts and de-duplicates by timestamp', () => {
    const window = [makeSample(1), makeSample(3)];
    const merged = mergeSamples(window, [makeSample(2), makeSample(3, { onlineUsers: 9 }), makeSample(0)], 10);
    expect(merged.map((s) => s.ts)).toEqual([0, 1, 2, 3].map((i) => makeSample(i).ts));
    expect(merged[3]?.onlineUsers).toBe(9);
  });

  it('keeps only the newest `max` samples', () => {
    const incoming = Array.from({ length: 30 }, (_, i) => makeSample(i));
    const merged = mergeSamples([], incoming, 5);
    expect(merged.map((s) => s.ts)).toEqual([25, 26, 27, 28, 29].map((i) => makeSample(i).ts));
  });

  it('returns the same reference for an empty batch', () => {
    const window = [makeSample(0)];
    expect(mergeSamples(window, [], 10)).toBe(window);
  });
});

describe('summarize', () => {
  it('returns null for an empty window', () => {
    expect(summarize([])).toBeNull();
  });

  it('computes the latest sample, average sales and peak p95', () => {
    const summary = summarize([
      makeSample(0, { salesPerMinute: 10, latencyP95Ms: 300 }),
      makeSample(1, { salesPerMinute: 30, latencyP95Ms: 150 }),
    ]);
    expect(summary).toMatchObject({ count: 2, averageSales: 20, peakP95Ms: 300 });
    expect(summary?.latest.ts).toBe(makeSample(1).ts);
  });
});
