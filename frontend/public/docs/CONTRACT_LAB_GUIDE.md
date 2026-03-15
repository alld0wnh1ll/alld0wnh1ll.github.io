# Contract Lab — GUI Guide for Students

Build, compile, deploy, and interact with smart contracts from the web UI. Work with classmates to complete scenarios.

## Where to Find It

**Live** tab → scroll to **Contract Lab** → expand the section.

## Tabs

### 1. Example Scripts

Verification scripts to confirm your setup works:

| Script | What it does |
|--------|--------------|
| Verify connection | Check you can read from the PoS contract |
| Check my balance | Get your wallet balance |
| Check my role | See if you have a role assigned |
| Read total staked | Network staking stats |
| Connect to classmate's contract | Verify a contract exists at an address |
| List recent chat senders | See who has participated |
| Call view on custom contract | Read from SimpleStorage (paste address) |

**How to use:** Click **Load** on any script → it loads into the Script Playground below → click **Run**.

### 2. Write & Compile

Write Solidity in the editor. Compile in the browser.

1. Enter your **contract name** (must match the name in your code).
2. Write or edit the Solidity code.
3. Click **Compile**.
4. If successful, go to **Deploy** tab → select "My compiled contract" → **Deploy**.

**Example:** The default `MyContract` has `set(uint256)` and `get()`. Compile, deploy, then use **Connect** to interact.

### 3. Deploy

Deploy templates or your compiled contract:

| Template | Constructor args |
|----------|------------------|
| SimpleStorage | None |
| Car Sale | seller, buyer, mechanic addresses |
| My compiled contract | None (for contracts with no-arg constructor) |

After deploy, **copy the address** and share with classmates.

### 4. Connect & Interact

Connect to any contract (yours or a classmate's):

1. Paste the **contract address**.
2. Select the **template** (SimpleStorage, Car Sale, or My contract).
3. Call functions: **Call** for view functions, **Send** for write functions.

**For SimpleStorage:** `get()` → Call. `set(value)` → enter value, Send.

**For Car Sale:** `payDeposit()` (payable), `requestInspection()`, `mechanicInspect(bool)`, etc.

## Working with Classmates

1. **Deployer (Instructor):** Deploy a contract (e.g. Car Sale) in **Live → Contract Lab → Deploy** tab. Copy the address and **share with students** (write on board). Students need this for Car Buyer and Mechanic roles.
2. **Share:** Post the address in chat or share with your scenario partners.
3. **Others:** Paste the address in Connect, select the template, interact.

## Custom Contracts (CLI)

For more complex contracts:

1. Use the CLI Contract Builder: `node interactive.js` → option 9.
2. Or write Solidity in `contracts/`, compile with `npx hardhat compile`.
3. Deploy via `npx hardhat run scripts/deploy-role.js` or CLI.
4. Paste the address in **Connect** → select "My contract" if you compiled in the GUI, or use a matching template.
