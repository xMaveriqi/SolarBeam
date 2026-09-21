const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const firmwarePath = path.join(__dirname, '..', '..', 'esp32-firmware', 'solarbeam_firmware.ino');
const firmware = fs.readFileSync(firmwarePath, 'utf8');

test('o firmware nao desliga a bomba automaticamente em modo manual', () => {
  assert.doesNotMatch(
    firmware,
    /if \(modoOperacao != "automatico" && bombaLigada\(\)\) definirBomba\(false\);/,
    'O firmware não deve forçar desligamento automático quando o modo é manual.'
  );
});

test('um comando aplicado nao e sobrescrito pela automacao no mesmo ciclo', () => {
  assert.match(firmware, /bool comandoAplicado = verificarComandoPendente\(\);/);
  assert.match(firmware, /if \(comandoAplicado\) return;/);
});

test('o desligamento manual bloqueia a automacao ate um novo comando', () => {
  assert.match(firmware, /bool automacaoBloqueadaPorComando = false;/);
  assert.match(firmware, /modoOperacao != "automatico" \|\| automacaoBloqueadaPorComando/);
  assert.match(firmware, /automacaoBloqueadaPorComando = !ligar;/);
});
