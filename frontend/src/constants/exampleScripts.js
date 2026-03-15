/**
 * Example scripts for students to verify setup and interact with contracts.
 * Load into Script Playground to confirm everything works.
 */

export const EXAMPLE_SCRIPTS = [
  {
    name: '1. Verify connection',
    description: 'Check you can read from the PoS contract',
    code: `// Verify connection to PoS contract
const c = new ethers.Contract(posAddress, PoSABI, provider);
const [total, epoch] = await Promise.all([c.totalStaked(), c.currentEpoch()]);
return '✓ Connected! Total staked: ' + ethers.formatEther(total) + ' ETH, Epoch: ' + epoch;`
  },
  {
    name: '2. Check my balance',
    description: 'Get your wallet balance',
    code: `// Check your balance
const bal = await provider.getBalance(wallet.address);
return 'Your balance: ' + ethers.formatEther(bal) + ' ETH';`
  },
  {
    name: '3. Check my role',
    description: 'See if you have a role assigned',
    code: `// Check your role
const c = new ethers.Contract(posAddress, PoSABI, provider);
const role = await c.roleAssignment(wallet.address);
return role && role.trim() ? 'Your role: ' + role : 'No role yet — join (stake or chat) to get one';`
  },
  {
    name: '4. Read total staked',
    description: 'Get network staking stats',
    code: `// Network stats
const c = new ethers.Contract(posAddress, PoSABI, provider);
const total = await c.totalStaked();
const count = await c.getValidatorCount();
return 'Total staked: ' + ethers.formatEther(total) + ' ETH across ' + count + ' validators';`
  },
  {
    name: '5. Connect to a classmate\'s contract',
    description: 'Read from any contract by address (change the address!)',
    code: `// Replace with your classmate's contract address
const addr = '0x...'; // PASTE ADDRESS HERE
const code = await provider.getCode(addr);
if (!code || code === '0x') return 'No contract at that address';
// For SimpleStorage: const abi = ['function get() view returns (uint256)'];
// const c = new ethers.Contract(addr, abi, provider);
// return 'Stored value: ' + (await c.get());
return 'Contract exists at ' + addr.slice(0,10) + '...';`
  },
  {
    name: '6. List recent chat senders',
    description: 'See who has participated',
    code: `// Recent chat participants
const c = new ethers.Contract(posAddress, PoSABI, provider);
const events = await c.queryFilter(c.filters.NewMessage(), -1000); // last ~1000 blocks
const senders = [...new Set(events.map(e => e.args[0]))];
return senders.length + ' participants: ' + senders.slice(0,5).map(a => a.slice(0,10)+'...').join(', ');`
  },
  {
    name: '7. Call view on custom contract',
    description: 'Read from SimpleStorage (paste address)',
    code: `// SimpleStorage.get() - replace addr with deployed contract
const addr = '0x...'; // Your or classmate's SimpleStorage address
const abi = ['function get() view returns (uint256)', 'function owner() view returns (address)'];
const c = new ethers.Contract(addr, abi, provider);
const [val, owner] = await Promise.all([c.get(), c.owner()]);
return 'Value: ' + val + ', Owner: ' + owner;`
  }
];
