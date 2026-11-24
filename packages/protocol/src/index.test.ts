import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE_CHARS,
  MAX_SNAPSHOT_SAMPLES,
  PROTOCOL_VERSION,
  encodeServerMessage,
  parseServerMessage,
  type MetricsSample,
} from './index';

const sample: MetricsSample = {
  ts: 1_700_000_000_000,
  salesPerMinute: 120.5,
  latencyP50Ms: 90,
  latencyP95Ms: 210,
  errorsPerMinute: 2,
  onlineUsers: 1500,
};

describe('parseServerMessage', () => {
  it('accepts every valid message type', () => {
    const messages = [
      { type: 'hello', version: PROTOCOL_VERSION, intervalMs: 1000 },
      { type: 'snapshot', data: [sample] },
      { type: 'sample', data: sample },
    ] as const;
    for (const message of messages) {
      expect(parseServerMessage(JSON.stringify(message))).toEqual({ ok: true, message });
    }
  });

  it('round-trips through encodeServerMessage', () => {
    const encoded = encodeServerMessage({ type: 'sample', data: sample });
    expect(parseServerMessage(encoded)).toEqual({ ok: true, message: { type: 'sample', data: sample } });
  });

  it('rejects binary frames and invalid JSON', () => {
    expect(parseServerMessage(new ArrayBuffer(4))).toMatchObject({ ok: false });
    expect(parseServerMessage('{not json')).toEqual({ ok: false, error: 'invalid JSON' });
  });

  it('rejects oversized messages before parsing them', () => {
    const raw = `"${'x'.repeat(MAX_MESSAGE_CHARS)}"`;
    expect(parseServerMessage(raw)).toEqual({ ok: false, error: 'message too large' });
  });

  it('rejects unknown types, extra fields and a different protocol version', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'reset' }))).toMatchObject({ ok: false });
    expect(parseServerMessage(JSON.stringify({ type: 'sample', data: { ...sample, admin: true } }))).toMatchObject({
      ok: false,
    });
    expect(parseServerMessage(JSON.stringify({ type: 'hello', version: 2, intervalMs: 1000 }))).toMatchObject({
      ok: false,
    });
  });

  it('rejects impossible metric values', () => {
    const invalid: unknown[] = [
      { ...sample, salesPerMinute: -1 },
      { ...sample, errorsPerMinute: 1.5 },
      { ...sample, onlineUsers: 'many' },
      { ...sample, ts: 0 },
    ];
    for (const data of invalid) {
      expect(parseServerMessage(JSON.stringify({ type: 'sample', data }))).toMatchObject({ ok: false });
    }
  });

  it('requires p95 latency to be at least p50', () => {
    const result = parseServerMessage(
      JSON.stringify({ type: 'sample', data: { ...sample, latencyP50Ms: 300, latencyP95Ms: 200 } }),
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('latencyP95Ms');
  });

  it('caps the snapshot size', () => {
    const data = Array.from({ length: MAX_SNAPSHOT_SAMPLES + 1 }, (_, i) => ({ ...sample, ts: sample.ts + i }));
    expect(parseServerMessage(JSON.stringify({ type: 'snapshot', data }))).toMatchObject({ ok: false });
  });
});
