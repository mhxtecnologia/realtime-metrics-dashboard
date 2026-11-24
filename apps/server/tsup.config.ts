import { defineConfig } from 'tsup';

// Gera um único arquivo CommonJS com todas as dependências embutidas, para a
// imagem distroless não precisar de node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  clean: true,
  noExternal: [/.*/],
});
