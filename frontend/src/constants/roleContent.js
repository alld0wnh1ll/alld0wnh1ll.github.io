/**
 * Role-specific content: goals, tasks, example scripts, and scenario boundaries.
 * Used by RoleHub to give students clear guidance per role.
 */

export const ROLE_CONTENT = {
  // ========== Car Sale (Lemon) Scenario ==========
  'Car Buyer': {
    scenario: 'Car Sale',
    tagline: 'Browse the marketplace. Avoid lemons using mechanic report, guess, or pay an investigator.',
    icon: '🚗',
    color: '#3b82f6',
    goals: [
      'Browse the marketplace—see car features (year, make, model, mileage) that incentivize purchase.',
      'See mechanic reports. Only ways to detect a lemon: mechanic says so, guess, or pay investigator.',
      'Investigators can be bribed—their report may be a lie. Complete purchase or refund based on your decision.',
    ],
    tasks: [
      { id: 'browse', label: 'Browse marketplace—see car features and mechanic reports', doneKey: null },
      { id: 'deploy', label: 'Deploy CarBuyerRole with CarSale address', doneKey: 'roleContract' },
      { id: 'fund', label: 'Send 2+ ETH to your CarBuyerRole contract', doneKey: null },
      { id: 'deposit', label: 'Call payDeposit() on CarSale (via your contract)', doneKey: 'depositPaid' },
      { id: 'inspect', label: 'Call requestInspection()', doneKey: 'inspectionRequested' },
      { id: 'complete', label: 'Call completePurchase() if passed, or requestRefund() if failed', doneKey: 'completed' },
    ],
    scripts: [
      {
        name: 'Check CarSale state',
        code: `// Replace carSaleAddr with the CarSale contract address from your instructor
const provider = ethers.provider;
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS - must be 0x + 40 hex chars
if (!carSaleAddr || carSaleAddr === '0x...' || carSaleAddr.length !== 42) throw new Error('Replace carSaleAddr with the real CarSale address from your instructor (0x + 40 hex chars)');
const abi = ['function currentState() view returns (uint8)', 'function getParticipants() view returns (address,address,address,address)', 'function salePrice() view returns (uint256)', 'function depositAmount() view returns (uint256)'];
const c = new ethers.Contract(carSaleAddr, abi, provider);
const [state, participants, price, deposit] = await Promise.all([
  c.currentState(),
  c.getParticipants(),
  c.salePrice(),
  c.depositAmount()
]);
const states = ['Listed','DepositPaid','InspectionRequested','InspectionPassed','InspectionFailed','Completed','Refunded'];
'State: ' + (states[state] || state) + ' | Price: ' + ethers.formatEther(price) + ' ETH | Deposit: ' + ethers.formatEther(deposit) + ' ETH'`
      },
      {
        name: 'Check car features + reports (marketplace view)',
        code: `// See what incentivizes you + mechanic & investigator reports
const provider = ethers.provider;
const carSaleAddr = '0x...'; // FROM MARKETPLACE OR INSTRUCTOR
const abi = [
  'function getCarFeatures() view returns (uint16 year, uint32 mileage, string make, string model)',
  'function getMechanicReport() view returns (bool passed, address)',
  'function getInvestigatorReport() view returns (bool passed, bool submitted)',
  'function salePrice() view returns (uint256)'
];
const c = new ethers.Contract(carSaleAddr, abi, provider);
const [features, mech, inv, price] = await Promise.all([c.getCarFeatures(), c.getMechanicReport(), c.getInvestigatorReport(), c.salePrice()]);
let out = features[0] + ' ' + features[2] + ' ' + features[3] + ' - ' + features[1] + ' mi | ' + ethers.formatEther(price) + ' ETH\\n';
out += 'Mechanic: ' + (mech[0] ? 'PASS' : 'FAIL') + (inv[1] ? ' | Investigator: ' + (inv[0] ? 'PASS' : 'FAIL') + ' (may be bribed)' : '');
out;`
      },
      {
        name: 'Check if mechanic attested',
        code: `// After requestInspection - check InspectionResult events
const provider = ethers.provider;
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
const abi = ['event InspectionResult(bool passed, address mechanic)'];
const c = new ethers.Contract(carSaleAddr, abi, provider);
const events = await c.queryFilter(c.filters.InspectionResult(), -500);
events.length === 0 ? 'No inspection result yet - mechanic must call mechanicInspect(true/false)' : (() => { const last = events[events.length - 1]; return 'Mechanic ' + last.args[1].slice(0,10) + '... attested: ' + (last.args[0] ? 'PASSED' : 'FAILED'); })()`
      },
    ],
    boundaries: `You are the Car Buyer. Browse the marketplace—see car features (year, make, model, mileage) and mechanic reports.

BOUNDARIES:
- Only ways to detect a lemon: mechanic report says fail, guess, or pay investigator (off-chain). Investigator may be bribed to lie.
- You MUST use the inspection flow. If mechanicInspect(true): completePurchase. If mechanicInspect(false): requestRefund.
- Optionally pay investigator before buying—they can look up the truth but may lie if bribed.
- Get CarSale address from marketplace or instructor. Deploy CarBuyerRole with that address.`,
  },

  'Mechanic': {
    scenario: 'Car Sale',
    tagline: 'Inspect the car and report honestly. Your attestation is on-chain.',
    icon: '🔧',
    color: '#22c55e',
    goals: [
      'Inspect the car and report your findings honestly.',
      'Call mechanicInspect(true) if the car is in good condition, mechanicInspect(false) if not.',
      'Your attestation is the buyer\'s only on-chain protection—your reputation matters.',
    ],
    tasks: [
      { id: 'deploy', label: 'Deploy MechanicRole with CarSale address', doneKey: 'roleContract' },
      { id: 'admin', label: 'Instructor sets you as mechanic in CarSale', doneKey: null },
      { id: 'inspect', label: 'Call mechanicInspect(true) or mechanicInspect(false) based on findings', doneKey: 'inspectionDone' },
    ],
    scripts: [
      {
        name: 'Call mechanicInspect (pass)',
        code: `// Call from your MechanicRole contract - use Connect tab or signer
const [wallet] = await ethers.getSigners();
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
const mechanicAddr = '0x...'; // YOUR MECHANIC ROLE CONTRACT
const abi = ['function mechanicInspect(bool passed)'];
const c = new ethers.Contract(carSaleAddr, abi, wallet);
const tx = await c.mechanicInspect(true); // true = pass, false = fail
await tx.wait();
'Inspection passed. State is now InspectionPassed.'`
      },
      {
        name: 'Call mechanicInspect (fail)',
        code: `// Call from your MechanicRole contract
const [wallet] = await ethers.getSigners();
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
const abi = ['function mechanicInspect(bool passed)'];
const c = new ethers.Contract(carSaleAddr, abi, wallet);
const tx = await c.mechanicInspect(false);
await tx.wait();
'Inspection failed. Buyer can now requestRefund().'`
      },
    ],
    boundaries: `You are the Mechanic. The buyer has requested an inspection. You must call mechanicInspect(true) or mechanicInspect(false) on the CarSale contract.

BOUNDARIES:
- Only the address set as mechanic in CarSale can call mechanicInspect.
- If you call mechanicInspect(true): buyer can complete the purchase.
- If you call mechanicInspect(false): buyer can request a refund.
- The contract cannot verify if you are honest—your attestation is trusted on-chain.
- You must have been set as mechanic by the admin before you can inspect.`,
  },

  'Detective': {
    scenario: 'Car Sale',
    tagline: 'Search the chain. Read mechanic reports and original car history. Buyers pay you to report—you can lie if bribed.',
    icon: '🔍',
    color: '#0ea5e9',
    goals: [
      'Search the chain: read mechanic reports and original car history (trueCondition).',
      'Buyers pay you (off-chain) to look up and report. Submit honest or bribed reports via submitReport(carSale, passed).',
      'Create an environment where mechanics and investigators can both be bribed—contract cannot verify truth.',
    ],
    tasks: [
      { id: 'deploy', label: 'Deploy CarInvestigatorRole', doneKey: 'roleContract' },
      { id: 'admin', label: 'Instructor sets your contract as investigator in CarSale', doneKey: null },
      { id: 'audit', label: 'After mechanic inspects: Check for Fraud, then Submit Report (honest or bribed)', doneKey: null },
    ],
    scripts: [
      {
        name: 'Check for mechanic fraud (Detective only)',
        code: `// You must be set as investigator in CarSale. Connect with your wallet.
const provider = ethers.provider;
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
if (!carSaleAddr || carSaleAddr === '0x...' || carSaleAddr.length !== 42) throw new Error('Replace carSaleAddr with the real CarSale address from your instructor');
const abi = [
  'function getTrueCondition() view returns (bool)',
  'function getMechanicReport() view returns (bool passed, address)',
  'function currentState() view returns (uint8)'
];
const c = new ethers.Contract(carSaleAddr, abi, wallet.signer); // use signer - getTrueCondition requires investigator
const [trueCond, report, state] = await Promise.all([
  c.getTrueCondition(),
  c.getMechanicReport(),
  c.currentState()
]);
const states = ['Listed','DepositPaid','InspectionRequested','InspectionPassed','InspectionFailed','Completed','Refunded'];
const hasInspected = state >= 3; // InspectionPassed or later
if (!hasInspected) return 'Mechanic has not inspected yet. Wait for inspection.';
const match = trueCond === report[0];
return match ? '✓ Mechanic honest: report matches true condition.' : '⚠️ FRAUD: True condition=' + (trueCond?'good':'lemon') + ', mechanic said=' + (report[0]?'pass':'fail') + ' — mechanic lied!';`
      },
      {
        name: 'Submit report (honest or bribed)',
        code: `// Via CarInvestigatorRole - buyer paid you off-chain, now submit
const [wallet] = await ethers.getSigners();
const invAddr = '0x...'; // YOUR CarInvestigatorRole CONTRACT
const carSaleAddr = '0x...'; // CARSALE TO REPORT ON
const abi = ['function submitReport(address carSale, bool passed)'];
const inv = new ethers.Contract(invAddr, abi, wallet);
const tx = await inv.submitReport(carSaleAddr, true); // true=pass, false=fail (can lie if bribed)
await tx.wait();
'Report submitted. Buyer can now see via getInvestigatorReport().';`
      },
      {
        name: 'Get mechanic report (public - buyers/sellers see this)',
        code: `// Anyone can call - buyers and sellers see only this
const provider = ethers.provider;
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
const abi = ['function getMechanicReport() view returns (bool passed, address)'];
const c = new ethers.Contract(carSaleAddr, abi, provider);
const [passed, mechanic] = await c.getMechanicReport();
'Mechanic report: ' + (passed ? 'PASSED' : 'FAILED') + ' (mechanic: ' + mechanic.slice(0,10) + '...)';`
      },
    ],
    boundaries: `You are the Detective. Search the chain: read mechanic reports and original car history (trueCondition).

BOUNDARIES:
- Deploy CarInvestigatorRole. Instructor sets setInvestigator(yourContractAddress) on CarSale.
- Buyers pay you off-chain to report. You read getTrueCondition(), then submitReport(carSale, passed).
- You can submit the truth or lie (bribed)—the contract cannot verify. Buyers see your report via getInvestigatorReport().`,
  },

  'Car Seller': {
    scenario: 'Car Sale',
    tagline: 'Sell your car. Instructor sets car features to incentivize buyers. Receive payment when sale completes.',
    icon: '🏪',
    color: '#10b981',
    goals: [
      'Share your wallet address with the instructor—they set you as seller and set car features (year, make, model, mileage) to incentivize buyers.',
      'Receive payment directly to your wallet when the buyer completes the purchase.',
    ],
    tasks: [
      { id: 'share', label: 'Share your wallet address with the instructor', doneKey: null },
      { id: 'admin', label: 'Instructor sets your address as seller in CarSale', doneKey: null },
      { id: 'wait', label: 'Wait for buyer and mechanic to complete the flow', doneKey: null },
    ],
    scripts: [
      {
        name: 'Check sale state',
        code: `const provider = ethers.provider;
const carSaleAddr = '0x...'; // PASTE CARSALE ADDRESS
if (!carSaleAddr || carSaleAddr === '0x...' || carSaleAddr.length !== 42) throw new Error('Replace carSaleAddr with the real CarSale address from your instructor');
const abi = ['function currentState() view returns (uint8)', 'function seller() view returns (address)'];
const c = new ethers.Contract(carSaleAddr, abi, provider);
const [state, seller] = await Promise.all([c.currentState(), c.seller()]);
const states = ['Listed','DepositPaid','InspectionRequested','InspectionPassed','InspectionFailed','Completed','Refunded'];
'State: ' + (states[state] || state) + ' | Seller: ' + seller.slice(0,10) + '...'`
      },
    ],
    boundaries: `You are the Car Seller. Share your wallet address with the instructor—they set it as seller in CarSale. When the buyer completes the purchase, you receive the sale proceeds directly to your wallet. No contract to deploy.`,
  },

  // ========== Ransomware Scenario ==========
  'Victim': {
    scenario: 'Ransomware',
    tagline: 'Pay the ransom through the contract. Your payment creates an on-chain trail.',
    icon: '😰',
    color: '#8b5cf6',
    goals: [
      'Recover your files by paying the ransom through the RansomPayment contract.',
      'Understand that your payment is traceable on-chain.',
      'Complete the payment so investigators can trace the flow.',
    ],
    tasks: [
      { id: 'deploy', label: 'Deploy VictimRole', doneKey: 'roleContract' },
      { id: 'fund', label: 'Send ETH to your VictimRole contract', doneKey: null },
      { id: 'pay', label: 'Call payRansomOnBehalf(ransomContract) with ETH', doneKey: 'ransomPaid' },
    ],
    scripts: [
      {
        name: 'Pay ransom (via VictimRole)',
        code: `// Get RansomPayment address from instructor
const [wallet] = await ethers.getSigners();
const ransomAddr = '0x...'; // PASTE RANSOM PAYMENT CONTRACT
const victimRoleAddr = '0x...'; // YOUR VICTIM ROLE CONTRACT
const abi = ['function payRansomOnBehalf(address ransomContract) external payable'];
const c = new ethers.Contract(victimRoleAddr, abi, wallet);
const tx = await c.payRansomOnBehalf(ransomAddr, { value: ethers.parseEther('0.5') });
await tx.wait();
'Ransom paid. Investigators can now trace the flow.'`
      },
      {
        name: 'Check RansomPayment balance',
        code: `const provider = ethers.provider;
const ransomAddr = '0x...'; // PASTE RANSOM CONTRACT ADDRESS
if (!ransomAddr || ransomAddr === '0x...' || ransomAddr.length !== 42) throw new Error('Replace ransomAddr with the real RansomPayment address from your instructor');
const abi = ['function getContractBalance() view returns (uint256)'];
const c = new ethers.Contract(ransomAddr, abi, provider);
const bal = await c.getContractBalance();
'Contract balance: ' + ethers.formatEther(bal) + ' ETH'`
      },
    ],
    boundaries: `You are the Victim. Your files are encrypted. You must pay the ransom through the RansomPayment contract to recover them.

BOUNDARIES:
- Call payRansom() (or payRansomOnBehalf from VictimRole) with ETH.
- Your payment goes to the attacker address set in the contract.
- The payment creates an on-chain trail: Victim → Contract → Attacker → Tumblers.
- Investigators will trace this flow. You have no choice but to pay.`,
  },

  'Attacker': {
    scenario: 'Ransomware',
    tagline: 'Receive ransom payments. Obscure the trail from investigators.',
    icon: '🕵️',
    color: '#dc2626',
    goals: [
      'Receive ransom payments from victims.',
      'Move funds through tumbler addresses to obscure the trail.',
      'Avoid being traced by investigators.',
    ],
    tasks: [
      { id: 'deploy', label: 'Deploy AttackerRole', doneKey: 'roleContract' },
      { id: 'admin', label: 'Share address with instructor; they set you in RansomPayment', doneKey: null },
      { id: 'receive', label: 'Receive payments; move through tumblers', doneKey: null },
    ],
    scripts: [
      {
        name: 'Withdraw from AttackerRole',
        code: `const [wallet] = await ethers.getSigners();
const attackerRoleAddr = '0x...'; // YOUR CONTRACT
const abi = ['function withdraw() external'];
const c = new ethers.Contract(attackerRoleAddr, abi, wallet);
const tx = await c.withdraw();
await tx.wait();
'Withdrawn. Move funds through tumblers to obscure trail.'`
      },
      {
        name: 'Check balance',
        code: `const [wallet] = await ethers.getSigners();
const provider = ethers.provider;
const addr = wallet.address; // or your AttackerRole address
const bal = await provider.getBalance(addr);
'Balance: ' + ethers.formatEther(bal) + ' ETH'`
      },
    ],
    boundaries: `You are the Attacker. The instructor sets your address in RansomPayment. Victims pay; you receive.

BOUNDARIES:
- RansomPayment forwards ETH directly to your address (or AttackerRole).
- Investigators trace: Victim → Contract → You → Tumblers → Final.
- Use the forensics-setup flow to create tumbler addresses. First correct submission by an investigator may win a bounty.`,
  },

  'Investigator': {
    scenario: 'Ransomware',
    tagline: 'Trace the ransom flow. Identify the attacker\'s final address.',
    icon: '🔍',
    color: '#0ea5e9',
    goals: [
      'Trace the ransom flow: Victim → Contract → Attacker → Tumblers → Final.',
      'Use block explorer, Hardhat console, or forensics UI to follow transactions.',
      'Submit the correct final address for the bounty. First correct submission wins.',
    ],
    tasks: [
      { id: 'deploy', label: 'Deploy InvestigatorRole', doneKey: 'roleContract' },
      { id: 'trace', label: 'Trace Victim → RansomPayment → Attacker → Tumblers', doneKey: null },
      { id: 'submit', label: 'Submit correct final address via submitFinding()', doneKey: 'findingSubmitted' },
    ],
    scripts: [
      {
        name: 'Trace RansomPayment attacker',
        code: `// Start of the trail: who receives from RansomPayment?
const provider = ethers.provider;
const ransomAddr = '0x...'; // FROM INSTRUCTOR
if (!ransomAddr || ransomAddr === '0x...' || ransomAddr.length !== 42) throw new Error('Replace ransomAddr with the real RansomPayment address from your instructor');
const abi = ['function attacker() view returns (address)'];
const c = new ethers.Contract(ransomAddr, abi, provider);
const attacker = await c.attacker();
'Attacker (first hop): ' + attacker`
      },
      {
        name: 'Get transaction by hash',
        code: `// Trace a specific transaction
const provider = ethers.provider;
const txHash = '0x...'; // FROM BLOCK EXPLORER OR EVENTS
const tx = await provider.getTransaction(txHash);
const receipt = await provider.getTransactionReceipt(txHash);
'From: ' + tx.from + ' | To: ' + tx.to + ' | Value: ' + ethers.formatEther(tx.value) + ' ETH'`
      },
      {
        name: 'Submit finding',
        code: `// Record your finding in InvestigatorRole
const [wallet] = await ethers.getSigners();
const investigatorAddr = '0x...'; // YOUR CONTRACT
const foundAddr = '0x...'; // ATTACKER'S FINAL ADDRESS
const abi = ['function submitFinding(address _found) external'];
const c = new ethers.Contract(investigatorAddr, abi, wallet);
const tx = await c.submitFinding(foundAddr);
await tx.wait();
'Finding submitted. Instructor verifies for bounty.'`
      },
    ],
    boundaries: `You are the Investigator. Victims have paid ransoms. Your job is to trace the flow and identify the attacker's final address.

BOUNDARIES:
- Flow: Victim → RansomPayment contract → Attacker → Tumblers (multiple hops) → Final cash-out.
- Use provider.getTransaction(txHash), provider.getTransactionReceipt(txHash), and RansomPayment.attacker().
- Submit the correct final address via submitFinding() on your InvestigatorRole contract.
- First correct submission wins the bounty (instructor verifies).`,
  },

  // ========== Other roles (minimal content) ==========
  'Escrow Agent': {
    scenario: 'Car Sale',
    tagline: 'Hold funds until conditions are met. Release only when appropriate.',
    icon: '📦',
    color: '#64748b',
    goals: ['Hold funds until conditions are met.', 'Release only when appropriate.'],
    tasks: [{ id: 'deploy', label: 'Deploy EscrowAgentRole', doneKey: 'roleContract' }],
    scripts: [],
    boundaries: 'You are neutral. The contract enforces the flow.',
  },
  'Admin': {
    scenario: 'House Sale',
    tagline: 'Manage the sale. Assign roles.',
    icon: '👤',
    color: '#6366f1',
    goals: ['Manage the sale. Assign roles.'],
    tasks: [],
    scripts: [],
    boundaries: 'Set seller and buyer. Oversee the process.',
  },
  'Seller': {
    scenario: 'House Sale',
    tagline: 'Sell the property. Receive payment.',
    icon: '🏠',
    color: '#10b981',
    goals: ['Sell the property. Receive payment.'],
    tasks: [],
    scripts: [],
    boundaries: 'Complete inspection period. Confirm transfer.',
  },
  'Buyer': {
    scenario: 'House Sale',
    tagline: 'Complete the purchase.',
    icon: '🏠',
    color: '#3b82f6',
    goals: ['Complete the purchase.'],
    tasks: [],
    scripts: [],
    boundaries: 'Pay deposit, approve inspection, pay balance.',
  },
  'Organizer': {
    scenario: 'Event Tickets',
    tagline: 'Sell tickets. Manage the event.',
    icon: '🎫',
    color: '#f59e0b',
    goals: ['Sell tickets. Manage the event.'],
    tasks: [],
    scripts: [],
    boundaries: 'Set prices. Issue valid tickets.',
  },
  'Creator': {
    scenario: 'Crowdfunding',
    tagline: 'Raise funds. Deliver on milestones.',
    icon: '💰',
    color: '#22c55e',
    goals: ['Raise funds. Deliver on milestones.'],
    tasks: [],
    scripts: [],
    boundaries: 'Set goals. Disburse fairly.',
  },
  'Contributor': {
    scenario: 'Crowdfunding',
    tagline: 'Support the project. Get value.',
    icon: '🤝',
    color: '#8b5cf6',
    goals: ['Support the project. Get value.'],
    tasks: [],
    scripts: [],
    boundaries: 'Contribute. Claim rewards if eligible.',
  },
  'Voter': {
    scenario: 'Voting',
    tagline: 'Cast your vote.',
    icon: '🗳️',
    color: '#0ea5e9',
    goals: ['Cast your vote.'],
    tasks: [],
    scripts: [],
    boundaries: 'Vote once per option.',
  },
};

/** Get content for a role; fallback for unknown roles */
export function getRoleContent(role) {
  if (!role || !role.trim()) return null;
  return ROLE_CONTENT[role] || {
    scenario: 'General',
    tagline: 'Complete your role objectives.',
    icon: '👤',
    color: '#64748b',
    goals: ['Follow instructor instructions.'],
    tasks: [],
    scripts: [],
    boundaries: 'Check with your instructor for role-specific guidance.',
  };
}
