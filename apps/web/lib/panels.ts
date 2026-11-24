import type { MetricsSample } from '@realtime-metrics/protocol';
import type { ResolvedTheme } from './theme';

export type MetricKey = Exclude<keyof MetricsSample, 'ts'>;

export interface SeriesConfig {
  key: MetricKey;
  label: string;
  kind: 'line' | 'bar' | 'area';
  colorIndex: 0 | 1 | 2 | 3;
  /** Tracejado: a série não depende só da cor para ser distinguida (WCAG 1.4.1). */
  dashed?: boolean;
}

export interface PanelConfig {
  id: string;
  title: string;
  description: string;
  unit: string;
  fractionDigits: number;
  series: readonly SeriesConfig[];
}

export const PANELS: readonly PanelConfig[] = [
  {
    id: 'sales',
    title: 'Sales per minute',
    description: 'Completed checkouts per minute.',
    unit: 'per min',
    fractionDigits: 1,
    series: [{ key: 'salesPerMinute', label: 'Sales', kind: 'line', colorIndex: 0 }],
  },
  {
    id: 'latency',
    title: 'Checkout latency',
    description: 'Median (p50) and 95th percentile (p95) response time.',
    unit: 'ms',
    fractionDigits: 0,
    series: [
      { key: 'latencyP50Ms', label: 'p50', kind: 'line', colorIndex: 0 },
      { key: 'latencyP95Ms', label: 'p95', kind: 'line', colorIndex: 1, dashed: true },
    ],
  },
  {
    id: 'errors',
    title: 'Errors per minute',
    description: 'Failed requests per minute.',
    unit: 'per min',
    fractionDigits: 0,
    series: [{ key: 'errorsPerMinute', label: 'Errors', kind: 'bar', colorIndex: 1 }],
  },
  {
    id: 'users',
    title: 'Users online',
    description: 'Active sessions right now.',
    unit: 'users',
    fractionDigits: 0,
    series: [{ key: 'onlineUsers', label: 'Users', kind: 'area', colorIndex: 2 }],
  },
];

export interface ChartPalette {
  series: readonly [string, string, string, string];
  axis: string;
  grid: string;
  surface: string;
  text: string;
}

// Cores das séries com contraste de pelo menos 3:1 sobre o fundo do cartão (WCAG 1.4.11).
export const PALETTES: Record<ResolvedTheme, ChartPalette> = {
  light: {
    series: ['#1d4ed8', '#b91c1c', '#047857', '#6d28d9'],
    axis: '#4b5563',
    grid: '#d1d5db',
    surface: '#ffffff',
    text: '#14171a',
  },
  dark: {
    series: ['#60a5fa', '#f87171', '#34d399', '#c4b5fd'],
    axis: '#a7b0bc',
    grid: '#2d3440',
    surface: '#171b21',
    text: '#e8eaed',
  },
};
