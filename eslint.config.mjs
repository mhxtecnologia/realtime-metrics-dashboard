// Lint do servidor e do pacote de protocolo; o app web tem a própria configuração (Next.js).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'apps/web/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
);
