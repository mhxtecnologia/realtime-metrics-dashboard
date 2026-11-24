import { useMemo } from 'react';
import type { MetricsSample } from '@realtime-metrics/protocol';
import { formatClock, formatNumber } from '@/lib/format';
import type { PanelConfig } from '@/lib/panels';

export const TABLE_ROWS = 20;

interface DataTableProps {
  panel: PanelConfig;
  samples: readonly MetricsSample[];
}

/** Alternativa em tabela a cada gráfico (WCAG 1.1.1): os mesmos dados, legíveis por teclado e leitor de tela. */
export function DataTable({ panel, samples }: DataTableProps) {
  const rows = useMemo(() => samples.slice(-TABLE_ROWS).reverse(), [samples]);

  return (
    // Região rolável focável, para quem usa só o teclado conseguir rolar a tabela.
    <div className="table-wrap" role="region" aria-label={`${panel.title} data`} tabIndex={0}>
      <table>
        <caption>
          {panel.title}: the {TABLE_ROWS} most recent samples, newest first.
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {panel.series.map((series) => (
              <th scope="col" key={series.key}>
                {series.label} ({panel.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={panel.series.length + 1}>No data yet.</td>
            </tr>
          ) : (
            rows.map((sample) => (
              <tr key={sample.ts}>
                <th scope="row">
                  <time dateTime={new Date(sample.ts).toISOString()}>{formatClock(sample.ts)}</time>
                </th>
                {panel.series.map((series) => (
                  <td key={series.key}>{formatNumber(sample[series.key], panel.fractionDigits)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
