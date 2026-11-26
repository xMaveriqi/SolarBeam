const test = require('node:test');
const assert = require('node:assert/strict');
const { usuarioPodeAcessarDispositivo } = require('../src/middleware/deviceAccess');

test('usuario acessa o proprio dispositivo', () => {
  assert.equal(usuarioPodeAcessarDispositivo({ id: 7, role: 'user' }, 7), true);
});

test('usuario nao acessa dispositivo de outro usuario', () => {
  assert.equal(usuarioPodeAcessarDispositivo({ id: 7, role: 'user' }, 8), false);
});

test('administrador acessa qualquer dispositivo', () => {
  assert.equal(usuarioPodeAcessarDispositivo({ id: 1, role: 'admin' }, 8), true);
});

test('sessao ausente nao acessa dispositivo', () => {
  assert.equal(usuarioPodeAcessarDispositivo(null, 8), false);
});
