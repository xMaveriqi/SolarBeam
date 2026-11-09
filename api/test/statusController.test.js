const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizarEstadoBomba,
  paraHorarioBrasilia,
} = require('../src/controllers/statusController');
const { normalizarEstadoBomba: normalizarEstadoBombaSensor } = require('../src/controllers/sensoresController');

test('normalizarEstadoBomba reconhece valores ligados sem tratar zero textual como verdadeiro', () => {
  assert.equal(normalizarEstadoBomba(true), true);
  assert.equal(normalizarEstadoBomba(1), true);
  assert.equal(normalizarEstadoBomba('1'), true);
  assert.equal(normalizarEstadoBomba('true'), true);
  assert.equal(normalizarEstadoBomba(' TRUE '), true);
  assert.equal(normalizarEstadoBomba(false), false);
  assert.equal(normalizarEstadoBomba(0), false);
  assert.equal(normalizarEstadoBomba('0'), false);
  assert.equal(normalizarEstadoBomba('false'), false);
});

test('normalizarEstadoBomba do sensor aceita booleanos numericos e string em JSON real do ESP', () => {
  assert.equal(normalizarEstadoBombaSensor(true), true);
  assert.equal(normalizarEstadoBombaSensor(1), true);
  assert.equal(normalizarEstadoBombaSensor('1'), true);
  assert.equal(normalizarEstadoBombaSensor('false'), false);
  assert.equal(normalizarEstadoBombaSensor('0'), false);
});

test('paraHorarioBrasilia converte UTC para UTC-3 sem depender do fuso do servidor', () => {
  assert.equal(paraHorarioBrasilia('2025-01-15 12:34:56'), '2025-01-15 09:34:56');
});