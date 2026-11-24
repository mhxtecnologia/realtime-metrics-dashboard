'use client';

import { useEffect, useState } from 'react';
import { WAITING_FOR_DATA, formatSummary } from '@/lib/format';
import { metricsStore, type MetricsStore } from '@/lib/metrics-store';

export const SUMMARY_INTERVAL_MS = 10_000;

interface LiveSummaryProps {
  store?: MetricsStore;
  intervalMs?: number;
}

/**
 * Resumo em texto numa região aria-live "polite". Atualiza no máximo a cada
 * `intervalMs`: anunciar toda amostra (1 por segundo) tornaria o leitor de tela inutilizável.
 */
export function LiveSummary({ store = metricsStore, intervalMs = SUMMARY_INTERVAL_MS }: LiveSummaryProps) {
  const [text, setText] = useState(WAITING_FOR_DATA);

  useEffect(() => {
    const update = () => {
      const state = store.getState();
      setText(formatSummary(state.visible, state.paused));
    };
    update();
    const timer = setInterval(update, intervalMs);
    // Além do relógio, atualiza na hora quando chega o primeiro dado e quando pausa/retoma.
    const unsubscribe = store.subscribe((state, previous) => {
      const firstData = previous.visible.length === 0 && state.visible.length > 0;
      if (firstData || state.paused !== previous.paused) update();
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [store, intervalMs]);

  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <p aria-live="polite" aria-atomic="true" data-testid="live-summary">
        {text}
      </p>
    </section>
  );
}
