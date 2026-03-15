# Role Boilerplate Scripts

Each scenario role has a ready-to-deploy contract and script. Students build, deploy, and register to complete their role.

## Quick Reference

Use env vars (Hardhat doesn't pass extra args to scripts):

**Unix/Mac:**
```bash
ROLE=CarSeller npx hardhat run scripts/deploy-role.js --network localhost
ROLE=CarBuyer CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost
```

**Windows PowerShell:**
```powershell
$env:ROLE="CarSeller"; npx hardhat run scripts/deploy-role.js --network localhost
$env:ROLE="CarBuyer"; $env:CARSALE_ADDRESS="0x..."; npx hardhat run scripts/deploy-role.js --network localhost
```

| Role | Contract | Deploy Command |
|------|----------|----------------|
| Car Seller (Honest/Lemon) | `CarSellerRole.sol` | `ROLE=CarSeller npx hardhat run scripts/deploy-role.js --network localhost` |
| Car Buyer | `CarBuyerRole.sol` | `ROLE=CarBuyer CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost` |
| Mechanic / Mechanic (Bribed) | `MechanicRole.sol` | `ROLE=Mechanic CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost` |
| Escrow Agent | `EscrowAgentRole.sol` | `ROLE=EscrowAgent npx hardhat run scripts/deploy-role.js --network localhost` |
| Victim | `VictimRole.sol` | `ROLE=Victim npx hardhat run scripts/deploy-role.js --network localhost` |
| Attacker | `AttackerRole.sol` | `ROLE=Attacker npx hardhat run scripts/deploy-role.js --network localhost` |
| Investigator | `InvestigatorRole.sol` | `ROLE=Investigator npx hardhat run scripts/deploy-role.js --network localhost` |

## File Locations

All role contracts live in `contracts/student/roles/`:

```
contracts/student/roles/
├── ICarSale.sol          # Interface for Car Sale
├── CarSellerRole.sol
├── CarBuyerRole.sol
├── MechanicRole.sol
├── EscrowAgentRole.sol
├── VictimRole.sol
├── AttackerRole.sol
└── InvestigatorRole.sol
```

## Car Sale Scenario Flow

1. **Instructor** deploys `CarSale`: Go to **Live** tab → **Contract Lab** (expand) → **Deploy** tab → select **Car Sale** → Deploy. Copy the address shown and share with students (write on board).
2. **Car Seller** deploys `CarSellerRole`, shares address. Instructor sets as seller in CarSale.
3. **Car Buyer** deploys `CarBuyerRole` with CarSale address. Sends 2 ETH to contract, calls `payDeposit()` → `requestInspection()` → `completePurchase()`.
4. **Mechanic** deploys `MechanicRole` with CarSale address. Instructor sets as mechanic. Calls `mechanicInspect(true)` or `mechanicInspect(false)`.

## Ransomware Scenario Flow

1. **Instructor** deploys `RansomPayment` with attacker address.
2. **Victim** deploys `VictimRole`, calls `payRansomOnBehalf(ransomAddr)` with ETH.
3. **Attacker** deploys `AttackerRole`, shares address. Instructor calls `RansomPayment.setAttacker(attackerAddr)`.
4. **Investigator** traces flow, submits finding, claims bounty.

## After Deploy

1. Copy the deployed contract address from the terminal.
2. In the web UI, go to **Complete your role**.
3. Paste the address and click **Register**.
