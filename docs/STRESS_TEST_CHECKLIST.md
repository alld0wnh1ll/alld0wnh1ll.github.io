# Stress Test Checklist (16 Students)

Use this checklist to verify the platform works correctly with 16 concurrent users before delivery.

## Prerequisites

- Blockchain running: `npm run chain`
- Terminal server: `npm run terminal` (or Docker)
- Frontend: `npm run dev`
- Pre-generated accounts: `node scripts/prepare-classroom.js` (creates 16 accounts)

## Test Scenarios

### 1. Connect (16 students simultaneously)

- [ ] Open 16 browser tabs/windows to the lab URL
- [ ] Connect wallet in each (use different accounts from student-accounts.json)
- [ ] Verify: All 16 show wallet balance, no RPC errors
- [ ] Verify: Node status shows "Connected" in all

### 2. Stake (16 students in parallel)

- [ ] Fund all 16 accounts (instructor uses bank/faucet)
- [ ] All 16 click Stake and complete transaction
- [ ] Verify: All 16 show staked amount, no nonce conflicts
- [ ] Verify: Leaderboard shows all 16 validators

### 3. Lab Terminal (16 PTYs)

- [ ] All 16 open Lab Terminal (click Open Lab Terminal)
- [ ] Verify: 16 separate terminal windows connect
- [ ] Verify: No "Cannot connect to terminal server" errors
- [ ] Verify: Each can run a command (e.g. `echo test`)

### 4. Role Assignment

- [ ] Instructor sends `[SCENARIO:Car Sale:Car Buyer,Mechanic,Car Seller (Honest)]` or `[ROLES:addr:Role;...]` via chat
- [ ] Verify: All 16 receive correct role in Role Hub
- [ ] Verify: Role Hub shows goals, tasks, scripts for each role

### 5. Account Creation (concurrent)

- [ ] Multiple students run account creation via Account Manager simultaneously
- [ ] Verify: No lost data in student-accounts.json
- [ ] Verify: File locking prevents corruption

### 6. Car Sale Scenario

- [ ] Instructor deploys CarSale, sets seller, buyer, mechanic
- [ ] Buyer: payDeposit → requestInspection
- [ ] Mechanic: mechanicInspect(true) or mechanicInspect(false)
- [ ] Buyer: completePurchase or requestRefund
- [ ] Verify: Full flow completes without errors

### 7. Ransomware Scenario

- [ ] Instructor deploys RansomPayment, sets attacker
- [ ] Victim: payRansom
- [ ] Investigator: trace and submit finding
- [ ] Verify: Flow completes

### 8. Instructor View

- [ ] Instructor opens Instructor View
- [ ] Verify: Loads with 16 students in table
- [ ] Verify: Filters (role, has contract) work
- [ ] Verify: Export CSV works

### 9. Progress Display

- [ ] Open progress-display.html in new tab
- [ ] Enter RPC URL and PoS address, Connect & Load
- [ ] Verify: Leaderboard shows all validators
- [ ] Verify: Auto-refresh every 5 seconds

## Fixes to Apply if Issues Found

- **RPC timeout**: Increase timeout in provider config; reduce polling frequency
- **Terminal connection drops**: Check TERMINAL_PORTS env; ensure server listens on all
- **Account file corruption**: Verify .student-accounts.lock and file locking in account-manager
- **Instructor view slow**: Consider reducing poll interval or batching contract reads
