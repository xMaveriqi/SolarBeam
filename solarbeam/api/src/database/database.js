const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Tenta rodar um ALTER TABLE, ignorando erro se a coluna ja existir
async function tentarAlterar(sql) {
  try {
    await db.execute(sql);
  } catch (err) {
    if (!String(err.message).toLowerCase().includes('duplicate column')) {
      throw err;
    }
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
  await tentarAlterar(`ALTER TABLE usuarios ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);

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
  await tentarAlterar(`ALTER TABLE leituras ADD COLUMN dispositivo_id INTEGER`);

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
  await tentarAlterar(`ALTER TABLE comandos ADD COLUMN dispositivo_id INTEGER`);

  console.log('Banco de dados inicializado (Turso).');
}

module.exports = { db, initDatabase };
