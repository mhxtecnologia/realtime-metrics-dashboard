import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ port: 4000, host: undefined, tickMs: 1000, maxClients: 500 });
    expect([...config.allowedOrigins]).toEqual(['http://localhost:3000']);
  });

  it('parses values from the environment', () => {
    const config = loadConfig({
      PORT: '8080',
      HOST: '127.0.0.1',
      TICK_MS: '250',
      ALLOWED_ORIGINS: 'https://a.example, https://b.example:8443',
      MAX_CLIENTS: '20',
      SEED: '42',
    });
    expect(config).toMatchObject({ port: 8080, host: '127.0.0.1', tickMs: 250, maxClients: 20, seed: 42 });
    expect([...config.allowedOrigins]).toEqual(['https://a.example', 'https://b.example:8443']);
  });

  it('rejects out-of-range numbers', () => {
    expect(() => loadConfig({ TICK_MS: '10' })).toThrow();
    expect(() => loadConfig({ PORT: '70000' })).toThrow();
    expect(() => loadConfig({ MAX_CLIENTS: 'lots' })).toThrow();
  });

  it('rejects malformed origins', () => {
    expect(() => loadConfig({ ALLOWED_ORIGINS: 'http://localhost:3000/' })).toThrow(/invalid origin/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: '*' })).toThrow(/invalid origin/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: 'ftp://files.example' })).toThrow(/invalid origin/);
  });
});
