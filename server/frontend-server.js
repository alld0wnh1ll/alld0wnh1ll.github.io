#!/usr/bin/env node
/**
 * Frontend server with Lab API
 * Serves static files and /lab-api/* routes.
 * Replaces 'serve' in Docker instructor mode.
 */

const express = require('express');
const path = require('path');
const { app: labApiApp } = require('./lab-api');

const PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);
const DIST = path.join(__dirname, '..', 'frontend', 'dist');

const app = express();

// RPC proxy - avoids CORS when browser connects to Hardhat node (same-origin)
const RPC_PORT = parseInt(process.env.RPC_PORT || '8545', 10);
const RPC_TARGET = `http://127.0.0.1:${RPC_PORT}`;
app.use('/rpc-proxy', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const r = await fetch(RPC_TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message }, id: req.body?.id ?? null });
  }
});

// Lab API (must be before static)
app.use('/lab-api', labApiApp);

// Static files
app.use(express.static(DIST));

// SPA fallback (use middleware to avoid path-to-regexp '*' incompatibility)
app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend + Lab API on http://0.0.0.0:${PORT}`);
  console.log(`  Lab API: /lab-api/session, /lab-api/fund-request, /lab-api/fund-requests`);
});
