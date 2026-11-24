'use client';

import { useMetrics } from '@/lib/metrics-store';
import { STATUS_LABEL, statusDetail } from '@/lib/status';

/** Estado da conexão visível; o anúncio para leitores de tela fica no StatusAnnouncer. */
export function ConnectionStatusBadge() {
  const status = useMetrics((state) => state.status);
  const attempt = useMetrics((state) => state.attempt);
  const retryInMs = useMetrics((state) => state.retryInMs);
  const detail = statusDetail(status, attempt, retryInMs);

  return (
    <p className="status-badge" data-status={status} data-testid="connection-status">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-badge__label">{STATUS_LABEL[status]}</span>
      {/* Espaço real no texto: o `gap` do CSS não separa as palavras para o leitor de tela. */}
      {detail !== null && <span className="status-badge__detail"> ({detail})</span>}
    </p>
  );
}
