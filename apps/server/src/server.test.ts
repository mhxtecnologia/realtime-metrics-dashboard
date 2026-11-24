import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseServerMessage, type ServerMessage } from '@realtime-metrics/protocol';
import type { ServerConfig } from './config';
import { silentLogger } from './logger';
import { mulberry32 } from './random';
import { METRICS_PATH, createMetricsServer, type MetricsServer } from './server';
import { createSimulator } from './simulator';

const ORIGIN = 'http://localhost:3000';

const baseConfig: ServerConfig = {
  port: 0,
  host: '127.0.0.1',
  tickMs: 50,
  allowedOrigins: new Set([ORIGIN]),
  maxClients: 10,
  seed: 42,
};

const servers: MetricsServer[] = [];
const sockets: WebSocket[] = [];

async function startServer(overrides: Partial<ServerConfig> = {}): Promise<number> {
  const server = createMetricsServer({
    config: { ...baseConfig, ...overrides },
    simulator: createSimulator(mulberry32(42)),
    logger: silentLogger,
  });
  servers.push(server);
  return server.listen();
}

function connect(port: number, options: { origin?: string; path?: string } = {}): WebSocket {
  const headers = options.origin === undefined ? {} : { origin: options.origin };
  const socket = new WebSocket(`ws://127.0.0.1:${port}${options.path ?? METRICS_PATH}`, { headers });
  sockets.push(socket);
  return socket;
}

// Coleta as N primeiras mensagens já validadas pelo protocolo.
function collect(socket: WebSocket, count: number): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = [];
    socket.on('error', reject);
    socket.on('message', (data) => {
      const result = parseServerMessage(data.toString());
      if (!result.ok) {
        reject(new Error(result.error));
        return;
      }
      messages.push(result.message);
      if (messages.length === count) resolve(messages);
    });
  });
}

function connectionError(socket: WebSocket): Promise<Error> {
  return new Promise((resolve) => socket.once('error', resolve));
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('metrics server', () => {
  it('sends hello, then the recent history, then live samples', async () => {
    const port = await startServer();
    const [hello, snapshot, sample, next] = await collect(connect(port, { origin: ORIGIN }), 4);

    expect(hello).toEqual({ type: 'hello', version: 1, intervalMs: 50 });
    expect(snapshot?.type).toBe('snapshot');
    if (snapshot?.type === 'snapshot') expect(snapshot.data.length).toBeGreaterThan(0);
    expect(sample?.type).toBe('sample');
    expect(next?.type).toBe('sample');
    if (sample?.type === 'sample' && next?.type === 'sample') {
      expect(next.data.ts).toBeGreaterThan(sample.data.ts);
    }
  });

  it('accepts clients that send no Origin header (non-browser tools)', async () => {
    const port = await startServer();
    const [hello] = await collect(connect(port), 1);
    expect(hello?.type).toBe('hello');
  });

  it('rejects an origin outside the allow list with 403', async () => {
    const port = await startServer();
    const error = await connectionError(connect(port, { origin: 'https://evil.example' }));
    expect(error.message).toContain('403');
  });

  it('rejects unknown paths with 404', async () => {
    const port = await startServer();
    const error = await connectionError(connect(port, { origin: ORIGIN, path: '/other' }));
    expect(error.message).toContain('404');
  });

  it('refuses connections above MAX_CLIENTS with 503', async () => {
    const port = await startServer({ maxClients: 1 });
    await collect(connect(port, { origin: ORIGIN }), 1);
    const error = await connectionError(connect(port, { origin: ORIGIN }));
    expect(error.message).toContain('503');
  });

  it('closes the connection when a client sends data (broadcast-only)', async () => {
    const port = await startServer();
    const socket = connect(port, { origin: ORIGIN });
    await collect(socket, 1);
    const code = new Promise<number>((resolve) => socket.once('close', resolve));
    socket.send('hello?');
    expect(await code).toBe(1003);
  });

  it('closes clients with 1001 on shutdown', async () => {
    const server = createMetricsServer({
      config: baseConfig,
      simulator: createSimulator(mulberry32(1)),
      logger: silentLogger,
    });
    const port = await server.listen();
    const socket = connect(port, { origin: ORIGIN });
    await collect(socket, 1);
    const code = new Promise<number>((resolve) => socket.once('close', resolve));
    await server.close();
    expect(await code).toBe(1001);
  });

  it('serves a health check and 404 for anything else', async () => {
    const port = await startServer();
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok' });
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');

    const missing = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(missing.status).toBe(404);
  });
});
