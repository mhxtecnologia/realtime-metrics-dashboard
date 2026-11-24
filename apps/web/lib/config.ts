/** Endereço do servidor WebSocket; `NEXT_PUBLIC_*` é embutido no bundle durante o build. */
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/metrics';

/** Origem do socket (esquema + host + porta), usada no `connect-src` da CSP. */
export function socketOrigin(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}
