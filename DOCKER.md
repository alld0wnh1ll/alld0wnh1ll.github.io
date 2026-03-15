# Docker Deployment Guide

This guide explains how to deploy the Ethereum Immersive Trainer using Docker.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- At least 4GB RAM available for Docker

## Quick Start (Instructor Mode)

```bash
# Build and run
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

Once running:
- **Frontend**: http://localhost:5173
- **Blockchain RPC**: http://localhost:8545

## Deployment Modes

### 1. Instructor Mode (Default)

Runs a full blockchain node with deployed contracts. Use this on the instructor's machine.

```bash
docker-compose up --build
```

**What it does:**
- Starts a Hardhat blockchain node
- Deploys the PoS Simulator contract
- Serves the frontend web application
- Provides RPC endpoint for students to connect

**After startup, you'll see:**
```
╔════════════════════════════════════════════════════════════╗
║  ✓ INSTRUCTOR NODE IS RUNNING                              ║
╠════════════════════════════════════════════════════════════╣
║  Blockchain RPC:    http://localhost:8545                  ║
║  Frontend:          http://localhost:5173                  ║
║  CONTRACT ADDRESS:  0x...                                  ║
╚════════════════════════════════════════════════════════════╝
```

### 2. Student Mode

Runs only the frontend, connecting to an instructor's blockchain.

> **Important:** Students must set `INSTRUCTOR_RPC_URL` to the instructor's actual IP address (e.g., `http://192.168.1.100:8545`), **not** `localhost` or `127.0.0.1`. Using localhost will try to connect to the student's own machine, which won't have a blockchain running.

```bash
# Set instructor's IP and run
INSTRUCTOR_RPC_URL=http://<instructor-ip>:8545 docker-compose -f docker-compose.student.yml up --build
```

Or create a `.env` file:
```env
INSTRUCTOR_RPC_URL=http://192.168.1.100:8545
CONTRACT_ADDRESS=0x...
```

Then run:
```bash
docker-compose -f docker-compose.student.yml up --build
```

## Sharing with Students

### Find Your IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Linux/Mac:**
```bash
hostname -I   # Linux
ifconfig      # Mac
```

### Share This Information

Give students:
1. **RPC URL**: `http://<your-ip>:8545`
2. **Frontend URL**: `http://<your-ip>:5173`
3. **Contract Address**: Shown in startup output

Students can either:
- Open `http://<your-ip>:5173` directly in their browser
- Run their own student container connecting to your RPC

### Lab Terminal (Remote Students)

The **Lab Terminal** in the web UI gives students a browser-based shell. Two setups:

| Student setup | Terminal runs on | RPC / Hardhat |
|---------------|------------------|---------------|
| Opens instructor's URL (`http://<instructor-ip>:5173`) | Instructor's container | `npm run console` or `npx hardhat console --network localhost` |
| Runs own student container (`localhost:5173`) | Student's container | `npx hardhat console --network instructor` (RPC_URL auto-injected) |

**For students using the instructor's URL:** Ensure your firewall allows inbound TCP on ports **3002, 3003, 3004** (Lab Terminal WebSocket). Students connect to `ws://<your-ip>:3002`.

**For students running their own container:** The student container includes the Lab Terminal. RPC_URL is injected from the Connection Setup (instructor's RPC). Use `--network instructor` for Hardhat console.

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `instructor` | `instructor` or `student` |
| `RPC_PORT` | `8545` | Blockchain RPC port |
| `FRONTEND_PORT` | `5173` | Frontend web server port |
| `INSTRUCTOR_RPC_URL` | - | (Student mode) Instructor's RPC URL |
| `CONTRACT_ADDRESS` | - | Pre-configure contract address |

### Custom Ports

```yaml
# In docker-compose.yml
ports:
  - "9545:8545"    # Map RPC to port 9545
  - "3000:5173"    # Map frontend to port 3000
```

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Check container status
docker-compose ps

# Execute command in running container
docker-compose exec ethereum-trainer bash
```

## Accessing CLI Labs

The CLI labs are included in the Docker image. To use them:

```bash
# Enter the container
docker-compose exec ethereum-trainer bash

# Navigate to CLI labs
cd /app/scripts/cli-labs/standalone

# Run interactive CLI
node interactive.js
```

### Opening Multiple Shells

Many labs require **two or more shells** (e.g., one for the lab, one for Hardhat console). Open separate terminal windows on your host machine and run the same command in each:

**Terminal 1:**
```bash
docker-compose exec ethereum-trainer bash
```

**Terminal 2:**
```bash
docker-compose exec ethereum-trainer bash
```

Each command opens an independent shell inside the same container, sharing the same blockchain state.

### Lab-Specific Setup

#### Forensics Labs (Ransomware Investigation)

The forensics labs require generating a scenario first:

```bash
# Enter container
docker-compose exec ethereum-trainer bash

# Generate the scenario (creates victim, attacker, tumblers)
cd /app/scripts/cli-labs/standalone
node forensics-setup.js           # Basic scenario
# OR
node forensics-setup-advanced.js  # Advanced multi-victim scenario

# Run the lab
node 6-ransomware-investigation.js   # Basic
# OR
node 7-ransomware-advanced.js        # Advanced
```

**Important:** The blockchain starts fresh in Docker. Victim addresses from previous (non-Docker) sessions won't exist. Always run the setup script first and use the addresses it generates.

#### House Sale Lab (Multi-Party)

For labs involving multiple roles (Admin, Seller, Buyer), each participant needs their own shell:

**Admin Terminal:**
```bash
docker-compose exec ethereum-trainer bash
npm run console
```

**Seller Terminal:**
```bash
docker-compose exec ethereum-trainer bash
npm run console
```

**Buyer Terminal:**
```bash
docker-compose exec ethereum-trainer bash
npm run console
```

See `docs/HOUSE_SALE_LAB.md` for complete instructions.

#### Classroom Vote Lab

```bash
# Enter container
docker-compose exec ethereum-trainer bash

# Deploy via CLI
cd /app/scripts/cli-labs/standalone
node interactive.js
# Select: 7. Contract Builder Lab → 6. Classroom Voting Demo

# Or via Hardhat console
npm run console
```

Dashboard available at: `http://localhost:5173/dashboard.html`

### Path Reference

| Local Path | Docker Path |
|------------|-------------|
| `scripts/cli-labs/standalone/` | `/app/scripts/cli-labs/standalone/` |
| `contracts/student/` | `/app/contracts/student/` |
| `docs/` | `/app/docs/` |

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Ensure ports aren't in use
netstat -an | grep 8545
netstat -an | grep 5173
```

### Students can't connect

1. **Check firewall**: Ensure ports 8545 and 5173 are open
2. **Check network**: Students must be on the same network or have network access
3. **Verify IP**: Make sure you're sharing the correct IP address

**Windows Firewall:**
```powershell
# Allow ports through firewall (run as admin)
netsh advfirewall firewall add rule name="Ethereum Trainer RPC" dir=in action=allow protocol=tcp localport=8545
netsh advfirewall firewall add rule name="Ethereum Trainer Frontend" dir=in action=allow protocol=tcp localport=5173
```

**Linux:**
```bash
sudo ufw allow 8545
sudo ufw allow 5173
```

### "HardhatEthersProvider.resolveName is not implemented"

When running example scripts in the Hardhat console, you may see this error. **Fix:** In the web UI, click an example script to open the popup—the script includes a fix at the top. Copy the full script and paste it into the Hardhat console. Also replace placeholder addresses like `'0x...'` with the real contract address (0x + 40 hex chars) from your instructor.

### "Transaction reverted" or "execution reverted (no data present)"

If you see `Transaction reverted without a reason`, `require(false)`, or `Stake info error: execution reverted` in the logs or browser console, the frontend is calling a contract that doesn't match the expected PoS contract (e.g., wrong contract at that address or stale blockchain state).

**Fix:**

```bash
# Stop and remove volumes (clears any persisted blockchain data)
docker-compose down -v

# Rebuild and start fresh
docker-compose up --build
```

Then clear your browser's localStorage for the app (or use an incognito window) so it fetches the fresh contract address from `/api/config.json`.

### Blockchain state lost after restart

By default, blockchain state persists via Docker volumes. If you want a fresh start:

```bash
docker-compose down -v
docker-compose up --build
```

### Out of memory

Add resource limits to `docker-compose.yml`:

```yaml
services:
  ethereum-trainer:
    deploy:
      resources:
        limits:
          memory: 4G
```

## Production Deployment

For production deployment (e.g., cloud server):

1. **Use HTTPS** - Put behind a reverse proxy (nginx, traefik)
2. **Set resource limits** - Prevent runaway memory usage
3. **Enable restart policy** - Already set to `unless-stopped`
4. **Monitor logs** - Use Docker logging drivers

### Example with Nginx Proxy

```yaml
# docker-compose.prod.yml
services:
  ethereum-trainer:
    build: .
    environment:
      - MODE=instructor
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - ethereum-trainer
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                         │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │  Hardhat Node    │    │     Frontend (serve)          │  │
│  │  (Blockchain)    │    │     React Web App             │  │
│  │                  │    │                                │  │
│  │  Port: 8545      │    │     Port: 5173                │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Smart Contracts                          │  │
│  │  - PoSSimulator (main training contract)             │  │
│  │  - Student-deployed contracts                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Ensure Docker has adequate resources allocated
