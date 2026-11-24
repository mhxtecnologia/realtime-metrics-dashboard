import { z } from 'zod';

/** Versão do protocolo: o servidor a anuncia no `hello` e o cliente recusa outra versão. */
export const PROTOCOL_VERSION = 1;

/** Limite de caracteres de uma mensagem crua, conferido antes do `JSON.parse`. */
export const MAX_MESSAGE_CHARS = 64 * 1024;

/** Máximo de amostras que um `snapshot` pode trazer. */
export const MAX_SNAPSHOT_SAMPLES = 300;

const rate = z.number().finite().nonnegative().max(10_000_000);
const latency = z.number().finite().nonnegative().max(60_000);
const count = z.number().int().nonnegative().max(1_000_000_000);

/** Uma leitura das métricas num instante (`ts` em milissegundos desde a época Unix). */
export const metricsSampleSchema = z
  .object({
    ts: z.number().int().positive(),
    salesPerMinute: rate,
    latencyP50Ms: latency,
    latencyP95Ms: latency,
    errorsPerMinute: count,
    onlineUsers: count,
  })
  .strict()
  .refine((sample) => sample.latencyP95Ms >= sample.latencyP50Ms, {
    message: 'latencyP95Ms must be greater than or equal to latencyP50Ms',
    path: ['latencyP95Ms'],
  });

export type MetricsSample = z.infer<typeof metricsSampleSchema>;

export const helloMessageSchema = z
  .object({
    type: z.literal('hello'),
    version: z.literal(PROTOCOL_VERSION),
    intervalMs: z.number().int().min(50).max(60_000),
  })
  .strict();

export const snapshotMessageSchema = z
  .object({
    type: z.literal('snapshot'),
    data: z.array(metricsSampleSchema).max(MAX_SNAPSHOT_SAMPLES),
  })
  .strict();

export const sampleMessageSchema = z
  .object({
    type: z.literal('sample'),
    data: metricsSampleSchema,
  })
  .strict();

/** Tudo o que o servidor pode mandar; o campo `type` discrimina a variante. */
export const serverMessageSchema = z.discriminatedUnion('type', [
  helloMessageSchema,
  snapshotMessageSchema,
  sampleMessageSchema,
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export type ParseResult = { ok: true; message: ServerMessage } | { ok: false; error: string };

/**
 * Valida um frame recebido do socket. Nunca lança: o dado vem da rede e é tratado
 * como não confiável — tamanho, JSON e formato são conferidos nessa ordem.
 */
export function parseServerMessage(raw: unknown): ParseResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'expected a text frame' };
  }
  if (raw.length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: 'message too large' };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const result = serverMessageSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return { ok: false, error: `${where}${issue?.message ?? 'invalid message'}` };
  }
  return { ok: true, message: result.data };
}

/** Serializa uma mensagem do servidor; o tipo garante que só sai o que o cliente aceita. */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
