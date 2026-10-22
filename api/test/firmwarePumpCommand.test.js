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

test('um comando aplicado tem prioridade sobre a automacao no mesmo ciclo', () => {
  assert.match(firmware, /bool comandoAplicado = false;/);
  assert.match(firmware, /comandoAplicado = verificarComandoPendente\(\);/);
  assert.match(firmware, /if \(!modoConfigAtivo && !comandoAplicado\) \{\s*executarIrrigacaoAutomatica\(\);/);
});

test('um desligamento manual suspende a automacao ate um novo comando ou troca para automatico', () => {
  assert.match(firmware, /bool bombaDesligadaManualmente = false;/);
  assert.match(firmware, /modoOperacao != "automatico" || bombaDesligadaManualmente/);
  assert.match(firmware, /bombaDesligadaManualmente = novoValor;/);
  assert.match(firmware, /novoModo == "automatico" && modoOperacao != "automatico" && bombaDesligadaManualmente/);
});
