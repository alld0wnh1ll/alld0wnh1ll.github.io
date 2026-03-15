# Quick Reference - Ethereum Lab

One-page cheat sheet for instructors during class.

---

## Start the Lab

```bash
# Start everything (blockchain + frontend)
docker compose up --build

# View logs if needed
docker compose logs -f

# Stop when done
docker compose down
```

---

## Share with Students

Write on board or share screen:

| Item | Value |
|------|-------|
| **Frontend** | `http://<YOUR-IP>:5173` |
| **RPC URL** | `http://<YOUR-IP>:8545` |
| **Contract** | *(from console output)* |

**Find your IP:**
- Windows: `ipconfig` → IPv4 Address
- Mac/Linux: `hostname -I` or `ifconfig`

---

## CLI Labs Access

```bash
# In Docker container:
docker compose exec ethereum-trainer bash
cd /app/scripts/cli-labs/standalone
node interactive.js

# Or locally (if not using Docker):
cd scripts/cli-labs/standalone
npm start
```

**Interactive menu options:** 1–4 Explore, 5–6 Transact, 7 Contract, 8 Playground, **9** Contract Builder Lab, **10** Account Manager, **11** Ransomware Investigation, **12** Advanced Ransomware, **13** Token Concepts.

---

## Key Concepts (Student Glossary)

| Term | Quick Explanation |
|------|-------------------|
| **Wallet** | Private key + address |
| **Private Key** | Master password - lose it, lose funds |
| **Address** | Your public identity (0x...) |
| **Gas** | Transaction fee for computation |
| **Staking** | Lock ETH to become validator |
| **Validator** | Node that proposes/verifies blocks |
| **Slashing** | Penalty for dishonest validators |
| **Smart Contract** | Code deployed on blockchain |
| **EOA** | Externally Owned Account (wallet) |

---

## Common Fixes

| Problem | Quick Fix |
|---------|-----------|
| "Not connected" | Check RPC URL, firewall ports 8545/5173 |
| "Contract not found" | Verify address from console output |
| "Student can't connect" | Same network + use YOUR IP (not localhost) |
| "No balance" | Click "Get 5 ETH" button |
| "Transaction stuck" | Wait for block or check gas |
| "Lost private key" | Create new wallet (cannot recover) |
| "CLI won't start" | Run `npm install` first |

---

## Dashboard URL

Show live contract activity: `http://<YOUR-IP>:5173/dashboard.html`

---

## Lab Quick Links

| Lab | Time | Difficulty |
|-----|------|------------|
| Web Interface (Live tab) | 30-45 min | Beginner |
| CLI Lab 1: Explore Blockchain | 20 min | Beginner |
| CLI Lab 2: Sign Transaction | 30 min | Beginner |
| CLI Lab 3: Contract Interaction | 30 min | Beginner |
| CLI Lab 4: Forensics | 45 min | Intermediate |
| Smart Contract Guide | 45 min | Intermediate |
| Ransomware Investigation | 60-90 min | Intermediate |

---

## Emergency Commands

```bash
# Restart everything
docker compose down && docker compose up --build

# Check if node is running
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# View contract address
cat CONTRACT_ADDRESS.txt
```

---

## Discussion Starters

- "What just happened when you sent ETH?"
- "Why would someone stake their ETH?"
- "How is this different from a bank transfer?"
- "Can you undo a blockchain transaction?"

---

*Full guide: [INSTRUCTOR_FACILITATION_GUIDE.md](INSTRUCTOR_FACILITATION_GUIDE.md)*
