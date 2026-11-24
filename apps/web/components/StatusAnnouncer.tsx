'use client';

import { useMetrics } from '@/lib/metrics-store';
import { STATUS_LABEL } from '@/lib/status';

/**
 * Região `role="status"` (aria-live polite) só com o rótulo do estado: o leitor
 * de tela anuncia a troca de estado, mas não cada contagem regressiva da reconexão.
 */
export function StatusAnnouncer() {
  const status = useMetrics((state) => state.status);
  return (
    <div role="status" className="visually-hidden" data-testid="status-announcer">
      {`Connection ${STATUS_LABEL[status].toLowerCase()}`}
    </div>
  );
}
