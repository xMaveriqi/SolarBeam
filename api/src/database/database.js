const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Confere se uma coluna ja existe antes de tentar adicionar (mais confiavel
// que tentar capturar o texto do erro, que pode variar entre engines/versoes).
async function colunaExiste(tabela, coluna) {
  const resultado = await db.execute(`PRAGMA table_info(${tabela})`);
  return resultado.rows.some((linha) => linha.name === coluna);
}

async function adicionarColunaSeNaoExistir(tabela, coluna, definicao) {
  const existe = await colunaExiste(tabela, coluna);
  if (!existe) {
    await db.execute(`ALTER TABLE ${tabela} ADD COLUMN ${definicao}`);
    console.log(`Coluna "${coluna}" adicionada em "${tabela}".`);
  }
}

async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL
    )
  `);
  // "email" e usado como "usuario" (login). role = admin ou user.
  await adicionarColunaSeNaoExistir('usuarios', 'role', `role TEXT NOT NULL DEFAULT 'user'`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS dispositivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      usuario_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS leituras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      umidade REAL NOT NULL,
      nivel_agua REAL NOT NULL,
      bateria REAL NOT NULL,
      bomba INTEGER NOT NULL DEFAULT 0,
      data_hora TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await adicionarColunaSeNaoExistir('leituras', 'dispositivo_id', 'dispositivo_id INTEGER');
  await adicionarColunaSeNaoExistir('leituras', 'versao_firmware', 'versao_firmware TEXT');
  await adicionarColunaSeNaoExistir('dispositivos', 'firmware_configurado', 'firmware_configurado INTEGER NOT NULL DEFAULT 0');
  await adicionarColunaSeNaoExistir('dispositivos', 'ultima_leitura', 'ultima_leitura TEXT');
  await adicionarColunaSeNaoExistir('dispositivos', 'versao_firmware', 'versao_firmware TEXT');
  await adicionarColunaSeNaoExistir('dispositivos', 'token_dispositivo', 'token_dispositivo TEXT');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      umidade_minima REAL NOT NULL DEFAULT 30,
      tempo_bomba INTEGER NOT NULL DEFAULT 10,
      modo TEXT NOT NULL DEFAULT 'automatico'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS comandos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bomba INTEGER NOT NULL DEFAULT 0,
      executado INTEGER NOT NULL DEFAULT 0,
      data_hora TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await adicionarColunaSeNaoExistir('comandos', 'dispositivo_id', 'dispositivo_id INTEGER');

  console.log('Banco de dados inicializado (Turso).');
}

module.exports = { db, initDatabase };
