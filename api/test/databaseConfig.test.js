const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDatabaseConfig } = require('../src/database/database');

test('resolveDatabaseConfig usa sqlite local quando as variaveis do Turso nao existem', () => {
  const config = resolveDatabaseConfig({});

  assert.equal(config.url, 'file:./data/solarbeam.db');
  assert.equal(config.authToken, '');
});

test('resolveDatabaseConfig preserva valores explicitamente configurados', () => {
  const config = resolveDatabaseConfig({ TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'token-123', JWT_SECRET: 'secret' });

  assert.equal(config.url, 'libsql://example.turso.io');
  assert.equal(config.authToken, 'token-123');
});
