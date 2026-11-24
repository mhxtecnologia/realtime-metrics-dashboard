import { describe, expect, it } from 'vitest';
import { makeSample, sampleMessage } from '@/test/fixtures';
import { createMetricsStore } from './metrics-store';

describe('metrics store', () => {
  it('reads the interval from hello', () => {
    const store = createMetricsStore();
    store.getState().receive(JSON.stringify({ type: 'hello', version: 1, intervalMs: 1000 }));
    expect(store.getState().intervalMs).toBe(1000);
  });

  it('fills the window from a snapshot and appends live samples', () => {
    const store = createMetricsStore(5);
    store.getState().receive(JSON.stringify({ type: 'snapshot', data: [makeSample(1), makeSample(0)] }));
    store.getState().receive(sampleMessage(2));
    const { samples, visible } = store.getState();
    expect(samples.map((s) => s.ts)).toEqual([0, 1, 2].map((i) => makeSample(i).ts));
    expect(visible).toBe(samples);
  });

  it('bounds the sliding window', () => {
    const store = createMetricsStore(3);
    for (let i = 0; i < 10; i += 1) store.getState().receive(sampleMessage(i));
    expect(store.getState().samples).toHaveLength(3);
  });

  it('counts and ignores invalid messages without touching the data', () => {
    const store = createMetricsStore();
    store.getState().receive(sampleMessage(0));
    const before = store.getState().samples;

    store.getState().receive('not json');
    store.getState().receive(JSON.stringify({ type: 'sample', data: { ts: 1 } }));
    store.getState().receive(sampleMessage(1, { latencyP50Ms: 500, latencyP95Ms: 100 }));

    expect(store.getState().rejectedMessages).toBe(3);
    expect(store.getState().lastError).toContain('latencyP95Ms');
    expect(store.getState().samples).toBe(before);
  });

  it('freezes what is visible while paused and catches up on resume', () => {
    const store = createMetricsStore();
    store.getState().receive(sampleMessage(0));
    store.getState().setPaused(true);
    store.getState().receive(sampleMessage(1));
    store.getState().receive(sampleMessage(2));

    expect(store.getState().visible).toHaveLength(1);
    expect(store.getState().samples).toHaveLength(3);

    store.getState().setPaused(false);
    expect(store.getState().visible).toHaveLength(3);
  });

  it('tracks connection status and retry info', () => {
    const store = createMetricsStore();
    store.getState().setStatus('reconnecting', { attempt: 2, retryInMs: 1500 });
    expect(store.getState()).toMatchObject({ status: 'reconnecting', attempt: 2, retryInMs: 1500 });
    store.getState().setStatus('live');
    expect(store.getState()).toMatchObject({ status: 'live', attempt: 0, retryInMs: null });
  });
});
