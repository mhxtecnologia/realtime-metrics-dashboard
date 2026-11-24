import { STATUS_CODES, createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  MAX_SNAPSHOT_SAMPLES,
  PROTOCOL_VERSION,
  encodeServerMessage,
  type MetricsSample,
} from '@realtime-metrics/protocol';
import type { ServerConfig } from './config';
import type { Logger } from './logger';
import type { Simulator } from './simulator';

export const METRICS_PATH = '/metrics';

/** Intervalo do ping de keepalive; quem não responder ao pong até o próximo é derrubado. */
const HEARTBEAT_MS = 30_000;
/** O cliente não manda nada; qualquer frame maior que isso é encerrado pela própria lib. */
const MAX_CLIENT_PAYLOAD_BYTES = 1024;
/** Acima disso o cliente está lento demais: a amostra é descartada para ele, não enfileirada. */
const MAX_BUFFERED_BYTES = 256 * 1024;
/** Quanto tempo o `close()` espera os clientes fecharem antes de derrubá-los. */
const CLOSE_GRACE_MS = 1000;

export interface MetricsServer {
  /** Começa a escutar e a emitir amostras; devolve a porta efetiva (útil com a porta 0). */
  listen(): Promise<number>;
  close(): Promise<void>;
  clientCount(): number;
}

export interface MetricsServerDeps {
  config: ServerConfig;
  simulator: Simulator;
  logger: Logger;
  now?: () => number;
}

/**
 * Servidor HTTP + WebSocket de difusão: um único timer gera a amostra e a manda
 * para todos os clientes. Novos clientes recebem o `hello` e o histórico recente.
 */
export function createMetricsServer({ config, simulator, logger, now = Date.now }: MetricsServerDeps): MetricsServer {
  const history: MetricsSample[] = [];
  const alive = new WeakMap<WebSocket, boolean>();
  let tickTimer: NodeJS.Timeout | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CLIENT_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });

  const httpServer: Server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && pathname(req) === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on('error', () => socket.destroy());
    const reject = (status: number, reason: string) => {
      logger.warn('websocket upgrade rejected', { status, reason, origin: req.headers.origin });
      const text = STATUS_CODES[status] ?? 'Error';
      socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };

    if (pathname(req) !== METRICS_PATH) return reject(404, 'unknown path');
    // Navegadores sempre mandam Origin: conferir a lista barra o sequestro de
    // WebSocket entre sites. Clientes fora do navegador (sem Origin) são aceitos.
    const origin = req.headers.origin;
    if (origin !== undefined && !config.allowedOrigins.has(origin)) return reject(403, 'origin not allowed');
    if (wss.clients.size >= config.maxClients) return reject(503, 'too many clients');

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', (error) => logger.warn('websocket error', { error: error.message }));
    // O canal é só de difusão: mensagem vinda do cliente encerra a conexão.
    ws.on('message', () => ws.close(1003, 'server is broadcast-only'));

    ws.send(encodeServerMessage({ type: 'hello', version: PROTOCOL_VERSION, intervalMs: config.tickMs }));
    ws.send(encodeServerMessage({ type: 'snapshot', data: history.slice(-MAX_SNAPSHOT_SAMPLES) }));
  });

  const tick = () => {
    const sample = simulator.next(now());
    history.push(sample);
    if (history.length > MAX_SNAPSHOT_SAMPLES) history.shift();

    const payload = encodeServerMessage({ type: 'sample', data: sample });
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > MAX_BUFFERED_BYTES) continue;
      client.send(payload);
    }
  };

  const heartbeat = () => {
    for (const client of wss.clients) {
      if (alive.get(client) === false) {
        client.terminate();
        continue;
      }
      alive.set(client, false);
      client.ping();
    }
  };

  return {
    listen() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(config.port, config.host, () => {
          httpServer.off('error', reject);
          tick();
          tickTimer = setInterval(tick, config.tickMs);
          heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
          resolve((httpServer.address() as AddressInfo).port);
        });
      });
    },

    async close() {
      clearInterval(tickTimer);
      clearInterval(heartbeatTimer);
      for (const client of wss.clients) client.close(1001, 'server shutting down');
      const deadline = Date.now() + CLOSE_GRACE_MS;
      while (wss.clients.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
      }
    },

    clientCount: () => wss.clients.size,
  };
}

function pathname(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    return '';
  }
}
