'use client';

import { useState } from 'react';
import type { MetricsSample } from '@realtime-metrics/protocol';
import { formatNumber } from '@/lib/format';
import { useMetrics } from '@/lib/metrics-store';
import type { PanelConfig } from '@/lib/panels';
import { DataTable } from './DataTable';
import { MetricChart } from './MetricChart';

interface MetricPanelProps {
  panel: PanelConfig;
  animate: boolean;
}

/** Descrição curta do gráfico para o `aria-label`; os dados completos ficam na tabela. */
export function describeChart(panel: PanelConfig, samples: readonly MetricsSample[]): string {
  const latest = samples[samples.length - 1];
  const base = `${panel.title} chart, last ${samples.length} samples.`;
  if (latest === undefined) return `${panel.title} chart, no data yet.`;
  const values = panel.series
    .map((series) => `${series.label} ${formatNumber(latest[series.key], panel.fractionDigits)} ${panel.unit}`)
    .join(', ');
  return `${base} Latest: ${values}. The data table below has the exact values.`;
}

export function MetricPanel({ panel, animate }: MetricPanelProps) {
  const samples = useMetrics((state) => state.visible);
  // A tabela só é montada aberta: fechada, não custa render a cada amostra.
  const [tableOpen, setTableOpen] = useState(false);
  const titleId = `${panel.id}-title`;

  return (
    <article className="panel" aria-labelledby={titleId} data-testid={`panel-${panel.id}`}>
      <h3 id={titleId}>{panel.title}</h3>
      <p className="muted">{panel.description}</p>
      <div className="chart" role="img" aria-label={describeChart(panel, samples)}>
        <MetricChart panel={panel} samples={samples} animate={animate} />
      </div>
      <details className="panel__table" onToggle={(event) => setTableOpen(event.currentTarget.open)}>
        <summary>Show data table</summary>
        {tableOpen && <DataTable panel={panel} samples={samples} />}
      </details>
    </article>
  );
}
