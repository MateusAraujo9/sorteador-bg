const js = require('@eslint/js');
const security = require('eslint-plugin-security');

const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  fetch: 'readonly',
  AbortSignal: 'readonly'
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  crypto: 'readonly',
  requestAnimationFrame: 'readonly',
  navigator: 'readonly',
  AbortSignal: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  HTMLElement: 'readonly'
};

module.exports = [
  { ignores: ['node_modules/**', 'data/**'] },
  js.configs.recommended,
  security.configs.recommended,
  {
    // inclui este próprio arquivo de config, que também é CommonJS
    files: ['src/**/*.js', 'server.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: nodeGlobals
    }
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: browserGlobals
    }
  },
  {
    // detect-object-injection e detect-non-literal-fs-filename são notoriamente barulhentas
    // (alertam em qualquer obj[chave] ou fs.*Sync(caminhoVariável), mesmo quando a chave/caminho
    // nunca vem de entrada do usuário — como em todos os casos deste projeto). Deixadas ligadas,
    // só treinam a ignorar avisos do linter. O restante das regras de segurança recomendadas
    // (eval, regex inseguro, require não-literal, child_process...) continua ativo.
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off'
    }
  }
];
