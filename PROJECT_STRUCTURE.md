# Project Root Directory Reference (Recursive)

This document describes every file and folder in the **Ethereum Immersive Trainer** project, recursively. It is an interactive blockchain learning environment for teaching Ethereum, smart contracts, and Proof-of-Stake consensus.

---

## Entry Points & Data Flow

Use this section to build a mental map of how the system starts and how data moves between components.

### Entry Points (where things begin)

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  ENTRY POINTS — What you run to start the system                         │
  └─────────────────────────────────────────────────────────────────────────┘

  🚀 docker-compose up
       │
       └──► Dockerfile
                │
                └──► docker-entrypoint.sh  ──► [instructor] or [student] mode

  🚀 start-lab.ps1 -Mode instructor
       │
       ├──► npm run chain     ──► Hardhat node (port 8545)
       ├──► npm run deploy    ──► scripts/deploy.js
       └──► npm run web       ──► frontend (port 5173)

  🚀 start-lab.ps1 -Mode student
       │
       └──► npm run web       ──► frontend (connects to instructor RPC)

  🚀 npm run web  (or: cd frontend && npm run dev)
       │
       └──► frontend/src/main.jsx  ──► App.jsx  ──► views (Intro, Learn, Explore, etc.)

  🚀 npm start  (from scripts/cli-labs/standalone/)
       │
       └──► interactive.js  ──► CLI menu (forensics, contract builder, etc.)
```

### Data Flow (how information moves)

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  DATA FLOW — Follow the arrows to trace where data comes from and goes   │
  └─────────────────────────────────────────────────────────────────────────┘

  COMPILE PIPELINE
  ════════════════
  contracts/*.sol  ──[Hardhat compile]──►  artifacts/contracts/
       │                                              │
       │                                              ├──► PoS.json ──► frontend/src/
       │                                              │
       │                                              └──► copy-token-artifacts.js
       │                                                        │
       │                                                        └──► SimpleFT.json, SimpleNFT.json
       │                                                                      └──► frontend/src/contracts/

  DEPLOY PIPELINE (Instructor)
  ═══════════════════════════
  scripts/deploy.js
       │
       ├──► CONTRACT_ADDRESS.txt
       ├──► deployment.json
       └──► (Docker) frontend/dist/api/config.json
                    frontend/dist/contract-address.txt

  CONNECTION PIPELINE (Student)
  ════════════════════════════
  student-config.json  ◄──  start-lab.ps1 -Mode student (saves user input)
       │
       └──► VITE_CONTRACT_ADDRESS, VITE_RPC_URL  ──►  frontend (env at build)
            OR
       └──► student-setup.html (localStorage)  ──►  frontend reads pos_addr, custom_rpc

  RUNTIME FLOW
  ════════════
  Browser  ◄──►  frontend (React)  ◄──►  RPC (port 8545)  ◄──►  Hardhat node
       │                │                      │
       │                │                      └──► PoSSimulator contract (on chain)
       │                │
       │                └──► reads: CONTRACT_ADDRESS, config.json, or localStorage
       │
       └──► (Instructor) dashboard.html, InstructorView.jsx
```

### Symbol Legend

| Symbol | Meaning |
|--------|---------|
| `──►` | produces / writes to / leads to |
| `◄──►` | bidirectional (reads and writes) |
| `│` `├` `└` | hierarchy / branches |
| `[ ]` | mode or state |
| `🚀` | user-invoked entry point |

---

## Root Directory

### `.devcontainer/`
Configuration for **VS Code Dev Containers** and GitHub Codespaces. Defines a containerized development environment with Node 20, port forwarding (8545, 5173), and recommended extensions.

| Path | Type | Description |
|------|------|-------------|
| `devcontainer.json` | File | Dev container config: Node 20 image, postCreateCommand (`npm install`), forwarded ports, Hardhat + ESLint extensions |

---

### `.github/`
**GitHub-specific configuration** — workflows, templates, and CI/CD.

| Path | Type | Description |
|------|------|-------------|
| `workflows/` | Dir | GitHub Actions workflow definitions |
| `workflows/static.yml` | File | Deploys frontend to GitHub Pages on push to `main`; builds with Vite, uploads `frontend/dist` |

---

### `artifacts/`
**Hardhat compilation output**. Contains compiled contract ABIs, bytecode, and build metadata. Used by frontend and deployment scripts.

| Path | Type | Description |
|------|------|-------------|
| `build-info/` | Dir | Incremental compilation metadata (JSON files with hashes) |
| `build-info/*.json` | File | Build info for each compilation run; enables incremental builds |
| `contracts/` | Dir | Per-contract compiled artifacts |
| `contracts/Lock.sol/` | Dir | Lock contract artifacts |
| `contracts/Lock.sol/Lock.json` | File | ABI, bytecode, deployedBytecode for Lock |
| `contracts/Lock.sol/Lock.dbg.json` | File | Debug symbols for Lock |
| `contracts/PoS.sol/` | Dir | PoS Simulator contract artifacts |
| `contracts/PoS.sol/PoSSimulator.json` | File | ABI and bytecode for PoSSimulator |
| `contracts/SimpleFT.sol/` | Dir | SimpleFT (fungible token) artifacts |
| `contracts/SimpleNFT.sol/` | Dir | SimpleNFT (non-fungible token) artifacts |
| `contracts/SimpleStorage.sol/` | Dir | SimpleStorage contract artifacts |
| `contracts/student/` | Dir | Student-generated contract artifacts |
| `contracts/student/ClassroomVote_*.sol/` | Dir | ClassroomVote lab contract artifacts |
| `contracts/student/HouseSale_*.sol/` | Dir | HouseSale lab contract artifacts |

---

### `cache/`
**Hardhat build cache**. Speeds up recompilation; safe to delete.

| Path | Type | Description |
|------|------|-------------|
| `console-history.txt` | File | Hardhat console command history |
| `solidity-files-cache.json` | File | Tracks source files for incremental compilation |

---

### `contracts/`
**Solidity smart contracts** — source code for all on-chain logic.

| Path | Type | Description |
|------|------|-------------|
| `Lock.sol` | File | Time-locked ETH contract (Hardhat default; used by `test/Lock.js`) |
| `PoS.sol` | File | Proof-of-Stake simulator — main training contract (staking, rewards, slashing) |
| `SimpleFT.sol` | File | Simple fungible token (ERC-20–like) for Token Concepts lab |
| `SimpleNFT.sol` | File | Simple non-fungible token for Token Concepts lab |
| `SimpleStorage.sol` | File | Basic storage contract for Smart Contract Guide lab |
| `student/` | Dir | Student-generated contracts from lab exercises |
| `student/.gitkeep` | File | Keeps empty `student/` folder in Git |
| `student/ClassroomVote_*.sol` | File | Classroom voting demo contracts (unique IDs) |
| `student/deployments.json` | File | Records deployed student contracts (name, address, deployer, template) |
| `student/HouseSale_*.sol` | File | House/property sale escrow contracts (unique IDs) |

---

### `docs/`
**Project documentation** and lab guides.

| Path | Type | Description |
|------|------|-------------|
| `ARCHITECTURE.md` | File | System architecture and design notes |
| `CLASSROOM_VOTE_LAB.md` | File | Classroom voting demo lab walkthrough |
| `CROWDFUNDING_LAB.md` | File | Crowdfunding campaign lab |
| `EVENT_TICKETS_LAB.md` | File | Event ticket sales lab |
| `HOUSE_SALE_LAB.md` | File | House/property sale escrow lab |
| `INSTRUCTOR_FACILITATION_GUIDE.md` | File | Guide for instructors facilitating labs |
| `INSTRUCTOR_SETUP.md` | File | Instructor setup from clone to running lab |
| `MANUAL.md` | File | General manual and reference |
| `QUICK_REFERENCE.md` | File | Quick reference for common tasks |
| `RANSOMWARE_ADVANCED_LAB.md` | File | Advanced ransomware forensics lab |
| `RANSOMWARE_INVESTIGATION_LAB.md` | File | Ransomware investigation forensics lab |
| `RPC_CONNECTION_TECHNICAL.md` | File | Technical details on RPC connection |
| `SMART_CONTRACT_GUIDE.md` | File | Write, compile, deploy SimpleStorage |
| `TOKEN_CONCEPTS_LAB.md` | File | Fungible vs. non-fungible token concepts |
| `VEHICLE_TITLE_LAB.md` | File | Vehicle title transfer lab |
| `VOTING_SYSTEM_LAB.md` | File | Multi-option voting system lab |

---

### `frontend/`
**React + Vite web application** — UI for wallet, staking, labs, and instructor dashboard.

| Path | Type | Description |
|------|------|-------------|
| `index.html` | File | HTML entry point for Vite |
| `package.json` | File | Frontend dependencies (React, ethers, Vite) and scripts |
| `package-lock.json` | File | Locked dependency versions |
| `tsconfig.json` | File | TypeScript config for frontend |
| `vite.config.js` | File | Vite build config (plugins, base path) |
| `scripts/` | Dir | Build scripts (run via npm lifecycle) |
| `scripts/copy-docs.cjs` | File | Copies `docs/` to `public/docs/` for GUI; runs on `prebuild` |
| `public/` | Dir | Static assets served as-is |
| `public/dashboard.html` | File | Standalone classroom vote dashboard |
| `public/pos-diagram.svg` | File | Proof-of-Stake diagram illustration |
| `public/student-setup.html` | File | Generated by `start-lab.ps1`; sets localStorage and redirects to app |
| `src/` | Dir | React source code |
| `src/App.jsx` | File | Root React component and routing |
| `src/main.jsx` | File | React entry point, mounts App |
| `src/index.css` | File | Global styles |
| `src/PoS.json` | File | PoSSimulator ABI (copied from artifacts) |
| `src/web3.js` | File | Web3/ethers setup and provider config |
| `src/components/` | Dir | Reusable UI components |
| `src/components/AccountManager.jsx` | File | Wallet creation, import, faucet request |
| `src/components/mini-labs/` | Dir | Small interactive lab components |
| `src/components/mini-labs/AddressDecoder.jsx` | File | Decode address types (EOA vs contract) |
| `src/components/mini-labs/AttackCost.jsx` | File | Attack cost calculator |
| `src/components/mini-labs/BlockchainVisualizer.jsx` | File | Blockchain visualization |
| `src/components/mini-labs/FungibleTokenVisualizer.jsx` | File | FT mint/transfer UI for Token Concepts |
| `src/components/mini-labs/NonFungibleTokenVisualizer.jsx` | File | NFT mint/transfer UI for Token Concepts |
| `src/components/mini-labs/index.js` | File | Exports mini-labs components |
| `src/components/mini-labs/SlashingPenalty.jsx` | File | Slashing penalty calculator |
| `src/components/mini-labs/StakingRewards.jsx` | File | Staking rewards calculator |
| `src/components/mini-labs/ValidatorProbability.jsx` | File | Validator selection probability |
| `src/constants/` | Dir | App constants |
| `src/constants/content.js` | File | Static content strings |
| `src/constants/labs.js` | File | Lab definitions and metadata |
| `src/contracts/` | Dir | Contract ABIs for frontend (copied by scripts) |
| `src/contracts/SimpleFT.json` | File | SimpleFT ABI |
| `src/contracts/SimpleNFT.json` | File | SimpleNFT ABI |
| `src/hooks/` | Dir | React hooks |
| `src/hooks/usePosContract.js` | File | Hook for PoS contract interaction |
| `src/hooks/useRpc.js` | File | Hook for RPC connection state |
| `src/hooks/useWallet.js` | File | Hook for wallet state |
| `src/lib/` | Dir | Frontend utilities |
| `src/lib/BlockchainSync.js` | File | Sync blockchain state to UI |
| `src/lib/EventIndexer.js` | File | Index and query contract events |
| `src/lib/PosClient.js` | File | PoS contract client wrapper |
| `src/lib/RpcClient.js` | File | RPC client and connection handling |
| `src/views/` | Dir | Page-level view components |
| `src/views/ConceptsView.jsx` | File | Concepts/learning overview |
| `src/views/DiagnosticsView.jsx` | File | Connection diagnostics |
| `src/views/ExploreView.jsx` | File | Blockchain exploration view |
| `src/views/index.js` | File | Exports views |
| `src/views/InstructorView.jsx` | File | Instructor dashboard (monitoring, funding, slashing) |
| `src/views/IntroView.jsx` | File | Introduction/welcome view |
| `src/views/LearnView.jsx` | File | Learning content view |
| `src/views/TokenConceptsView.jsx` | File | Token Concepts lab (FT/NFT UI) |
| `dist/` | Dir | *(Generated)* Production build output; served by Docker or `serve` |

---

### `lib/`
**Shared JavaScript utilities** for root-level scripts.

| Path | Type | Description |
|------|------|-------------|
| `BlockchainEnv.js` | File | Shared class for CLI scripts: getSigners, getBalance, sendETH, etc. |

---

### `node_modules/`
**Root npm dependencies** (Hardhat, ethers, etc.). Created by `npm install`. Excluded from version control and Docker builds.

---

### `scripts/`
**Deployment and automation scripts**

| Path | Type | Description |
|------|------|-------------|
| `deploy.js` | File | Deploys Lock and PoS Simulator; funds reward pool; writes CONTRACT_ADDRESS.txt |
| `deploy-simple-storage.js` | File | Deploys SimpleStorage; writes SIMPLE_STORAGE_ADDRESS.txt |
| `interact-simple-storage.js` | File | Interact with deployed SimpleStorage |
| `copy-token-artifacts.js` | File | Copies SimpleFT.json and SimpleNFT.json to frontend/src/contracts/ |
| `verify-connection.js` | File | Verifies RPC connection |
| `cli-labs/` | Dir | CLI lab scripts (run via Hardhat or standalone); see `cli-labs/README.md` |
| `cli-labs/README.md` | File | Explains Hardhat labs (lab1–5) vs. standalone labs (1–8) |
| `cli-labs/1-explore-blockchain.js` | File | Lab 1: Explore blockchain (addresses, blocks) |
| `cli-labs/2-sign-transaction.js` | File | Lab 2: Sign transactions |
| `cli-labs/3-deploy-contract.js` | File | Lab 3: Deploy contract |
| `cli-labs/4-query-data.js` | File | Lab 4: Query blockchain data |
| `cli-labs/5-validator-simulation.js` | File | Lab 5: Validator simulation |
| `cli-labs/standalone/` | Dir | Standalone CLI labs (own package.json, run with `npm start`) |
| `cli-labs/standalone/1-explore-blockchain.js` | File | Standalone explore blockchain |
| `cli-labs/standalone/2-sign-transaction.js` | File | Standalone sign transaction |
| `cli-labs/standalone/3-interact-contract.js` | File | Interact with deployed contract |
| `cli-labs/standalone/4-forensics.js` | File | Forensics lab (address analysis, tx tracing) |
| `cli-labs/standalone/5-contract-builder.js` | File | Contract builder (House Sale, Voting, etc.) |
| `cli-labs/standalone/6-ransomware-investigation.js` | File | Ransomware investigation forensics |
| `cli-labs/standalone/7-ransomware-advanced.js` | File | Advanced ransomware forensics |
| `cli-labs/standalone/8-token-concepts.js` | File | Token concepts CLI lab |
| `cli-labs/standalone/account-manager.js` | File | Create/fund student accounts; uses student-accounts.json |
| `cli-labs/standalone/forensics-setup.js` | File | Generate basic forensics scenario |
| `cli-labs/standalone/forensics-setup-advanced.js` | File | Generate advanced forensics scenario |
| `cli-labs/standalone/interactive.js` | File | Interactive CLI menu; entry point for `npm start` |
| `cli-labs/standalone/.env.example` | File | Example env vars for standalone labs |
| `cli-labs/standalone/.forensics-scenario.json` | File | *(Generated)* Basic forensics scenario data |
| `cli-labs/standalone/.forensics-scenario-advanced.json` | File | *(Generated)* Advanced forensics scenario data |
| `cli-labs/standalone/forensics-case.json` | File | Forensics case template |
| `cli-labs/standalone/forensics-case-advanced.json` | File | Advanced forensics case template |
| `cli-labs/standalone/CONTRACT_BUILDER_GUIDE.md` | File | Guide for contract builder lab |
| `cli-labs/standalone/PLAYGROUND_TUTORIAL.md` | File | Playground tutorial |
| `cli-labs/standalone/README.md` | File | Standalone CLI labs readme |
| `cli-labs/standalone/package.json` | File | Standalone package (ethers, dotenv); scripts for labs |
| `cli-labs/standalone/package-lock.json` | File | Locked versions for standalone |
| `cli-labs/standalone/node_modules/` | Dir | Standalone dependencies (ethers, dotenv) |

---

### `test/`
**Test files**.

| Path | Type | Description |
|------|------|-------------|
| `Lock.js` | File | Tests for Lock contract |

---

### `.git/`
**Git repository data** — commit history, branches, remotes. Managed by Git.

---

## Root-Level Files

| File | Description |
|------|-------------|
| `.dockerignore` | Excludes node_modules, frontend/dist, .git, cache, artifacts, student-accounts.json, etc. from Docker builds |
| `.gitpod.Dockerfile` | Gitpod Docker image: extends `gitpod/workspace-node`, installs npm |
| `.gitpod.yml` | Gitpod config: ports 8545, 5173; init task `npm install`; recommended extensions |
| `CONTRACT_ADDRESS.txt` | Deployed PoS Simulator address (e.g. `0xe7f1725E...`); written by deploy script |
| `deployment.json` | Deployment metadata: posAddress, timestamp, network |
| `docker-compose.student.yml` | Student-mode Docker Compose: frontend only, connects to instructor RPC |
| `docker-compose.yml` | Instructor-mode Docker Compose: full stack, ports 8545 and 5173 |
| `docker-entrypoint.sh` | Container entrypoint: starts node or frontend, deploys contracts, writes config |
| `DOCKER.md` | Docker deployment guide |
| `Dockerfile` | Multi-stage Docker image: frontend build, CLI labs, production image |
| `hardhat.config.js` | Hardhat config: Solidity 0.8.19, Hardhat Toolbox |
| `instructor-config.json` | Instructor runtime config (role, contract, RPC, IP); written by start-lab.ps1 |
| `nginx.conf` | Nginx reverse proxy for production (frontend + RPC) |
| `package.json` | Root package: scripts (chain, deploy, web, build, lab1–lab5), dependencies |
| `package-lock.json` | Locked root dependency versions |
| `README.md` | Main project documentation |
| `SIMPLE_STORAGE_ADDRESS.txt` | Deployed SimpleStorage address |
| `start-lab.ps1` | Windows lab launcher: instructor or student mode |
| `student-accounts.json` | Student account records (name, address, funded); used by CLI labs |
| `student-config.json` | Student connection config (contract, RPC); persisted by start-lab.ps1 |
