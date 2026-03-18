# Beacon Chain Lab: Committee, Attestation, and Finality

| | |
|---|---|
| **Duration** | 30-45 minutes |
| **Difficulty** | Intermediate |
| **Prerequisites** | Blockchain node running, wallets with test ETH |
| **Roles** | Instructor (starts session), Students (validators) |

An interactive lab demonstrating Ethereum Proof-of-Stake concepts: validator pool, multiple committees per epoch, justification threshold, attestation, finality, and report-based slashing. Students join the validator pool, committees are assigned at epoch start, bots fill empty slots, and the instructor drives block proposals. Slashing requires detection and report (whistleblower reward).

---

## Learning Objectives

By completing this lab, students will:

1. **Understand committee formation** - Validator pool, pseudo-random assignment to multiple committees per epoch
2. **Learn justification threshold** - 2/3 of staked ETH must attest for a block to be justified
3. **Practice attestation** - Validators attest to blocks (only if in committee for that slot); optional human attestation requirement
4. **See finality in action** - Block N finalizes when block N+2 is justified (simplified Casper FFG)
5. **Experience slashing** - Wrong-hash or double vote stores evidence; any validator reports to process slash and earn whistleblower reward
6. **Observe weighted proposer selection** - More stake = higher chance to propose

---

## The Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BEACON CHAIN LAB FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   LOBBY PHASE                                                           │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐                  │
│   │  Students  │────►│   join()   │────►│ Validator   │                  │
│   │  stake ETH │     │  + stake   │     │  Pool       │                  │
│   └────────────┘     └────────────┘     └─────┬──────┘                  │
│                                               │                          │
│   INSTRUCTOR: fillBotsAndStart(bots, requireHuman)                       │
│   ┌───────────────────────────────────────────┘                          │
│   │                                                                     │
│   ▼                                                                     │
│   ACTIVE PHASE                                                          │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐                  │
│   │ Instructor │────►│ proposeBlock│────►│ Block #N   │                  │
│   │  triggers  │     │ (weighted) │     │  proposed  │                  │
│   └────────────┘     └────────────┘     └─────┬──────┘                  │
│                                               │                          │
│   Committees assigned at epoch start; bots auto-attest; students attest  │
│   ┌───────────────────────────────────────────┘                          │
│   │                                                                     │
│   ▼                                                                     │
│   When attestation stake >= 2/3 totalStaked: Block JUSTIFIED            │
│   When block N+2 justified: Block N FINALIZED                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Blockchain node running** - `npm run chain` (or Docker)
2. **Beacon Lab deployed** - `npm run deploy:beacon-lab`
3. **Students have wallets** - Created via Account Manager, funded with test ETH
4. **Web app** - `http://localhost:5173` (or `http://<INSTRUCTOR-IP>:5173` for students)

---

## Setup

### One command (recommended)

**PowerShell (Windows):**
```powershell
.\start-lab.ps1 -Mode beacon-lab
```
Beacon Chain Lab only: chain + deploy + frontend. Opens `http://localhost:5173/?view=beacon-lab`.

**Full instructor suite (PoS + Beacon Lab + Terminal):**
```powershell
.\start-lab.ps1 -Mode instructor
```
Everything in one go. Then open **Beacon Chain Lab** from the **Live** tab sidebar (Hands-On Labs) or `?view=beacon-lab`.

**Node.js (any OS):**
```bash
npm run beacon-lab
```
Chain + deploy + frontend (no PowerShell).

### Manual setup (alternative)

1. **Start the chain:** `npm run chain`
2. **Deploy** (in another terminal): `npm run deploy:beacon-lab`
3. **Start frontend:** `npm run web`
4. **Open the lab:** Go to the **Live** tab, then click **Beacon Chain Lab** in the Hands-On Labs sidebar, or go to `/?view=beacon-lab` or `/game/beacon-lab`

---

## Student Instructions

### Step 1: Connect Wallet

Ensure your wallet is connected and has test ETH (from instructor faucet or Account Manager). You need at least 32 ETH to stake.

### Step 2: Join the Validator Pool

1. In the Beacon Chain Lab view, find the **Join Validator Pool** panel
2. Enter your stake amount (minimum 32 ETH, like mainnet)
3. Click **Join**
4. Wait for the instructor to fill the pool with bots and start the session
5. Expand **How committees form** to learn how validators are assigned to committees at epoch start

### Step 3: Attest to Blocks

Once the session is ACTIVE:

1. After the instructor proposes a block, you will see the **Attest** panel
2. Select which block to attest to (use the dropdown; fork blocks are labeled)
3. Click **Attest** to attest with the correct block hash — this proves you agree on the block content (consensus)
4. Watch the attestation progress bar — when it reaches 2/3 of total stake, the block becomes **justified**
5. When block N+2 is justified, block N becomes **finalized** (green checkmark)

**Demo slashing:** Click **Attest wrong (demo slash)** to intentionally attest with a wrong hash. Your attestation is rejected and evidence is stored. Any validator (including bots) can click **Report slash** to process it and earn a whistleblower reward.

### Step 4: Complete Your Tasks

Students see a **Your Tasks** checklist in the right sidebar (8 tasks). Tasks auto-complete when you perform the action:

| Task | How to complete |
|------|-----------------|
| Join the validator pool | Stake 32+ ETH and join |
| Attest to a block | When in committee, click Attest |
| View a block's details | Click any block in the Latest Blocks table |
| Observe a block become justified | Watch the attestation progress reach 2/3 |
| Observe a block become finalized | Block N finalizes when N+2 is justified |
| Find your committee | Expand "Committees for Epoch" or check "Your committee" |
| View slash evidence on the chain | Click a block/validator with a slash, or Pending Slashes |
| Exit the validator pool | Click "Exit validator pool" |

Progress is saved per deployment. Use **Reset progress** to start over.

### Step 5: Observe

- **Validator pool** — Click a validator to see their details (stake, attestations, proposed blocks, slash events). Exited validators show 🚪 Exited.
- **How committees form** — Expandable section explaining committee assignment. **Committees for Epoch N** shows the full assignment table.
- **Violation on chain** — When viewing a slash (pending or completed), see the chain visualization: canonical block vs forged attestation, or fork diagram for double vote.
- **Pending slashes** — If a violation was detected, report it to process the slash and earn a reward
- **Latest Blocks table** — BeaconScan-style: Epoch, Slot, Pos, Status, Att, Slash. Click a row to drill down
- **Block detail** — Slot number, Block Root Hash (copyable), Parent Root Hash (clickable to navigate), Slashing P/A, attestations table, slashings
- **Validator detail** — Address (copyable), stake, attestation history, proposed block count, slash events
- **Activity log** — Real-time events (BlockProposed, Attested, Justified, Finalized, Slashed, WrongAttestationSlashed, DoubleVoteSlashed)
- **URL bookmarking** — Share `?view=beacon-lab&block=5` or `&validator=0x...` to link to a specific block or validator
- **Your Tasks** — Checklist of 8 tasks; complete all to finish the lab

---

## Instructor Walkthrough

### Step 1: Deploy and Share

1. Run `npm run deploy:beacon-lab` after deploying PoS
2. Share the URL with students: `http://<YOUR-IP>:5173/?view=beacon-lab` or `/game/beacon-lab`

### Step 2: Wait for Students to Join

- Students should join with at least 32 ETH each (like mainnet)
- Pool size = committeesPerEpoch × validatorsPerCommittee (default 8×8=64). Set via `COMMITTEES_PER_EPOCH` and `VALIDATORS_PER_COMMITTEE` env at deploy.
- Wait until at least one student has joined

### Step 3: Set Validators per Committee (Optional but Recommended)

- In **Instructor Controls**, set **Validators per committee** (e.g. 3–8) before starting. Smaller = less gas, faster Fill Bots and Start.
- Pool size = committees × validators. E.g. 8 committees × 3 validators = 24 pool size.
- Click **Set** to apply. This reduces gas for the next step.

### Step 4: Fill Bots and Start

1. Optionally check **Require human attestation per block** — blocks will not justify until at least one human has attested (ensures practice)
2. Click **Fill Bots and Start**
3. The contract fills the pool with bot addresses (derived from Hardhat mnemonic)
4. Each bot gets a random stake between 32 and 64 ETH (weighted for proposer selection)
5. Committees are assigned at epoch start (round-robin)
6. Session state changes to **ACTIVE**

**Dynamic join/leave:** Students can join or rejoin anytime during ACTIVE. New validators are assigned to committees at the next epoch start (like real Ethereum). Exited validators can rejoin with **Rejoin**.

### Step 5: Block Production (Automatic)

1. Blocks are proposed **automatically** every ~12 seconds (Ethereum mainnet simulation)
2. Proposer is selected stake-weighted (more ETH = higher chance)
3. Bots auto-attest immediately; students attest manually
4. Keep the instructor tab open for auto-proposal to run

**How to advance to the next epoch:** Epochs advance automatically. Each block advances the slot (1→2→3→4). When slot reaches `blocksPerEpoch` (default 4), the next block resets slot to 1 and increments the epoch. So every 4 blocks = 1 epoch (~48 seconds). Committees are reshuffled at the start of each epoch (when slot = 1). No manual action needed—just let blocks propose.

### Step 6: Demonstrate Finality

1. Propose block 1 — wait for students to attest until justified
2. Propose block 2 — wait for justification
3. Propose block 3 — when block 3 is justified, block 1 becomes **finalized**
4. Point out the "finalized" status in the Blocks table and the Finalized Epoch/Slot in the header
5. Click block 1 to open the block detail; show the Parent Root Hash (clickable to navigate the chain)

### Step 7: Demonstrate Slashing

**Wrong-hash slashing (report-based):**
1. Have a student click **Attest wrong (demo slash)** — they attest with an incorrect block hash
2. The attestation is rejected; evidence is stored. **Pending Slashes** panel appears
3. Any validator (or instructor) clicks **Report slash** to process it — they earn a whistleblower reward (10% of penalty)
4. The validator is slashed (5% penalty) and marked slashed
5. This demonstrates: attestations must match the canonical block; violations are detectable; reporters are incentivized

**Double-vote slashing (report-based):**
1. Wait for at least one block to be proposed (e.g., block 5)
2. Click **Propose fork block** — creates block 6 at the same slot as block 5
3. Have a student attest to block 5 (correct hash)
4. Have the same student attest to block 6 (correct hash) — they have now attested to two different blocks at the same slot
5. Evidence is stored; **Pending Slashes** panel appears
6. Anyone can report to process the slash and earn the reward
7. This demonstrates: validators cannot vote for conflicting blocks; double voting breaks consensus

**Manual slashing (instructor):**
1. Select a validator from the dropdown (choose a bot for demo)
2. Enter a reason (e.g., "Offline", "Surround vote")
3. Click **Slash**
4. The validator loses 5% of stake and is marked slashed
5. Slashed validators cannot propose or attest

### Step 8: Optional Features

**Validator exit:** Students can voluntarily exit and withdraw their stake. Click **Exit validator pool** in the Attest panel. Stake is refunded immediately. Exited validators are removed from committee eligibility for future epochs.

**Inactivity penalty:** Check **Inactivity penalty** and click **Apply** to enable. Human validators in the committee who miss attesting to a block lose 0.001 ETH. Demonstrates that participation matters (like real Ethereum's inactivity leaks).

**Bot misbehavior:** Bots occasionally try wrong-hash or double-vote (configurable %). Use to demonstrate slashing without student participation. Adjust **Wrong hash %** and **Double vote (on fork) %**, then **Apply**.

### Step 9: End Session

When finished, click **End Session** to freeze the lab.

---

## Slashing Scenarios

| Scenario | Trigger | Result |
|----------|---------|--------|
| **Wrong block hash** | Attest with a hash that does not match the canonical block | Evidence stored; anyone reports to process slash (5%) and earn whistleblower reward (10%) |
| **Double vote** | Attest to two different blocks at the same slot (e.g., block 5 and fork block 6) | Evidence stored; anyone reports to process slash (5%) and earn reward |
| **Manual** | Instructor selects validator and reason | Slash (5%); for demos like "offline" or "surround vote" |

**Why must attestations include the block hash?** Consensus means everyone agrees on the same content. When you attest, you are signing that you have seen a specific block. If your claimed hash does not match the canonical block, you are provably lying — and the contract slashes you. This ties attestations to verifiable on-chain state.

---

## Discussion Questions

1. **Why does block 1 finalize only when block 3 is justified?** (Casper FFG: two blocks of confirmation)

2. **What happens if fewer than 2/3 of validators attest?** (Block never justifies; no finality)

3. **Why would a validator with more stake be chosen more often to propose?** (Economic security: more at stake = more incentive to behave)

4. **What could cause slashing in real Ethereum?** (Double signing, surround voting, wrong attestation, etc.)

5. **Why do bots auto-attest?** (In a classroom, bots simulate active validators so the demo runs smoothly with few students)

6. **Why must attestations include the block hash?** (Consensus = everyone agrees on the same content; wrong hash is provably detectable and slashed)

---

## Ensuring All Students Meet Learning Objectives

| Objective | Met for all? | Gap | Instructor action |
|-----------|--------------|-----|-------------------|
| 1. Committee formation | Yes | Pool size configurable in LOBBY. Multiple committees per epoch. | All students who join are in the pool; committees form at epoch start. Check **How committees form** and **Committees for Epoch N**. |
| 2. Justification threshold | Yes | — | All students observe the progress bar and blocks justify/finalize. |
| 3. Practice attestation | Yes | Check **Require human attestation per block** when starting. | Blocks will not justify until at least one human has attested. |
| 4. See finality in action | Yes | — | All students observe block N finalizing when N+2 is justified. |
| 5. Experience slashing | Partial | Only 1–2 students can *trigger* slashing (wrong attest or double vote). Others observe. | Rotate who does the demo across sessions, or run the lab twice. Emphasize that observing a slash (block detail, Slashed Validators panel) still meets "experience" for understanding. |
| 6. Weighted proposer selection | Yes | — | All students observe who proposed each block; over several blocks the stake-weighted pattern is visible. |

**Checklist before starting:**
- [ ] Pool size (set validators per committee in LOBBY) ≥ number of students
- [ ] All students have joined before Fill Bots and Start
- [ ] Consider checking **Require human attestation per block** for practice
- [ ] Plan: who will demo wrong-hash slash; who will demo double-vote (if doing both)

---

## Technical Details

| Parameter | Value |
|-----------|-------|
| Min stake | 32 ETH (like mainnet) |
| Committees per epoch | 8 (configurable via `COMMITTEES_PER_EPOCH` at deploy) |
| Validators per committee | 8 (configurable in LOBBY via Instructor Controls, or `VALIDATORS_PER_COMMITTEE` at deploy) |
| Pool size | committeesPerEpoch × validatorsPerCommittee (default 64; set in LOBBY before Fill Bots and Start) |
| Blocks per epoch | 4 |
| Justification threshold | 2/3 of total staked |
| Slash penalty | 5% |
| Whistleblower reward | 10% of penalty |
| Block reward | 0.01 ETH |
| Inactivity penalty | 0.001 ETH (optional, instructor toggle) |

---

## Troubleshooting

- **"Transaction ran out of gas"** — Set validators per committee to a smaller value (e.g. 3–8) in LOBBY before Fill Bots and Start. Smaller pool = less gas. Or redeploy with `COMMITTEES_PER_EPOCH=8 VALIDATORS_PER_COMMITTEE=8`.
- **"Beacon Chain Lab not deployed"** — Run `npm run deploy:beacon-lab` with the chain running
- **"Config missing or no bot addresses"** — Deploy script writes bot addresses to config; ensure deploy completed
- **Students can't connect** — Share instructor IP and ensure RPC is accessible (e.g., `http://<IP>:8545`)
- **Attest not working** — Ensure session is ACTIVE and you are in the committee for this block's slot; check you haven't already attested
- **"Not in committee for this slot"** — You can only attest to blocks in slots where your committee is assigned. Wait for the next block or check **How committees form**.
