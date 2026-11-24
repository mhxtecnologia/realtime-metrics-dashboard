'use client';

import { formatNumber } from '@/lib/format';
import { useMetrics } from '@/lib/metrics-store';
import type { MetricKey } from '@/lib/panels';

const KPIS: readonly { key: MetricKey; label: string; unit: string; fractionDigits: number }[] = [
  { key: 'salesPerMinute', label: 'Sales per minute', unit: '', fractionDigits: 1 },
  { key: 'latencyP95Ms', label: 'Latency p95', unit: ' ms', fractionDigits: 0 },
  { key: 'errorsPerMinute', label: 'Errors per minute', unit: '', fractionDigits: 0 },
  { key: 'onlineUsers', label: 'Users online', unit: '', fractionDigits: 0 },
];

export function KpiGrid() {
  // Seleciona o objeto da última amostra: a referência só muda quando chega uma nova.
  const latest = useMetrics((state) => state.visible[state.visible.length - 1]);

  return (
    <dl className="kpis">
      {KPIS.map((kpi) => (
        <div key={kpi.key} className="kpi" data-testid={`kpi-${kpi.key}`}>
          <dt>{kpi.label}</dt>
          <dd>{latest === undefined ? '—' : `${formatNumber(latest[kpi.key], kpi.fractionDigits)}${kpi.unit}`}</dd>
        </div>
      ))}
    </dl>
  );
}
