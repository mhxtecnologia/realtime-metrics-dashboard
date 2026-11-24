import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metricsStore } from '@/lib/metrics-store';
import { PANELS } from '@/lib/panels';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { makeSample, sampleMessage } from '@/test/fixtures';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { DataTable, TABLE_ROWS } from './DataTable';
import { KpiGrid } from './KpiGrid';
import { LiveSummary } from './LiveSummary';
import { describeChart } from './MetricPanel';
import { PauseToggle } from './PauseToggle';
import { StatusAnnouncer } from './StatusAnnouncer';
import { ThemeSwitcher } from './ThemeSwitcher';

const latencyPanel = PANELS.find((panel) => panel.id === 'latency');
if (latencyPanel === undefined) throw new Error('latency panel missing');

beforeEach(() => {
  metricsStore.getState().reset();
});

describe('ConnectionStatusBadge', () => {
  it('shows the status as text, not only as color', () => {
    render(<ConnectionStatusBadge />);
    const badge = screen.getByTestId('connection-status');
    expect(badge).toHaveTextContent('Connecting');

    act(() => metricsStore.getState().setStatus('reconnecting', { attempt: 2, retryInMs: 2000 }));
    expect(badge).toHaveAttribute('data-status', 'reconnecting');
    expect(badge).toHaveTextContent('Reconnecting (attempt 2, retry in 2 s)');

    act(() => metricsStore.getState().setStatus('offline'));
    expect(badge).toHaveTextContent('Offline');
  });
});

describe('StatusAnnouncer', () => {
  it('announces status changes in a polite status region', () => {
    render(<StatusAnnouncer />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Connection connecting');
    act(() => metricsStore.getState().setStatus('live'));
    expect(region).toHaveTextContent('Connection live');
  });
});

describe('LiveSummary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the aria-live summary at most once per interval', () => {
    vi.useFakeTimers();
    render(<LiveSummary intervalMs={10_000} />);
    const summary = screen.getByTestId('live-summary');
    expect(summary).toHaveAttribute('aria-live', 'polite');
    expect(summary).toHaveTextContent('Waiting for data');

    // O primeiro dado aparece na hora.
    act(() => metricsStore.getState().receive(sampleMessage(0, { onlineUsers: 1234 })));
    expect(summary).toHaveTextContent('1,234 users online');

    // Os seguintes esperam o próximo ciclo do relógio.
    act(() => metricsStore.getState().receive(sampleMessage(1, { onlineUsers: 5678 })));
    expect(summary).toHaveTextContent('1,234 users online');
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(summary).toHaveTextContent('5,678 users online');
  });

  it('says when updates are paused', () => {
    render(<LiveSummary />);
    act(() => metricsStore.getState().receive(sampleMessage(0)));
    act(() => metricsStore.getState().setPaused(true));
    expect(screen.getByTestId('live-summary')).toHaveTextContent(/^Updates paused\./);
  });
});

describe('PauseToggle', () => {
  it('is a toggle button that pauses and resumes the store', async () => {
    const user = userEvent.setup();
    render(<PauseToggle />);
    const button = screen.getByRole('button', { name: 'Pause updates' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(metricsStore.getState().paused).toBe(true);

    await user.keyboard('{Enter}');
    expect(metricsStore.getState().paused).toBe(false);
  });
});

describe('ThemeSwitcher', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('switches theme with native radio buttons', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe('KpiGrid', () => {
  it('shows a placeholder, then the latest values', () => {
    render(<KpiGrid />);
    expect(screen.getByTestId('kpi-onlineUsers')).toHaveTextContent('—');
    act(() => metricsStore.getState().receive(sampleMessage(0, { onlineUsers: 4321, latencyP95Ms: 250 })));
    expect(screen.getByTestId('kpi-onlineUsers')).toHaveTextContent('4,321');
    expect(screen.getByTestId('kpi-latencyP95Ms')).toHaveTextContent('250 ms');
  });
});

describe('DataTable', () => {
  it('renders an accessible table with the newest samples first', () => {
    const samples = Array.from({ length: 30 }, (_, i) => makeSample(i, { latencyP50Ms: i, latencyP95Ms: i + 100 }));
    render(<DataTable panel={latencyPanel} samples={samples} />);

    const table = screen.getByRole('table', { name: /Checkout latency: the 20 most recent samples/ });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'p50 (ms)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'p95 (ms)' })).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(TABLE_ROWS);
    expect(rows[0]).toHaveTextContent('29');
    expect(rows[0]).toHaveTextContent('129');
  });

  it('says when there is no data', () => {
    render(<DataTable panel={latencyPanel} samples={[]} />);
    expect(screen.getByRole('cell', { name: 'No data yet.' })).toBeInTheDocument();
  });

  it('makes the scrollable region reachable by keyboard', () => {
    render(<DataTable panel={latencyPanel} samples={[makeSample(0)]} />);
    expect(screen.getByRole('region', { name: 'Checkout latency data' })).toHaveAttribute('tabindex', '0');
  });
});

describe('describeChart', () => {
  it('summarizes the chart for its accessible name', () => {
    expect(describeChart(latencyPanel, [])).toBe('Checkout latency chart, no data yet.');
    const label = describeChart(latencyPanel, [makeSample(0, { latencyP50Ms: 95, latencyP95Ms: 210 })]);
    expect(label).toContain('p50 95 ms');
    expect(label).toContain('p95 210 ms');
  });
});
