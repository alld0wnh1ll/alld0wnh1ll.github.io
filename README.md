# Ethereum Immersive Trainer - Interactive Blockchain Learning Environment

A comprehensive educational platform that teaches Ethereum, smart contracts, and Proof-of-Stake consensus through hands-on experimentation in a safe, classroom environment.

## 📋 Table of Contents

- [Tools & Tech Stack](#-tools--tech-stack)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Deployment Options](#-deployment-options)
- [For Instructors](#-for-instructors)
- [For Students](#-for-students)
- [Running the Lab](#-running-the-lab)
- [Lab Exercises](#-lab-exercises)
- [Troubleshooting](#-troubleshooting)

## 🛠 Tools & Tech Stack

| Tool | Purpose |
|------|---------|
| **Node.js** (v18+) | Runtime for all scripts and tooling |
| **npm** | Package manager; installs dependencies and runs scripts |
| **Hardhat** | Local Ethereum node, contract compilation, deployment |
| **ethers.js** | Blockchain interaction (wallets, contracts, RPC) |
| **Vite + React** | Frontend build tool and UI framework |
| **Docker** | Optional containerized deployment (instructor/student modes) |
| **PowerShell** | Used by `start-lab.ps1` for one-command lab launch (Windows) |
| **ngrok** | Optional tunnel for remote student access |
| **Git** | Clone and version control |

**Key npm scripts** (from root `package.json`):

- `npm run chain` — Start Hardhat blockchain node (port 8545)
- `npm run deploy` — Deploy smart contracts to local node
- `npm run web` — Start Vite dev server (port 5173)
- `npm run lab-api` — Lab API for session, fund requests, wallet tracking (port 3000)
- `npm run reset` — Full classroom reset (clear blockchain + indexer)
- `npm run reset:docker` — Docker: remove volumes and start fresh
- `npm run build` — Compile contracts, copy artifacts, build frontend
- `npm run test` — Run Hardhat tests
- `npm run lab1` … `lab5` — CLI forensics labs

## 🔧 Prerequisites

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **Web Browser** (Chrome, Firefox, Edge)

For Docker deployment: **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd blockchain_web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This installs root dependencies and runs `postinstall` to install frontend dependencies.

3. **Choose your path**
   - **Instructor** (host the blockchain): Use [Docker](#docker-deployment) or [PowerShell](#for-instructors)
   - **Student** (connect to instructor): Use [Docker student mode](#student-mode-frontend-only) or [PowerShell student mode](#for-students)

## 📦 Deployment Options

| Method | Best For | Requirements |
|--------|----------|--------------|
| **Docker** | Classrooms, consistent setup, minimal local install | Docker Desktop |
| **PowerShell** (`start-lab.ps1`) | Windows instructors/students, quick local dev | Node.js, PowerShell |
| **Manual** | Custom workflows, debugging | Node.js, run `chain` → `deploy` → `web` |

---

## 🐳 Docker Deployment

Docker provides the easiest way to deploy the Ethereum Immersive Trainer in a classroom or online environment. No need to install Node.js locally—everything runs inside containers.

### Prerequisites for Docker
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Docker Compose** (included with Docker Desktop)

### Instructor Mode (Runs Blockchain + Frontend)

```bash
# Clone the repository
git clone <repository-url>
cd blockchain_web

# Build and start instructor node
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

The instructor container will:
- ✅ Start a Hardhat blockchain node on port 8545
- ✅ Deploy PoS Simulator and core contracts
- ✅ Serve the frontend on port 5173
- ✅ Display the contract address in the console

**Access Points:**
- Frontend: `http://localhost:5173`
- Blockchain RPC: `http://localhost:8545`
- Contract Address: `http://localhost:5173/contract-address.txt`
- Config JSON: `http://localhost:5173/api/config.json`

### Student Mode (Frontend Only)

Students connect to the instructor's blockchain:

```bash
# Set instructor's RPC URL and start
INSTRUCTOR_RPC_URL=http://<instructor-ip>:8545 docker-compose -f docker-compose.student.yml up --build
```

Or edit `docker-compose.student.yml` and set the `INSTRUCTOR_RPC_URL` environment variable.

### Docker Quick Reference

```bash
# Start instructor node
docker-compose up --build

# Full reset for new class (removes blockchain data)
npm run reset:docker

# Start in background
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Student mode with instructor IP
INSTRUCTOR_RPC_URL=http://192.168.1.100:8545 docker-compose -f docker-compose.student.yml up --build
```

**Instructor mode by IP:** Only the instructor's IP can use `?mode=instructor`. Add your network IP to `INSTRUCTOR_IP` in docker-compose if you access via `http://YOUR-IP:5173?mode=instructor`.

### Manual Deployment (No Docker)

If you prefer to run everything locally without Docker:

```bash
# Terminal 1: Start blockchain
npm run chain

# Terminal 2: Deploy contracts (after chain is ready)
npm run deploy

# Terminal 3: Start Lab API (for session, fund requests)
npm run lab-api

# Terminal 4: Start frontend
npm run web
```

Or use **`.\start-lab.ps1 -Mode instructor`** (Windows) to start everything automatically, including the Lab API.

### Getting the Contract Address

After starting the instructor container, the contract address is available at:
1. **Console output** - Displayed prominently when container starts
2. **Text file** - `http://localhost:5173/contract-address.txt`
3. **JSON config** - `http://localhost:5173/api/config.json`

Share this address with your students!

## 👨‍🏫 For Instructors

> **New instructor?** See the **[Instructor Setup Guide](docs/INSTRUCTOR_SETUP.md)** for a complete walkthrough from clone to running lab. For ready-made lesson plans across two 1-hour blocks (Beginner, Intermediate, Expert), see **[Instructor Lab Scenarios](docs/INSTRUCTOR_LAB_SCENARIOS.md)**.

**Two ways to host the lab:**

1. **Docker** (recommended): `docker-compose up --build` — see [Docker Deployment](#-docker-deployment) above.
2. **PowerShell** (Windows): Use `start-lab.ps1` below.

### Using start-lab.ps1 (Windows)

```bash
# Clone and install (if not done)
git clone <repository-url>
cd blockchain_web
npm install

# Start instructor mode
.\start-lab.ps1 -Mode instructor

# Full reset + start fresh (for new class)
.\start-lab.ps1 -Mode instructor -Reset

# Reset only (then run instructor manually)
.\start-lab.ps1 -Mode reset

# For remote students (via internet)
.\start-lab.ps1 -Mode instructor -UseNgrok
```

This automatically:
- ✅ Starts the blockchain node
- ✅ Starts Lab API (session, fund requests) on port 3000
- ✅ Deploys smart contracts
- ✅ Opens instructor dashboard at `http://localhost:5173/?mode=instructor`
- ✅ Displays contract address and connection info

**Instructor mode restriction:** Only the instructor's IP can access `?mode=instructor`. Students visiting that URL from their own machines are redirected. Set `INSTRUCTOR_IP` in docker-compose or start-lab sets it automatically for local use.

### Share Connection Information
- **Contract Address**: Shown in terminal output (starts with 0x...)
- **RPC URL**: `http://YOUR_IP:8545` (for local) or ngrok URL (for remote)
- **Dashboard URL**: `http://YOUR_IP:5173` (for local) or ngrok URL (for remote)

## 👨‍🎓 For Students

**Three ways to connect:**

### Option A: Run Frontend Locally (PowerShell on Windows)

```bash
git clone <repository-url>
cd blockchain_web
npm install
.\start-lab.ps1 -Mode student
```

When prompted:
1. Enter the **Contract Address** from your instructor
2. Enter the **RPC URL** from your instructor (e.g. `http://INSTRUCTOR_IP:8545` or ngrok URL)

### Option B: Run Frontend via Docker

```bash
INSTRUCTOR_RPC_URL=http://<instructor-ip>:8545 docker-compose -f docker-compose.student.yml up --build
```

Then open `http://localhost:5173` and enter the contract address when prompted.

### Option C: Use Instructor's Hosted Frontend

1. Open the URL provided by your instructor (e.g. `http://INSTRUCTOR_IP:5173`)
2. Enter the Contract Address and RPC URL in the connection fields
3. Ask your instructor for test ETH to get started (only the instructor can issue funds)

## 🏫 Running the Lab

### Instructor Dashboard Features
- **Real-time Activity Monitoring**: See all student actions
- **Network Statistics**: Track total staked ETH and active validators
- **Student Management**: Fund students, slash penalties, advance epochs
- **Live Network Control**: Simulate block production and attestation

### Student Experience
1. **Create Wallet**: New students (by IP) must create a wallet first — no auto-assigned address. Click **Create or import wallet** in the Live tab.
2. **Request Funds**: Click **Request funds** to notify the instructor. The instructor sees pending requests in the dashboard and can fund with one click.
3. **Stake ETH**: Lock funds to become a validator
4. **Earn Rewards**: Participate in consensus and earn staking rewards
5. **Use CLI Labs**: Run forensics analysis and build smart contracts

### Network Architecture
```
Instructor Machine          Student Machines
┌─────────────────┐        ┌──────────────┐
│ Blockchain Node │◄──────►│ Frontend #1  │
│ (port 8545)     │        │              │
│ Smart Contracts │◄──────►│ Frontend #2  │
│ Instructor      │        │              │
│ Dashboard       │◄──────►│ Frontend #3  │
└─────────────────┘        └──────────────┘
```

Everyone runs the frontend locally but connects to the instructor's blockchain!

## 🧪 Lab Exercises

### Web Interface (Live Tab)

All hands-on labs (Beacon Chain Lab, Contract Builder Lab, Tokenization Lab) are under the **Live** tab. The **Learn** tab contains lesson slides and concepts only.

1. **Getting Started**
   - Ask your instructor for test ETH (only the instructor can issue funds)
   - Generate or import your personal wallet
   - Understand gas and transaction fees

2. **Proof-of-Stake Fundamentals**
   - Open **Beacon Chain Lab** from the Live tab sidebar
   - Stake ETH to become a validator
   - Monitor real-time reward accumulation
   - Participate in network consensus

### CLI Labs (Analyst Training)

The CLI labs provide hands-on blockchain forensics training. Navigate to `scripts/cli-labs/standalone/` and run `npm start`.

**5 Core Forensics Topics:**

1. **Address Analysis**
   - Determine if address is EOA or smart contract
   - Check balances and transaction counts
   - Review staking status and rewards

2. **Transaction Tracing**
   - Look up transactions by hash
   - Analyze execution receipts and gas usage
   - Decode input data

3. **Block Analysis**
   - Scan blocks for transactions
   - Build transaction timelines
   - Calculate totals across block ranges

4. **Event Queries**
   - Track staking events
   - Monitor chat messages
   - Detect slashing incidents

5. **Money Flow Analysis**
   - Track transfers between addresses
   - Calculate total value moved
   - Identify transaction patterns

### Write and Deploy Your First Contract

New to Solidity? Follow the step-by-step guide to **write a simple smart contract** and **deploy it** to the local blockchain:

📖 **[Smart Contract Guide](docs/SMART_CONTRACT_GUIDE.md)** — Write SimpleStorage in Solidity, compile, deploy, and interact.

### Smart Contract Builder Lab

Build and deploy your own smart contracts from templates:
- **House/Property Sale** - Real estate escrow with roles
- **Vehicle Title Transfer** - Ownership registry
- **Event Tickets** - Ticket sales with check-in
- **Voting System** - Multi-option voting
- **Crowdfunding** - Fundraising campaigns
- **Classroom Voting Demo** - Live class exercises

See `scripts/cli-labs/standalone/CONTRACT_BUILDER_GUIDE.md` for full instructions.

## 🌐 Remote Access (Optional)

For online classes where students aren't on the same network:

### Using ngrok for Remote Access
1. **Install ngrok**: Download from [ngrok.com](https://ngrok.com)
2. **Start your blockchain**: `npm run chain`
3. **Expose the RPC endpoint**: `ngrok http 8545`
4. **Share the HTTPS URL** with students

Students then use this URL as their RPC endpoint instead of a local IP address.

## 🐛 Troubleshooting

### Common Issues

**"Connection Refused" or "Network Error"**
- Verify the instructor's computer and students are on the same network
- Check that firewall allows connections on ports 8545 and 5173
- For remote access, ensure ngrok is pointing to port 8545 and students use the HTTPS URL
- Clear browser localStorage if using a restarted blockchain node

**Frontend Won't Load**
- Ensure all dependencies are installed: `npm install`
- Try clearing browser cache or using incognito mode
- Check that port 5173 isn't already in use

**Contract Deployment Issues**
- Verify the contract address is correct (42 characters, starts with 0x)
- Check that the blockchain node is running
- Try redeploying contracts: `npm run deploy`

### Getting Help
- Check the terminal output for error messages
- Verify all prerequisites are installed
- Try restarting the lab environment
