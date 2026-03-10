# Instructor Facilitation Guide

This guide helps instructors incorporate the Ethereum Immersive Trainer into their classroom. It covers curriculum overview, lab sequencing, facilitation tips, and common student issues.

---

## Table of Contents

1. [Curriculum Overview](#1-curriculum-overview)
2. [Learning Objectives](#2-learning-objectives)
3. [Lab Sequencing](#3-lab-sequencing)
4. [Facilitation Tips](#4-facilitation-tips)
5. [Common Student Issues](#5-common-student-issues)
6. [Discussion Questions](#6-discussion-questions)
7. [Assessment Ideas](#7-assessment-ideas)

---

## 1. Curriculum Overview

### What This Platform Teaches

The Ethereum Immersive Trainer provides hands-on experience with:

- **Ethereum Fundamentals**: Wallets, addresses, transactions, gas fees
- **Proof-of-Stake Consensus**: Staking, validators, rewards, slashing
- **Smart Contracts**: Deployment, interaction, state management
- **Blockchain Forensics**: Address analysis, transaction tracing, money flow

### Target Audience

- Students new to blockchain technology
- No prior cryptocurrency or programming experience required
- Basic computer literacy assumed (web browser, terminal commands)

### Skill Level

**Introductory to Intermediate** — This platform teaches foundational concepts. Students will gain practical understanding but will not become blockchain experts. The goal is to demystify blockchain technology and provide a foundation for further learning.

### Estimated Time

| Component | Duration |
|-----------|----------|
| Web Interface (Live tab) | 30-45 minutes |
| CLI Labs (all 5) | 2-3 hours |
| Smart Contract Labs | 45-60 minutes each |
| Forensics Labs | 60-90 minutes each |
| **Total Course Time** | **4-8 hours** |

Time can be adjusted by selecting specific labs based on your curriculum needs.

---

## 2. Learning Objectives

By the end of this course, students will be able to:

### Core Concepts
- [ ] Explain the difference between a wallet (EOA) and a smart contract
- [ ] Describe how gas fees work and why they exist
- [ ] Understand how Proof-of-Stake secures the Ethereum network
- [ ] Explain why validators stake ETH and how they earn rewards

### Practical Skills
- [ ] Create and manage an Ethereum wallet
- [ ] Send transactions and interpret confirmation data
- [ ] Stake ETH and participate in consensus simulation
- [ ] Read and trace transactions on the blockchain

### Forensics & Analysis
- [ ] Analyze addresses to determine type and activity
- [ ] Trace transaction flows between addresses
- [ ] Query smart contract events
- [ ] Follow money trails through multiple addresses

### Smart Contracts
- [ ] Understand the lifecycle of a smart contract
- [ ] Interact with deployed contracts
- [ ] Recognize role-based access control patterns

---

## 3. Lab Sequencing

### Recommended Order

For a complete course, follow this sequence:

```
Phase 1: Introduction (45-60 min)
├── 1. Web Interface Tour
│   └── Create wallet, get test ETH, send first transaction
│
├── 2. Staking Demo
│   └── Stake ETH, observe rewards, understand validators
│
Phase 2: CLI Fundamentals (1.5-2 hours)
├── 3. Lab 1: Explore Blockchain
│   └── Block numbers, network info, account balances
│
├── 4. Lab 2: Sign Transactions
│   └── Manual signing, gas estimation, nonces
│
├── 5. Lab 3: Contract Interaction
│   └── Call functions, send transactions to contracts
│
Phase 3: Smart Contracts (1-2 hours)
├── 6. Smart Contract Guide
│   └── SimpleStorage: write, compile, deploy, interact
│
├── 7. Contract Builder Lab (pick 1-2)
│   └── House Sale, Voting, Event Tickets, etc.
│
Phase 4: Forensics (1.5-2 hours)
├── 8. Lab 4: Forensics Basics
│   └── Address analysis, transaction tracing
│
└── 9. Ransomware Investigation Lab
    └── Follow money through tumbler addresses
```

### Abbreviated Course (2 hours)

If time is limited:

1. **Web Interface** (20 min) - Wallet, ETH, basic staking
2. **CLI Lab 1** (15 min) - Network exploration
3. **CLI Lab 2** (20 min) - Transaction signing
4. **Forensics Basics** (30 min) - Address and transaction analysis
5. **Discussion** (15 min) - Real-world applications

### Focus Options

| Focus Area | Labs to Include |
|------------|-----------------|
| **Consensus Only** | Web Interface (staking focus), Lab 1, Lab 2 |
| **Smart Contracts Only** | Smart Contract Guide, Contract Builder, Web Interface |
| **Forensics Only** | Lab 1, Lab 4, Ransomware Investigation |
| **Full Curriculum** | All labs in sequence |

---

## 4. Facilitation Tips

### Before Class

1. **Test the setup** - Run `docker compose up --build` and verify everything works
2. **Note your IP address** - Students need this to connect
3. **Prepare the whiteboard** - Write: Contract Address, RPC URL, Frontend URL
4. **Have backup plan** - If network issues occur, students can use the Learn tab locally

### During Class

#### Pacing

- **Don't rush wallet creation** - This is where most confusion happens
- **Wait for everyone** before moving to the next step
- **Use the dashboard** (`/dashboard.html`) to show live activity
- **Take breaks** every 30-45 minutes

#### When to Pause for Discussion

- After first successful transaction ("What just happened?")
- After staking ("Why would anyone lock up their money?")
- When viewing transaction history ("How is this different from a bank?")
- After forensics exercises ("How could this be used in real investigations?")

#### Live Demonstrations

Good moments to share your screen:

- Creating a wallet and explaining private key importance
- Sending ETH and watching it confirm
- Staking and showing the reward calculation
- Tracing a transaction in the CLI Playground

### Common Confusion Points

| Point | What Students Think | What to Clarify |
|-------|---------------------|-----------------|
| **Private Key** | "It's like a password" | It's more like a master key - lose it and funds are gone forever |
| **Gas** | "It's a transaction fee" | It's payment for computational work - more complex = more gas |
| **Contract Address** | "It's my address" | It's the shared application everyone connects to |
| **Test ETH** | "I'm getting real money" | This is simulation ETH with no real-world value |
| **Staking Lock** | "My ETH is gone" | It's locked, not spent - you'll get it back after unstaking |

---

## 5. Common Student Issues

### Connection Problems

| Issue | Solution |
|-------|----------|
| "Not connected" | Check RPC URL format (http://IP:8545), verify firewall allows ports 8545 and 5173 |
| "Contract not found" | Verify contract address matches what instructor deployed |
| "Connection refused" | Instructor's node may have stopped, restart with `docker compose up` |

### Wallet Issues

| Issue | Solution |
|-------|----------|
| "Lost private key" | Cannot recover - demonstrate this is intentional, create new wallet |
| "Balance shows 0" | Click "Get 5 ETH" or check if connected to correct RPC |
| "Import not working" | Private key must include `0x` prefix |

### Transaction Issues

| Issue | Solution |
|-------|----------|
| "Transaction stuck" | Check gas settings, may need to wait for block |
| "Insufficient funds" | Request more ETH from faucet |
| "Nonce too low" | Restart wallet or wait for pending transactions |

### CLI Issues

| Issue | Solution |
|-------|----------|
| "RPC_URL not set" | Set environment variable: `set RPC_URL=http://IP:8545` |
| "Module not found" | Run `npm install` in `scripts/cli-labs/standalone/` |
| "Contract address missing" | Set `CONTRACT_ADDRESS` or use Playground to interact directly |

---

## 6. Discussion Questions

Use these to check understanding and spark conversation:

### Wallets & Keys

1. "Why can't you recover a lost private key? Isn't there an admin somewhere?"
2. "What's the difference between your private key and your address?"
3. "Why do we use hexadecimal (0x...) for addresses?"

### Transactions & Gas

1. "Why do you have to pay gas even for a failed transaction?"
2. "If you set gas too low, what happens?"
3. "How is gas different from a bank's transaction fee?"

### Proof-of-Stake

1. "Why would someone lock up 32 ETH to become a validator?"
2. "What happens if a validator tries to cheat?"
3. "How does staking make the network more secure than mining?"

### Smart Contracts

1. "Why can't you change a smart contract after deployment?"
2. "How is a smart contract different from a regular program?"
3. "What real-world problems could smart contracts solve?"

### Forensics

1. "How is blockchain forensics different from traditional forensics?"
2. "What makes blockchain transactions traceable but still 'pseudo-anonymous'?"
3. "How might criminals try to hide their transactions?"

---

## 7. Assessment Ideas

### Quick Checks (No Grading)

- **Thumbs up/down**: "Who successfully sent a transaction?"
- **Live poll**: Use the Classroom Vote contract to survey understanding
- **Show of hands**: "Who can explain what gas is?"

### Knowledge Verification

#### Mini-Quiz Questions

1. What two things does a wallet consist of?
   - *Answer: Private key and address (public key derived)*

2. What happens to a validator's stake if they misbehave?
   - *Answer: Slashing - they lose some or all of their staked ETH*

3. How can you tell if an address is a smart contract vs a wallet?
   - *Answer: Check `getCode()` - contracts have bytecode, wallets return '0x'*

4. Why does Proof-of-Stake use less energy than Proof-of-Work?
   - *Answer: No computational puzzle to solve - validators are selected based on stake*

5. What is the purpose of gas in Ethereum?
   - *Answer: Prevent infinite loops, pay validators for computational work*

### Capstone Project Ideas

1. **Transaction Tracker**: Build a simple script that monitors an address for new transactions
2. **Mini Investigation**: Trace a series of transactions to find where funds ended up
3. **Contract Deployment**: Deploy and interact with a custom contract modification
4. **Classroom Demo**: Lead a voting session using the ClassroomVote contract

---

## Quick Reference

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for a one-page cheat sheet to use during class.

**Ready-to-use lab plans:** See [INSTRUCTOR_LAB_SCENARIOS.md](INSTRUCTOR_LAB_SCENARIOS.md) for three scenarios (Beginner, Intermediate, Expert) across two 1-hour blocks—with step-by-step tasks to keep students busy.

## Technical Setup

For detailed setup instructions, see:
- [INSTRUCTOR_SETUP.md](INSTRUCTOR_SETUP.md) - Step-by-step setup guide
- [../DOCKER.md](../DOCKER.md) - Docker deployment options
- [../README.md](../README.md) - Full project documentation
