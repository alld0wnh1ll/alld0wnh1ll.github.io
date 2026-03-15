const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const { getDb } = require("./db");

const PoS_EVENTS_ABI = [
  "event Staked(address indexed validator, uint256 amount)",
  "event NewMessage(address indexed sender, string message, uint256 timestamp)",
];

function registerRoutes(app, opts = {}) {
  const { provider, rpcUrl } = opts;
  // Chrome DevTools probes this path; return 204 to avoid 404 + strict CSP console noise
  app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(204).end();
  });

  app.get("/", (req, res) => {
    res.json({
      service: "chain-city-indexer",
      status: "running",
      docs: {
        health: "GET /api/health",
        leaderboard: "GET /api/game/leaderboard",
        addresses: "GET /api/game/addresses/detect",
        transactions: "GET /api/game/transactions/feed",
      },
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", service: "chain-city-indexer" });
  });

  app.get("/api/game/state", async (req, res) => {
    try {
      const db = getDb();
      const lastBlock = db.prepare("SELECT value FROM index_state WHERE key = 'lastBlock'").get();
      res.json({
        lastIndexedBlock: lastBlock ? parseInt(lastBlock.value, 10) : 0,
        status: "ok",
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/leaderboard", (req, res) => {
    try {
      const db = getDb();
      const snapshots = db
        .prepare(
          `SELECT address, balance, epoch FROM balance_snapshots 
           WHERE epoch = (SELECT MAX(epoch) FROM balance_snapshots)
           ORDER BY CAST(balance AS INTEGER) DESC
           LIMIT 50`
        )
        .all();
      const addresses = snapshots.map((r) => r.address);
      const balances = snapshots.map((r) => r.balance);
      res.json({ addresses, balances });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/players", (req, res) => {
    try {
      const db = getDb();
      const fromPlayers = db.prepare("SELECT address FROM players").all();
      let fromLeaderboard = [];
      try {
        const maxEpoch = db.prepare("SELECT MAX(epoch) FROM balance_snapshots").get();
        if (maxEpoch && maxEpoch['MAX(epoch)'] != null) {
          fromLeaderboard = db.prepare("SELECT DISTINCT address FROM balance_snapshots WHERE epoch = ? AND address != ''").all(maxEpoch['MAX(epoch)']);
        }
      } catch (_) {}
      const fromBuyers = db.prepare("SELECT DISTINCT buyer AS address FROM car_sales WHERE buyer != ''").all();
      const fromSellers = db.prepare("SELECT DISTINCT seller AS address FROM car_sales WHERE seller != ''").all();
      const seen = new Set();
      const addresses = [];
      for (const row of [...fromPlayers, ...fromLeaderboard, ...fromBuyers, ...fromSellers]) {
        const addr = (row.address || "").toLowerCase();
        if (addr && addr.length === 42 && !seen.has(addr)) {
          seen.add(addr);
          addresses.push(addr);
        }
      }
      res.json({ addresses });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/addresses/detect", async (req, res) => {
    try {
      const seen = new Set();
      const addresses = [];

      if (provider) {
        const posPath = path.join(__dirname, "..", "CONTRACT_ADDRESS.txt");
        if (fs.existsSync(posPath)) {
          const posAddress = fs.readFileSync(posPath, "utf8").trim();
          if (posAddress && posAddress.length === 42) {
            try {
              const code = await provider.getCode(posAddress);
              if (code && code !== "0x" && code !== "0x0") {
                const pos = new ethers.Contract(posAddress, PoS_EVENTS_ABI, provider);
                const [stakeEvents, msgEvents] = await Promise.all([
                  pos.queryFilter("Staked", 0),
                  pos.queryFilter("NewMessage", 0),
                ]);
                for (const e of stakeEvents) {
                  const addr = (e.args && (e.args[0] ?? e.args.validator))?.toLowerCase?.();
                  if (addr && addr.length === 42 && !seen.has(addr)) {
                    seen.add(addr);
                    addresses.push(addr);
                  }
                }
                for (const e of msgEvents) {
                  const addr = (e.args && (e.args[0] ?? e.args.sender))?.toLowerCase?.();
                  if (addr && addr.length === 42 && !seen.has(addr)) {
                    seen.add(addr);
                    addresses.push(addr);
                  }
                }
              }
            } catch (posErr) {
              console.warn("[indexer] PoS detect error:", posErr.message);
            }
          }
        }

        if (addresses.length === 0) {
          try {
            const block = await provider.getBlockNumber();
            const from = Math.max(0, block - 100);
            for (let b = block; b >= from && b > 0; b--) {
              const blockData = await provider.getBlock(b, true);
              if (blockData?.transactions) {
                for (const tx of blockData.transactions) {
                  const fromAddr = typeof tx === "object" && tx.from ? tx.from.toLowerCase() : null;
                  if (fromAddr && fromAddr.length === 42 && !seen.has(fromAddr)) {
                    seen.add(fromAddr);
                    addresses.push(fromAddr);
                  }
                }
              }
            }
          } catch (txErr) {
            console.warn("[indexer] Recent tx detect error:", txErr.message);
          }
        }
      }

      const db = getDb();
      const registeredRows = db.prepare("SELECT LOWER(address) AS address FROM players").all();
      const registeredSet = new Set(registeredRows.map((r) => r.address));

      const items = addresses.map((addr) => ({
        address: addr,
        registered: registeredSet.has(addr),
      }));

      res.json({ addresses: items });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/player/:address", (req, res) => {
    try {
      const db = getDb();
      const addr = req.params.address.toLowerCase();
      const player = db.prepare("SELECT * FROM players WHERE LOWER(address) = ?").get(addr);
      const snapshots = db
        .prepare(
          "SELECT epoch, balance FROM balance_snapshots WHERE LOWER(address) = ? ORDER BY epoch"
        )
        .all(addr);
      const txs = db
        .prepare(
          `SELECT * FROM transactions WHERE data LIKE ? ORDER BY block_number DESC LIMIT 50`
        )
        .all(`%${addr}%`);
      res.json({ player: player || null, balanceHistory: snapshots, transactions: txs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/transactions/feed", (req, res) => {
    try {
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const rows = db
        .prepare(
          `SELECT tx_hash, block_number, contract_name, event_name, data, created_at 
           FROM transactions ORDER BY block_number DESC LIMIT ?`
        )
        .all(limit);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/cars/listings", (req, res) => {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          `SELECT * FROM events WHERE event_name = 'CarListed' ORDER BY block_number DESC LIMIT 50`
        )
        .all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/cars/sales", (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT * FROM car_sales ORDER BY block_number DESC LIMIT 50").all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/loans", (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT * FROM loans WHERE active = 1").all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/insurance", (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT * FROM insurance_policies").all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/tokens", (req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT * FROM tokens").all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/game/events", (req, res) => {
    try {
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const rows = db
        .prepare(
          `SELECT * FROM game_events ORDER BY block_number DESC LIMIT ?`
        )
        .all(limit);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerRoutes };
