export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface StatusInfo {
  /** Tentativas seguidas sem sucesso; volta a 0 quando chega a primeira mensagem. */
  attempt: number;
  /** Quando há uma nova tentativa agendada, em quanto tempo ela acontece. */
  retryInMs: number | null;
}

/** O pedaço da API do WebSocket que o cliente usa; nos testes entra um falso. */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(code?: number, reason?: string): void;
}

export interface NetworkMonitor {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export const browserNetwork: NetworkMonitor = {
  isOnline: () => navigator.onLine,
  subscribe(listener) {
    const online = () => listener(true);
    const offline = () => listener(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  },
};

export interface ReconnectingSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onStatus: (status: ConnectionStatus, info: StatusInfo) => void;
  createSocket?: (url: string) => WebSocketLike;
  network?: NetworkMonitor;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Sem mensagem por esse tempo, a conexão é tida como meio-aberta e é refeita. */
  staleAfterMs?: number;
  random?: () => number;
}

export interface ReconnectingSocket {
  start(): void;
  stop(): void;
}

/**
 * Backoff exponencial com "equal jitter": metade fixa e metade aleatória do teto.
 * O jitter espalha as reconexões quando o servidor volta para muitos clientes ao mesmo tempo.
 */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number, random: () => number): number {
  const cap = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(cap / 2 + random() * (cap / 2));
}

export function createReconnectingSocket(options: ReconnectingSocketOptions): ReconnectingSocket {
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url));
  const network = options.network ?? browserNetwork;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const staleAfterMs = options.staleAfterMs ?? 10_000;
  const random = options.random ?? Math.random;

  let socket: WebSocketLike | null = null;
  let running = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeNetwork: (() => void) | null = null;

  const emit = (status: ConnectionStatus, retryInMs: number | null = null) =>
    options.onStatus(status, { attempt, retryInMs });

  const clearTimers = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (staleTimer !== null) clearTimeout(staleTimer);
    retryTimer = null;
    staleTimer = null;
  };

  // Solta o socket atual sem disparar os handlers dele (o close não reentra aqui).
  const detach = () => {
    const current = socket;
    if (current === null) return;
    socket = null;
    current.onopen = null;
    current.onmessage = null;
    current.onclose = null;
    current.onerror = null;
    try {
      current.close(1000, 'client closing');
    } catch {
      // O socket pode já estar fechado; não há o que fazer.
    }
  };

  const armStaleTimer = () => {
    if (staleTimer !== null) clearTimeout(staleTimer);
    staleTimer = setTimeout(handleDrop, staleAfterMs);
  };

  const goOffline = () => {
    clearTimers();
    detach();
    emit('offline');
  };

  const scheduleRetry = () => {
    clearTimers();
    attempt += 1;
    const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
    emit('reconnecting', delay);
    retryTimer = setTimeout(connect, delay);
  };

  function handleDrop() {
    detach();
    if (!running) return;
    if (!network.isOnline()) {
      goOffline();
      return;
    }
    scheduleRetry();
  }

  function connect() {
    clearTimers();
    detach();
    if (!network.isOnline()) {
      goOffline();
      return;
    }
    emit(attempt === 0 ? 'connecting' : 'reconnecting');

    let current: WebSocketLike;
    try {
      current = createSocket(options.url);
    } catch {
      scheduleRetry();
      return;
    }
    socket = current;
    // O mesmo timer cobre um handshake que nunca termina.
    armStaleTimer();

    current.onopen = () => {
      if (socket !== current) return;
      armStaleTimer();
      emit('live');
    };
    current.onmessage = (event) => {
      if (socket !== current) return;
      armStaleTimer();
      // Só zera o backoff com dado de verdade: um servidor que aceita e derruba
      // a conexão em seguida não pode provocar reconexões em laço.
      attempt = 0;
      options.onMessage(event.data);
    };
    current.onclose = () => {
      if (socket !== current) return;
      handleDrop();
    };
    current.onerror = () => {
      // O evento close vem logo depois e é ele que agenda a reconexão.
    };
  }

  const onNetworkChange = (online: boolean) => {
    if (!running) return;
    if (online) connect();
    else goOffline();
  };

  return {
    start() {
      if (running) return;
      running = true;
      unsubscribeNetwork = network.subscribe(onNetworkChange);
      connect();
    },
    stop() {
      running = false;
      unsubscribeNetwork?.();
      unsubscribeNetwork = null;
      clearTimers();
      detach();
    },
  };
}
