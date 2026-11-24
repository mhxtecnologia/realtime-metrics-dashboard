import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  HOST: z.string().min(1).optional(),
  TICK_MS: z.coerce.number().int().min(50).max(60_000).default(1000),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  MAX_CLIENTS: z.coerce.number().int().min(1).max(10_000).default(500),
  SEED: z.coerce.number().int().optional(),
});

export interface ServerConfig {
  port: number;
  /** Sem host, o Node escuta em todas as interfaces (IPv4 e IPv6). */
  host: string | undefined;
  tickMs: number;
  allowedOrigins: ReadonlySet<string>;
  maxClients: number;
  seed: number;
}

/** Lê e valida a configuração do ambiente; falha cedo, no boot, com a mensagem do zod. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.parse(env);
  const origins = parsed.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  for (const origin of origins) {
    if (!isOrigin(origin)) {
      throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    tickMs: parsed.TICK_MS,
    allowedOrigins: new Set(origins),
    maxClients: parsed.MAX_CLIENTS,
    seed: parsed.SEED ?? Date.now() >>> 0,
  };
}

// Uma origem é só esquema + host + porta: sem caminho, query ou barra final.
function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}
