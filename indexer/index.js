const { ethers } = require("ethers");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { init, getDb, getLastBlock, setLastBlock } = require("./db");
const { decodeLog, getContractNameByAddress } = require("./decoder");
const { registerRoutes } = require("./routes");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PORT = parseInt(process.env.PORT || "3001", 10);

function loadConfig() {
  const paths = [
    path.join(__dirname, "..", "frontend", "public", "game-config.json"),
    path.join(__dirname, "game-config.json"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  throw new Error("game-config.json not found. Run deploy:game first.");
}

function getContractAddresses(config) {
  return [
    config.gameController,
    config.priceOracle,
    config.inspectionRegistry,
    config.carLot,
    config.bank,
    config.mixer,
    config.marketplace,
    config.insuranceDesk,
    config.tokenFactory,
  ].filter(Boolean);
}

function processEvent(log, decoded, blockNumber, txHash) {
  const db = getDb();
  const contractName = decoded.contractName;
  const eventName = decoded.eventName;
  const args = decoded.args;

  const argsJson = JSON.stringify(
    args.map((a) => (typeof a === "bigint" ? a.toString() : a))
  );

  db.prepare(
    `INSERT INTO events (block_number, tx_hash, contract_address, event_name, args) VALUES (?, ?, ?, ?, ?)`
  ).run(blockNumber, txHash, log.address, eventName, argsJson);

  db.prepare(
    `INSERT INTO transactions (tx_hash, block_number, contract_name, event_name, data) VALUES (?, ?, ?, ?, ?)`
  ).run(txHash, blockNumber, contractName, eventName, argsJson);

  if (eventName === "PlayerRegistered") {
    const addr = args[0] ?? args?.player;
    const addrStr = typeof addr === "string" ? addr : addr?.toString?.();
    if (addrStr && addrStr.length === 42) {
      db.prepare("INSERT OR REPLACE INTO players (address, registered) VALUES (?, 1)").run(
        addrStr.toLowerCase()
      );
    }
  }
  if (eventName === "CarSold" && args.length >= 3) {
    db.prepare(
      `INSERT INTO car_sales (token_id, seller, buyer, price, block_number) VALUES (?, ?, ?, ?, ?)`
    ).run(
      args[0]?.toString?.() ?? args[0],
      "",
      args[1],
      args[2]?.toString?.() ?? args[2],
      blockNumber
    );
  }
  if (eventName === "TokenCreated" && args[0]) {
    db.prepare(
      `INSERT INTO tokens (address, name, symbol, creator, block_number) VALUES (?, ?, ?, ?, ?)`
    ).run(args[0], args[1] || "", args[2] || "", args[3] || "", blockNumber);
  }
  if (eventName === "MixDepositMade" && args.length >= 3) {
    db.prepare(
      `INSERT INTO mixer_deposits (deposit_index, depositor, amount, deposit_epoch, withdrawn, block_number) VALUES (?, ?, ?, 0, 0, ?)`
    ).run(args[0]?.toString?.() ?? args[0], args[1], args[2]?.toString?.() ?? args[2], blockNumber);
  }
  if (["GameStarted", "EpochAdvanced", "AccountFrozen", "AccountUnfrozen"].includes(eventName)) {
    db.prepare(
      `INSERT INTO game_events (event_type, data, block_number) VALUES (?, ?, ?)`
    ).run(eventName, argsJson, blockNumber);
  }
}

async function indexBlock(provider, config, fromBlock, toBlock) {
  const addresses = getContractAddresses(config);
  if (addresses.length === 0) return toBlock;

  const logs = await provider.getLogs({
    address: addresses,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const decoded = decodeLog(log, config);
    if (decoded) {
      const block = await provider.getBlock(log.blockNumber);
      processEvent(log, decoded, log.blockNumber, log.transactionHash);
    }
  }

  return toBlock;
}

async function runIndexer(provider, config) {
  let lastBlock = getLastBlock();
  const currentBlock = await provider.getBlockNumber();
  if (lastBlock === 0) lastBlock = currentBlock - 1;

  const batchSize = 1000;
  let from = lastBlock + 1;
  while (from <= currentBlock) {
    const to = Math.min(from + batchSize - 1, currentBlock);
    await indexBlock(provider, config, from, to);
    setLastBlock(to);
    lastBlock = to;
    from = to + 1;
  }
}

async function main() {
  const config = loadConfig();
  init();

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });
  registerRoutes(app, { provider, rpcUrl: RPC_URL });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chain City Indexer listening on http://localhost:${PORT}`);
    console.log(`  Health: GET /api/health`);
    console.log(`  Leaderboard: GET /api/game/leaderboard`);
    console.log(`  Transactions: GET /api/game/transactions/feed`);
  });

  async function poll() {
    try {
      await runIndexer(provider, config);
    } catch (e) {
      console.error("Indexer error:", e.message);
    }
    setTimeout(poll, 5000);
  }
  poll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
