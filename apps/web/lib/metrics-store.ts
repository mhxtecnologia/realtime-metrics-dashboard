import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { parseServerMessage, type MetricsSample } from '@realtime-metrics/protocol';
import type { ConnectionStatus, StatusInfo } from './reconnecting-socket';
import { appendSample, mergeSamples } from './window';

/** Tamanho da janela deslizante: 2 minutos a 1 amostra por segundo. A memória fica limitada. */
export const MAX_SAMPLES = 120;

export interface MetricsState {
  status: ConnectionStatus;
  attempt: number;
  retryInMs: number | null;
  intervalMs: number | null;
  /** Janela completa, sempre atualizada. */
  samples: readonly MetricsSample[];
  /** O que a interface mostra: igual a `samples`, mas congelado enquanto pausado. */
  visible: readonly MetricsSample[];
  paused: boolean;
  rejectedMessages: number;
  lastError: string | null;
}

export interface MetricsActions {
  /** Recebe o frame cru do socket; valida antes de tocar no estado. */
  receive(raw: unknown): void;
  setStatus(status: ConnectionStatus, info?: StatusInfo): void;
  setPaused(paused: boolean): void;
  reset(): void;
}

export type MetricsStore = StoreApi<MetricsState & MetricsActions>;

const initialState: MetricsState = {
  status: 'connecting',
  attempt: 0,
  retryInMs: null,
  intervalMs: null,
  samples: [],
  visible: [],
  paused: false,
  rejectedMessages: 0,
  lastError: null,
};

export function createMetricsStore(maxSamples = MAX_SAMPLES): MetricsStore {
  return createStore<MetricsState & MetricsActions>()((set, get) => {
    const updateSamples = (next: readonly MetricsSample[]) => {
      if (next === get().samples) return;
      set((state) => ({ samples: next, visible: state.paused ? state.visible : next }));
    };

    return {
      ...initialState,

      receive(raw) {
        const result = parseServerMessage(raw);
        if (!result.ok) {
          set((state) => ({ rejectedMessages: state.rejectedMessages + 1, lastError: result.error }));
          return;
        }
        const message = result.message;
        switch (message.type) {
          case 'hello':
            set({ intervalMs: message.intervalMs });
            return;
          case 'snapshot':
            updateSamples(mergeSamples(get().samples, message.data, maxSamples));
            return;
          case 'sample':
            updateSamples(appendSample(get().samples, message.data, maxSamples));
            return;
        }
      },

      setStatus(status, info = { attempt: 0, retryInMs: null }) {
        set({ status, attempt: info.attempt, retryInMs: info.retryInMs });
      },

      setPaused(paused) {
        set((state) => ({ paused, visible: paused ? state.visible : state.samples }));
      },

      reset() {
        set(initialState);
      },
    };
  });
}

/** Store único da aplicação; os testes criam instâncias próprias com `createMetricsStore`. */
export const metricsStore = createMetricsStore();

/**
 * Cada componente assina só a fatia de que precisa: a amostra nova re-renderiza
 * os gráficos e os KPIs, não a página inteira.
 */
export function useMetrics<T>(selector: (state: MetricsState & MetricsActions) => T): T {
  return useStore(metricsStore, selector);
}
