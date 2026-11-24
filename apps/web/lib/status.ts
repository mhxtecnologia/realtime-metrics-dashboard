import type { ConnectionStatus } from './reconnecting-socket';

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

/** Detalhe curto ao lado do rótulo: em quanto tempo e em qual tentativa. */
export function statusDetail(status: ConnectionStatus, attempt: number, retryInMs: number | null): string | null {
  if (status === 'reconnecting' && retryInMs !== null) {
    return `attempt ${attempt}, retry in ${Math.max(1, Math.round(retryInMs / 1000))} s`;
  }
  if (status === 'reconnecting') return `attempt ${attempt}`;
  if (status === 'offline') return 'waiting for the network';
  return null;
}
