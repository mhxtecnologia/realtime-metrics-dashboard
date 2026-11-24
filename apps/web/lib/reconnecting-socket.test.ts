import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backoffDelay,
  createReconnectingSocket,
  type ConnectionStatus,
  type NetworkMonitor,
  type StatusInfo,
  type WebSocketLike,
} from './reconnecting-socket';

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  closedWith: number | undefined | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  close(code?: number) {
    this.closedWith = code;
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  receive(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  drop() {
    this.readyState = 3;
    this.onerror?.(new Event('error'));
    this.onclose?.(new CloseEvent('close', { code: 1006 }));
  }
}

class FakeNetwork implements NetworkMonitor {
  online = true;
  private listeners = new Set<(online: boolean) => void>();

  isOnline() {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(online: boolean) {
    this.online = online;
    for (const listener of this.listeners) listener(online);
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function setup(options: { staleAfterMs?: number } = {}) {
  const statuses: { status: ConnectionStatus; info: StatusInfo }[] = [];
  const messages: unknown[] = [];
  const network = new FakeNetwork();
  const socket = createReconnectingSocket({
    url: 'ws://test/metrics',
    onMessage: (data) => messages.push(data),
    onStatus: (status, info) => statuses.push({ status, info }),
    createSocket: (url) => new FakeSocket(url),
    network,
    baseDelayMs: 500,
    maxDelayMs: 4000,
    staleAfterMs: options.staleAfterMs ?? 60_000,
    // Sem aleatoriedade: o atraso fica na metade fixa do teto.
    random: () => 0,
  });
  const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];
  const lastStatus = () => statuses[statuses.length - 1];
  return { socket, statuses, messages, network, last, lastStatus };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('backoffDelay', () => {
  it('doubles per attempt and stops at the cap', () => {
    const max = () => 1;
    expect([1, 2, 3, 4, 5, 6].map((attempt) => backoffDelay(attempt, 500, 4000, max))).toEqual([
      500, 1000, 2000, 4000, 4000, 4000,
    ]);
  });

  it('keeps at least half of the cap (equal jitter)', () => {
    expect(backoffDelay(3, 500, 4000, () => 0)).toBe(1000);
    expect(backoffDelay(3, 500, 4000, () => 0.5)).toBe(1500);
  });
});

describe('createReconnectingSocket', () => {
  it('connects, reports live and forwards messages', () => {
    const { socket, messages, last, lastStatus } = setup();
    socket.start();
    expect(lastStatus()?.status).toBe('connecting');
    expect(last()?.url).toBe('ws://test/metrics');

    last()?.open();
    expect(lastStatus()?.status).toBe('live');

    last()?.receive('payload');
    expect(messages).toEqual(['payload']);
  });

  it('reconnects with exponential backoff after a drop', () => {
    const { socket, last, lastStatus } = setup();
    socket.start();
    last()?.open();

    last()?.drop();
    expect(lastStatus()).toEqual({ status: 'reconnecting', info: { attempt: 1, retryInMs: 250 } });
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(250);
    expect(FakeSocket.instances).toHaveLength(2);

    last()?.drop();
    expect(lastStatus()?.info).toEqual({ attempt: 2, retryInMs: 500 });
    vi.advanceTimersByTime(499);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('resets the backoff only after receiving data', () => {
    const { socket, last, lastStatus } = setup();
    socket.start();
    last()?.drop();
    vi.advanceTimersByTime(250);
    // Abriu mas caiu antes de mandar dado: o backoff continua crescendo.
    last()?.open();
    last()?.drop();
    expect(lastStatus()?.info.attempt).toBe(2);

    vi.advanceTimersByTime(500);
    last()?.open();
    last()?.receive('data');
    last()?.drop();
    expect(lastStatus()?.info).toEqual({ attempt: 1, retryInMs: 250 });
  });

  it('goes offline without retrying and reconnects when the network is back', () => {
    const { socket, network, last, lastStatus } = setup();
    socket.start();
    last()?.open();
    const first = last();

    network.set(false);
    expect(lastStatus()?.status).toBe('offline');
    expect(first?.closedWith).toBe(1000);

    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    network.set(true);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(lastStatus()?.status).toBe('connecting');
  });

  it('starts offline when there is no network', () => {
    const { socket, network, lastStatus } = setup();
    network.online = false;
    socket.start();
    expect(lastStatus()?.status).toBe('offline');
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('treats a silent connection as stale and reconnects', () => {
    const { socket, last, lastStatus } = setup({ staleAfterMs: 5000 });
    socket.start();
    last()?.open();
    last()?.receive('data');

    vi.advanceTimersByTime(4999);
    expect(lastStatus()?.status).toBe('live');
    vi.advanceTimersByTime(1);
    expect(lastStatus()?.status).toBe('reconnecting');
    expect(FakeSocket.instances[0]?.closedWith).toBe(1000);
  });

  it('stops cleanly: closes the socket, removes listeners and never reconnects', () => {
    const { socket, network, last, statuses } = setup();
    socket.start();
    last()?.open();
    const count = statuses.length;

    socket.stop();
    expect(last()?.closedWith).toBe(1000);
    expect(network.listenerCount).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(statuses).toHaveLength(count);
  });
});
