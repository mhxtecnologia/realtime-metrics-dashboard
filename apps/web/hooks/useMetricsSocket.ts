'use client';

import { useEffect } from 'react';
import { createReconnectingSocket } from '@/lib/reconnecting-socket';
import { metricsStore, type MetricsStore } from '@/lib/metrics-store';

/** Liga o socket ao store enquanto o componente estiver montado. */
export function useMetricsSocket(url: string, store: MetricsStore = metricsStore): void {
  useEffect(() => {
    const socket = createReconnectingSocket({
      url,
      onMessage: (data) => store.getState().receive(data),
      onStatus: (status, info) => store.getState().setStatus(status, info),
    });
    socket.start();
    return () => socket.stop();
  }, [url, store]);
}
