'use client';

import { useMetrics } from '@/lib/metrics-store';

/** Pausar conteúdo que se atualiza sozinho é exigência da WCAG 2.2.2 (Pause, Stop, Hide). */
export function PauseToggle() {
  const paused = useMetrics((state) => state.paused);
  const setPaused = useMetrics((state) => state.setPaused);

  return (
    <button type="button" className="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>
      <span aria-hidden="true" className="button__icon">
        {paused ? '▶' : '❚❚'}
      </span>
      Pause updates
    </button>
  );
}
