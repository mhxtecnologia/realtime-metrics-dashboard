'use client';

import { memo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetricsSample } from '@realtime-metrics/protocol';
import { formatClock, formatCompact } from '@/lib/format';
import { PALETTES, type ChartPalette, type PanelConfig, type SeriesConfig } from '@/lib/panels';
import { useThemeStore } from '@/lib/theme';

interface MetricChartProps {
  panel: PanelConfig;
  samples: readonly MetricsSample[];
  animate: boolean;
}

const ANIMATION_MS = 300;

function renderSeries(series: SeriesConfig, palette: ChartPalette, animate: boolean) {
  const color = palette.series[series.colorIndex];
  const common = {
    dataKey: series.key,
    name: series.label,
    isAnimationActive: animate,
    animationDuration: ANIMATION_MS,
  };
  switch (series.kind) {
    case 'bar':
      return <Bar key={series.key} {...common} fill={color} />;
    case 'area':
      return (
        <Area key={series.key} {...common} type="monotone" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.15} />
      );
    case 'line':
      return (
        <Line
          key={series.key}
          {...common}
          type="monotone"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={series.dashed ? '6 4' : undefined}
          dot={false}
        />
      );
  }
}

/** Só o gráfico; memoizado para re-renderizar apenas quando a janela de amostras muda. */
export const MetricChart = memo(function MetricChart({ panel, samples, animate }: MetricChartProps) {
  const theme = useThemeStore((state) => state.resolved);
  const palette = PALETTES[theme];
  const tick = { fill: palette.axis, fontSize: 12 };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={samples as MetricsSample[]} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value: number) => formatClock(value)}
          stroke={palette.axis}
          tick={tick}
          minTickGap={48}
        />
        <YAxis stroke={palette.axis} tick={tick} width={56} tickFormatter={(value: number) => formatCompact(value)} />
        <Tooltip
          isAnimationActive={animate}
          labelFormatter={(value) => formatClock(Number(value))}
          contentStyle={{ background: palette.surface, borderColor: palette.grid, color: palette.text }}
        />
        <Legend wrapperStyle={{ color: palette.text }} />
        {panel.series.map((series) => renderSeries(series, palette, animate))}
      </ComposedChart>
    </ResponsiveContainer>
  );
});
