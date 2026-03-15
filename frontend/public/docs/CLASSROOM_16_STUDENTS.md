# Classroom Setup for 16+ Students

This guide covers running the lab with 16 or more students, each using their own Lab Terminal to run node/npm, check balances, and interact with the blockchain.

## How It Works

- **One instructor node** runs the blockchain, frontend, and terminal server
- **Each student** opens the Lab Terminal in their browser (separate window)
- **Each terminal** gets its own PTY (shell) in the lab environment
- **All terminals** share the same project directory and connect to the same Hardhat node
- **Each student** uses their own account address for balance checks and transactions

## Before Class: Instructor Prep

### 1. Start the lab

```bash
# Docker (recommended)
docker-compose up --build

# Or local: start-lab.ps1 -Mode instructor
```

### 2. Pre-generate student accounts (recommended)

Avoid students racing to create accounts at the same time:

```bash
# Local: Create 16 accounts (default)
npm run prepare-classroom

# Or specify count
node scripts/prepare-classroom.js 24

# Docker: Run inside container
docker-compose exec ethereum-trainer node scripts/prepare-classroom.js 16
```

This creates `student-accounts.json` with Student1, Student2, … Student16. When prompted, fund them with test ETH. Use `--fund` or `PREPARE_CLASSROOM_FUND=1` to skip the prompt.

### 3. Share with students

- **Lab URL:** `http://<your-ip>:5173`
- **Firewall:** Allow ports 5173, 8545, 3002 (and 3003, 3004 for terminal fallback)

## During Class: Student Flow

1. Open `http://<instructor-ip>:5173` in a browser
2. Click **Lab Terminal** (opens a new window with a PTY)
3. In the terminal:
   ```bash
   cd scripts/cli-labs/standalone
   node interactive.js
   ```
4. Choose **5. Select account** → pick their number (Student1, Student2, …)
5. Choose **3. Account balances** to see their ETH balance
6. Use **9. Contract Builder** or **help** for more commands

## Terminal Server Capacity

- **16+ concurrent terminals** are supported
- Each WebSocket connection spawns its own PTY
- Ports 3002, 3003, 3004 are used for fallback if one is busy
- If many students connect at once, the frontend retries automatically

## Account Options

| Method | Use case |
|--------|----------|
| **Pre-generated (prepare-classroom)** | Best for 16+ students; instructor assigns Student1, Student2, etc. |
| **Generate in terminal** | Students create their own; file locking prevents races |
| **Hardhat accounts** | Use accounts 1–16 (Account 0 = instructor); no student-accounts.json needed |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Cannot connect to terminal server" | Ensure `npm run terminal` is running (Docker starts it automatically) |
| Student can't see balance | Instructor funds accounts via interactive.js → 10 → Fund |
| Port 3002 blocked | Frontend tries 3003, 3004 automatically |
| Account creation conflict | Use `npm run prepare-classroom` before class, or file locking handles concurrent creation |
