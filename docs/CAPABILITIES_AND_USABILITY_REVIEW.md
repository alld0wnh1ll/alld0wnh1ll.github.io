# Capabilities & Usability Review

A review of the Ethereum Immersive Trainer against the [INSTRUCTOR_LAB_SCENARIOS.md](INSTRUCTOR_LAB_SCENARIOS.md) and project capabilities. Identifies gaps and usability improvements.

---

## 1. Capabilities Inventory

### 1.1 Web Application

| Capability | Location | In Lab Scenarios? |
|------------|----------|-------------------|
| **Intro** | Top nav → Intro / Learning Path | ❌ Not explicitly |
| **Learn** (guided story + sandbox) | Learn tab | ✅ Referenced (mini-labs) |
| **Explore** (missions, PoS simulator) | Explore tab | ✅ Block details, Address Decoder |
| **Live** (wallet, faucet, staking, chat) | Live tab | ✅ Yes |
| **Token Concepts** | Learn → Token Concepts | ✅ Yes |
| **CLI** (embedded lab instructions) | CLI tab | ⚠️ Partial — "Available Labs" not pointed to |
| **Instructor** dashboard | `?mode=instructor` or Instructor tab | ✅ Yes |
| **Diagnostics** | Diagnostics view | ❌ Not mentioned — useful for connection issues |
| **Connection Setup** | Live tab → Connection Setup card | ✅ Yes (Setup & Connection) |

### 1.2 Mini-Labs (Learn Tab)

| Mini-Lab | Purpose | In Scenarios? |
|----------|---------|--------------|
| Staking Rewards | Reward accumulation | ✅ Yes |
| Validator Probability | Selection odds | ✅ Yes |
| Slashing Penalty | Misbehavior penalty | ✅ Yes |
| Attack Cost | 51% attack economics | ✅ Scenario B only |
| Address Decoder | EOA vs contract | ✅ Yes |
| Blockchain Visualizer | Block chain viz | ✅ Yes |
| Fungible Token Visualizer | FT mint/transfer | ✅ Yes |
| Non-Fungible Token Visualizer | NFT mint/transfer | ✅ Yes |

### 1.3 Contract Builder Templates

| Template | Lab Doc | Dashboard Support | In Scenarios? |
|----------|---------|------------------|---------------|
| House Sale | HOUSE_SALE_LAB.md | ✅ houseSale | ✅ B, C |
| Vehicle Title | VEHICLE_TITLE_LAB.md | ✅ vehicleTitle | ❌ **Missing** |
| Event Tickets | EVENT_TICKETS_LAB.md | ✅ eventTickets | ✅ B |
| Voting System | VOTING_SYSTEM_LAB.md | ✅ voting | ✅ B |
| Crowdfunding | CROWDFUNDING_LAB.md | ✅ crowdfunding | ✅ C |
| Classroom Vote | CLASSROOM_VOTE_LAB.md | ✅ classroomVote | ✅ A |

### 1.4 CLI Labs

| Lab | Script | In Scenarios? |
|-----|--------|---------------|
| Explore Blockchain | `1-explore-blockchain.js` | ✅ B |
| Sign Transaction | `2-sign-transaction.js` | ✅ B |
| Interact with Contract | `3-interact-contract.js` | ✅ B |
| Forensics | `4-forensics.js` | ✅ B, C |
| Contract Builder | `5-contract-builder.js` (via interactive menu 9) | ✅ B, C |
| Ransomware Investigation | `6-ransomware-investigation.js` | ✅ C |
| Ransomware Advanced | `7-ransomware-advanced.js` | ✅ C |
| Token Concepts | `8-token-concepts.js` | ✅ A (optional) |
| **Validator Simulation** | `npm run lab5` (Hardhat) | ❌ **Missing** |

### 1.5 Other Capabilities

| Capability | Location | In Scenarios? |
|------------|----------|---------------|
| **Account Manager** (CLI) | `node interactive.js` → option 10 | ❌ Not mentioned |
| **Playground** | `node interactive.js` → option 8 | ✅ B, C |
| **verify-connection.js** | `node scripts/verify-connection.js` | ❌ Not mentioned |
| **Dashboard** (6 contract types) | `dashboard.html` | ⚠️ Partially — not all types listed |
| **Available Labs** (in-app) | CLI tab → Available Labs | ❌ Not pointed to |

---

## 2. Missing from Lab Scenarios

### 2.1 Vehicle Title Lab

- **Exists:** [VEHICLE_TITLE_LAB.md](VEHICLE_TITLE_LAB.md), Contract Builder option 2, dashboard support
- **Gap:** Not included in any scenario. Good for Beginner/Intermediate (asset provenance, ownership chains).
- **Suggestion:** Add as Option 4 in Scenario B Contract Builder, or as a Beginner Block 2 alternative.

### 2.2 Validator Simulation (Hardhat Lab 5)

- **Exists:** `npm run lab5` — validator simulation
- **Gap:** Hardhat labs 1–4 have standalone equivalents; Lab 5 does not. Not in scenarios.
- **Suggestion:** Add to Scenario B or C for students running locally (not Docker) who want validator mechanics.

### 2.3 Diagnostics View

- **Exists:** DiagnosticsView — connection checks, RPC tests
- **Gap:** Not referenced when students have connection issues.
- **Suggestion:** Add to Troubleshooting / "Stuck students" section: *"Use the Diagnostics view to verify RPC and contract connection."*

### 2.4 CLI Account Manager

- **Exists:** Option 10 in interactive menu — create/fund student accounts
- **Gap:** Instructors could use this to pre-create accounts; students could use it if faucet fails.
- **Suggestion:** Mention in Tips or as backup when "Request 5 ETH" doesn't work.

### 2.5 Available Labs (In-App)

- **Exists:** CLI tab → Available Labs — step-by-step from `labs.js`
- **Gap:** Scenarios send students to `docs/` but not to the in-app lab list.
- **Suggestion:** Add: *"Or open the CLI tab → Available Labs for in-app instructions."*

### 2.6 Mac/Linux Start Options

- **Exists:** `start-lab.ps1` is Windows-only
- **Gap:** No equivalent for Mac/Linux. They must use Docker or manual `chain` → `deploy` → `web`.
- **Suggestion:** Document manual sequence for Mac/Linux in README and scenarios, or add `start-lab.sh`.

---

## 3. Usability Issues

### 3.1 Connection Flow Ambiguity

**Issue:** Scenarios say *"If you see a connection screen, enter Contract Address and RPC URL."* Connection Setup is actually in the **Live** tab, not a separate first screen.

**Impact:** Students may not know where to configure connection.

**Fix:** Clarify: *"Go to the Live tab. Scroll to the Connection Setup card. Enter Contract Address and RPC URL from the board."* Align with [MANUAL.md](MANUAL.md) Section 3.

### 3.2 Learning Path vs. Direct Jump

**Issue:** App flow is Intro → Concepts → Explore → Sim → Live. Scenarios often send students straight to Live or Learn.

**Impact:** Students may skip Intro and Concepts. May be intentional for time-constrained labs.

**Fix:** Either (a) state that skipping Intro is fine for lab mode, or (b) add a 2–3 min Intro step for Scenario A.

### 3.3 Token Concepts Prerequisites

**Issue:** Token Concepts Section 4 (hands-on deploy) needs wallet + ETH. Scenarios mention this briefly.

**Impact:** Students may hit "Wallet not connected" or "Need ETH" without context.

**Fix:** Add explicit note: *"For Section 4 hands-on deploy: complete Wallet & Faucet in Block 1 first. Sections 1–3 work without a wallet."*

### 3.4 Ransomware: Hardhat Console vs. Playground

**Issue:** Ransomware lab instructs use of Hardhat console. Playground (option 8) also has `provider` and `contract` and may work.

**Impact:** Students with only `node interactive.js` might try Playground; unclear if it's supported.

**Fix:** Clarify in Ransomware lab: *"Use Hardhat console (`npx hardhat console --network localhost`) for investigation. Playground uses the same provider but runs inside the interactive menu — use a separate terminal for Hardhat for clarity."*

### 3.5 Contract Builder Menu Number Mismatch

**Issue:** `labs.js` says *"Select: 7. Contract Builder Lab"* but `interactive.js` has Contract Builder as **option 9**.

**Impact:** Students following labs.js will select the wrong option.

**Fix:** Update `labs.js` to use option 9 (or the actual menu number) everywhere.

### 3.6 Dashboard Contract Type Selection

**Issue:** Dashboard supports 6 types. Scenarios mention Classroom Vote, Event Tickets, Voting. Others (Crowdfunding, House Sale, Vehicle Title) are not clearly tied to dashboard use.

**Fix:** Add a note: *"Dashboard supports: Classroom Vote, Voting, Event Tickets, Crowdfunding, House Sale, Vehicle Title. Select the matching type when adding a contract."*

### 3.7 .env Setup

**Issue:** Scenarios mention `.env` but not where to copy from.

**Fix:** Add: *"Copy `scripts/cli-labs/standalone/.env.example` to `.env` and edit with your RPC_URL and CONTRACT_ADDRESS."*

### 3.8 First-Time Student Entry Point

**Issue:** New students may land on Intro. Connection Setup is in Live. Order of operations is unclear.

**Fix:** Add a "First-Time Student Checklist" at the top of Scenario A:
1. Open Frontend URL
2. Click **Live** tab
3. Connection Setup → enter Contract Address + RPC URL
4. Create wallet → Request 5 ETH
5. Continue with scenario tasks

---

## 4. Recommendations Summary

| Priority | Action |
|----------|--------|
| **High** | Add Vehicle Title to Scenario B Contract Builder options |
| **High** | Clarify connection flow: Live tab → Connection Setup card |
| **High** | Fix labs.js Contract Builder option (7 → 9) |
| **Medium** | Add Diagnostics view to troubleshooting |
| **Medium** | Add First-Time Student Checklist to Scenario A |
| **Medium** | Document Mac/Linux manual start (or add start-lab.sh) |
| **Medium** | Add Token Concepts Section 4 prerequisite note |
| **Low** | Add Validator Simulation (lab5) for local/dev users |
| **Low** | Point to CLI tab → Available Labs |
| **Low** | Add .env.example path to env setup instructions |
| **Low** | List all 6 dashboard contract types in scenarios |

---

## 5. Quick Fixes for INSTRUCTOR_LAB_SCENARIOS.md

If revising the scenarios document, consider:

1. **Document Reference Map:** Add Vehicle Title, Diagnostics, verify-connection
2. **Scenario A Block 1:** Add "First-Time Student Checklist" and explicit "Live tab → Connection Setup"
3. **Scenario B Contract Builder:** Add Option 4 — Vehicle Title
4. **Tips section:** Add "Use Diagnostics view for connection issues" and "CLI Account Manager (option 10) if faucet fails"
5. **Path Reference:** Add `.env.example` path and Mac/Linux manual start note
