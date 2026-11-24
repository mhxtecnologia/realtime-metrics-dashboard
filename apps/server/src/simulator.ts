import type { MetricsSample } from '@realtime-metrics/protocol';
import type { Random } from './random';

export interface Simulator {
  next(ts: number): MetricsSample;
}

const TRAFFIC_CYCLE_MS = 10 * 60 * 1000;

/**
 * Simula o tráfego de uma loja: usuários online seguem uma onda lenta com ruído,
 * e de vez em quando um "incidente" sobe a latência e os erros e derruba as vendas.
 */
export function createSimulator(random: Random): Simulator {
  let users = 1200;
  let incidentTicksLeft = 0;

  // Box-Muller: transforma duas uniformes numa normal padrão.
  const gaussian = (): number => {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  return {
    next(ts) {
      const target = 1500 + 500 * Math.sin((ts / TRAFFIC_CYCLE_MS) * 2 * Math.PI);
      users = clamp(users + (target - users) * 0.05 + gaussian() * 15, 50, 100_000);

      if (incidentTicksLeft === 0 && random() < 0.01) {
        incidentTicksLeft = 10 + Math.floor(random() * 20);
      }
      const stress = incidentTicksLeft > 0 ? 1 : 0;
      if (incidentTicksLeft > 0) incidentTicksLeft -= 1;

      const p50 = clamp(80 + users / 50 + gaussian() * 8 + stress * 120, 5, 30_000);
      const p95 = Math.min(p50 * (1.8 + random() * 0.6 + stress * 1.5), 60_000);
      const errors = Math.max(0, Math.round(users / 800 + gaussian() + stress * (15 + random() * 20)));
      const sales = Math.max(0, users * 0.08 * (1 - stress * 0.35) + gaussian() * 6);

      return {
        ts: Math.trunc(ts),
        salesPerMinute: round1(sales),
        latencyP50Ms: round1(p50),
        latencyP95Ms: round1(p95),
        errorsPerMinute: errors,
        onlineUsers: Math.round(users),
      };
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
