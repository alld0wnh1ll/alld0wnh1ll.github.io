const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "game.db");
let db;

function init() {
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS index_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      address TEXT PRIMARY KEY,
      secret_objective TEXT,
      registered INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT,
      epoch INTEGER,
      balance TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT,
      block_number INTEGER,
      contract_name TEXT,
      event_name TEXT,
      data TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_number INTEGER,
      tx_hash TEXT,
      contract_address TEXT,
      event_name TEXT,
      args TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS car_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER,
      seller TEXT,
      buyer TEXT,
      price TEXT,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower TEXT,
      principal TEXT,
      collateral TEXT,
      active INTEGER,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER,
      holder TEXT,
      premium TEXT,
      coverage TEXT,
      status TEXT,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS mixer_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_index INTEGER,
      depositor TEXT,
      amount TEXT,
      deposit_epoch INTEGER,
      withdrawn INTEGER,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT,
      name TEXT,
      symbol TEXT,
      creator TEXT,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      data TEXT,
      block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_balance_snapshots_address ON balance_snapshots(address);
    CREATE INDEX IF NOT EXISTS idx_balance_snapshots_epoch ON balance_snapshots(epoch);
    CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions(block_number);
    CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
    CREATE INDEX IF NOT EXISTS idx_car_sales_buyer ON car_sales(buyer);
    CREATE INDEX IF NOT EXISTS idx_car_sales_seller ON car_sales(seller);
    CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower);
  `);

  return db;
}

function getDb() {
  if (!db) return init();
  return db;
}

function getLastBlock() {
  const d = getDb();
  const row = d.prepare("SELECT value FROM index_state WHERE key = 'lastBlock'").get();
  return row ? parseInt(row.value, 10) : 0;
}

function setLastBlock(block) {
  getDb().prepare("INSERT OR REPLACE INTO index_state (key, value) VALUES (?, ?)").run("lastBlock", String(block));
}

module.exports = { init, getDb, getLastBlock, setLastBlock };
