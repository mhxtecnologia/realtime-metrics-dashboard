import { loadConfig } from './config';
import { createLogger } from './logger';
import { mulberry32 } from './random';
import { METRICS_PATH, createMetricsServer } from './server';
import { createSimulator } from './simulator';

async function main(): Promise<void> {
  const logger = createLogger();
  const config = loadConfig();
  const server = createMetricsServer({
    config,
    simulator: createSimulator(mulberry32(config.seed)),
    logger,
  });

  const port = await server.listen();
  logger.info('metrics server listening', {
    port,
    path: METRICS_PATH,
    tickMs: config.tickMs,
    allowedOrigins: [...config.allowedOrigins],
  });

  // Desligamento gracioso: avisa os clientes (1001) antes de encerrar o processo.
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('shutting down', { signal });
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('shutdown failed', { error: String(error) });
        process.exit(1);
      },
    );
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  process.stderr.write(`fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
