'use client';

import { useMetricsSocket } from '@/hooks/useMetricsSocket';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PANELS } from '@/lib/panels';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { KpiGrid } from './KpiGrid';
import { LiveSummary } from './LiveSummary';
import { MetricPanel } from './MetricPanel';
import { PauseToggle } from './PauseToggle';
import { StatusAnnouncer } from './StatusAnnouncer';
import { ThemeSwitcher } from './ThemeSwitcher';

/**
 * A casca não assina nenhum dado do store: a amostra nova re-renderiza só os
 * componentes que a usam (KPIs, gráficos), nunca a página inteira.
 */
export function Dashboard({ wsUrl }: { wsUrl: string }) {
  useMetricsSocket(wsUrl);
  const reducedMotion = useReducedMotion();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="app-header">
        <div>
          <h1>Realtime metrics</h1>
          <p className="muted">Simulated store traffic, streamed over a WebSocket.</p>
        </div>
        <div className="app-header__controls">
          <ConnectionStatusBadge />
          <PauseToggle />
          <ThemeSwitcher />
        </div>
      </header>
      <main id="main" tabIndex={-1} data-reduced-motion={reducedMotion}>
        <StatusAnnouncer />
        <LiveSummary />
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="visually-hidden">
            Current values
          </h2>
          <KpiGrid />
        </section>
        <section aria-labelledby="trends-heading">
          <h2 id="trends-heading" className="visually-hidden">
            Trends
          </h2>
          <div className="panels">
            {PANELS.map((panel) => (
              <MetricPanel key={panel.id} panel={panel} animate={!reducedMotion} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
