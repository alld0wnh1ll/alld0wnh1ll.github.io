/**
 * TokenizationLabView - Step-through lab: read ERC-721, understand EVM mint, deploy, trace, metadata.
 * Uses local Hardhat node and ChainSearch. No 3rd party services. Metadata via data URIs.
 */
import { useState } from 'react';
import InlineTerminal from '../components/InlineTerminal';
import { ChainSearch } from '../components/ChainSearch';

const ERC721_ANNOTATIONS = [
  { fn: 'balanceOf(address owner)', desc: 'Returns how many tokens the given address owns. ERC-721: each owner has 0 or more unique token IDs.' },
  { fn: 'ownerOf(uint256 tokenId)', desc: 'Returns the address that owns the token with the given ID. Reverts if the token does not exist.' },
  { fn: 'approve(address to, uint256 tokenId)', desc: 'Gives permission for another address to transfer your token. Only the owner can approve.' },
  { fn: 'getApproved(uint256 tokenId)', desc: 'Returns the address approved to transfer this token, or zero if none.' },
  { fn: 'setApprovalForAll(address operator, bool approved)', desc: 'Approves or revokes an operator for all of your tokens. Used by marketplaces.' },
  { fn: 'isApprovedForAll(address owner, address operator)', desc: 'Returns true if the operator is approved to manage all tokens of the owner.' },
  { fn: 'transferFrom(address from, address to, uint256 tokenId)', desc: 'Transfers a token. Caller must be owner, approved, or approved operator.' },
  { fn: 'safeTransferFrom(...)', desc: 'Same as transferFrom but checks the recipient can receive NFTs (ERC721Receiver).' },
  { fn: 'tokenURI(uint256 tokenId)', desc: 'Returns a URI (URL or data URI) pointing to JSON metadata: name, description, image.' },
  { fn: 'mint(address to, string tokenURI_)', desc: 'LabNFT-specific: mints a new token to `to` with the given metadata URI. Only minter can call.' },
];

const STEPS = [
  {
    id: 1,
    title: 'Read & Explain ERC-721',
    description: 'Study the LabNFT contract. For each function below, expand "What does this do?" and identify its purpose. Do not copy-paste — understand each one.',
    code: null,
    loadLabel: null,
  },
  {
    id: 2,
    title: 'EVM Deep Dive: mint()',
    description: 'When mint() is called, understand what happens at the EVM level.',
    code: null,
    loadLabel: null,
  },
  {
    id: 3,
    title: 'Deploy & Trace',
    description: 'Deploy LabNFT, mint a token, then paste the transaction hash into Search Chain to trace: sender, value, and Transfer event.',
    code: `// 1. Deploy LabNFT (run in Lab Terminal - start with: npx hardhat console --network localhost)
const contract = await ethers.deployContract("LabNFT", ["LabNFT", "LAB"]);
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log("Deployed to:", addr);

// 2. Mint a token (replace tokenURI with data URI from Step 4, or use "" for empty)
const tx = await contract.mint(await (await ethers.getSigners())[0].getAddress(), "");
const receipt = await tx.wait();
console.log("Mint tx hash:", receipt.hash);
console.log("Paste this hash into Search Chain to trace!");`,
    loadLabel: 'Load deploy & mint script',
  },
  {
    id: 4,
    title: 'Metadata & Data URI',
    description: 'Create EIP-721 metadata JSON. Generate a data URI and use it as tokenURI when minting.',
    code: null,
    loadLabel: null,
  },
  {
    id: 5,
    title: 'Transfer to Another Student',
    description: 'Get your partner\'s EOA address (Class Chat or share). Connect to the same LabNFT contract, then call transferFrom to send your token to them. Verify with ownerOf.',
    code: `// 1. Get contract address (deployer shares this) and partner address
const nftAddr = "0x...";  // PASTE LABNFT CONTRACT ADDRESS
const partnerAddr = "0x...";  // PASTE PARTNER'S EOA ADDRESS
const tokenId = 1;  // Which token you own

// 2. Connect and transfer
const c = await ethers.getContractAt("LabNFT", nftAddr);
const [me] = await ethers.getSigners();
await c.transferFrom(me.address, partnerAddr, tokenId);

// 3. Verify
console.log("New owner:", await c.ownerOf(tokenId));`,
    loadLabel: 'Load transfer script',
  },
  {
    id: 6,
    title: 'Build a Sale Contract',
    description: 'Deploy LabNFTSale, then as seller: approve and list your NFT. As buyer: pay ETH to buy. Atomic swap — both parties get what they agreed.',
    code: null,
    loadLabel: null,
  },
];

function CodeBlock({ code, onLoad, loadLabel }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{ position: 'relative', marginTop: '0.75rem' }}>
      <pre
        style={{
          margin: 0,
          padding: '1rem',
          background: '#0c0c0c',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          color: '#86efac',
          fontSize: '0.85rem',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {code}
      </pre>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="button" onClick={copy} style={{ padding: '0.35rem 0.75rem', background: '#334155', border: 'none', borderRadius: '0.35rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {onLoad && loadLabel && (
          <button type="button" onClick={() => onLoad(code)} style={{ padding: '0.35rem 0.75rem', background: 'var(--primary)', border: 'none', borderRadius: '0.35rem', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            {loadLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Expandable({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid #334155', borderRadius: '0.35rem', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          background: open ? 'rgba(245,158,11,0.15)' : '#1e293b',
          border: 'none',
          color: '#fcd34d',
          fontSize: '0.85rem',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <code style={{ fontFamily: 'monospace' }}>{title}</code>
        <span>{open ? '▼' : '▶'}</span>
      </button>
      {open && <div style={{ padding: '0.75rem 1rem', background: '#0f172a', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6 }}>{children}</div>}
    </div>
  );
}

const DEFAULT_METADATA = {
  name: 'My Lab NFT',
  description: 'Created in the Tokenization Lab',
  image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzEwYjk4MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPkxhYk5GVDwvdGV4dD48L3N2Zz4=',
};

export function TokenizationLabView({ provider, wallet, rpcUrl }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [loadCode, setLoadCode] = useState('');
  const [loadFeedback, setLoadFeedback] = useState('');
  const [metadataJson, setMetadataJson] = useState(JSON.stringify(DEFAULT_METADATA, null, 2));
  const [metadataError, setMetadataError] = useState('');
  const [dataUri, setDataUri] = useState('');

  const step = STEPS.find((s) => s.id === currentStep);

  const handleLoadCode = (code) => {
    setLoadCode(code);
    setTerminalOpen(true);
    setLoadFeedback('Code loaded! Run in Lab Terminal. If terminal shows an error, run: npm run terminal');
    setTimeout(() => setLoadFeedback(''), 5000);
    setTimeout(() => document.querySelector('[data-lab-terminal]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  };

  const handleGenerateDataUri = () => {
    setMetadataError('');
    try {
      const parsed = JSON.parse(metadataJson);
      if (!parsed.name || typeof parsed.name !== 'string') {
        setMetadataError('Missing or invalid "name" field');
        return;
      }
      const str = JSON.stringify(parsed);
      const uri = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(str)));
      setDataUri(uri);
    } catch (e) {
      setMetadataError('Invalid JSON: ' + (e?.message || 'parse error'));
    }
  };

  const copyDataUri = () => {
    if (dataUri) navigator.clipboard?.writeText(dataUri);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Tokenization Lab</h1>
      {!provider && (
        <div style={{ padding: '1rem', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '0.5rem', color: '#fde047', marginBottom: '1rem' }}>
          Connect to the chain first: go to <strong>Live</strong> tab, set RPC URL, and connect your wallet.
        </div>
      )}
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1rem' }}>
        Read and explain ERC-721, understand EVM-level mint behavior, deploy to localhost, mint, trace via ChainSearch, and create metadata as data URIs.
      </p>
      <a href="/docs/TOKENIZATION_LAB.md" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>
        Read: Tokenization Lab guide
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setCurrentStep(s.id)}
            style={{
              padding: '0.4rem 0.8rem',
              background: currentStep === s.id ? 'var(--primary)' : '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      <div style={{ padding: '1.5rem', background: 'var(--card)', borderRadius: '0.75rem', border: '1px solid #475569', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Step {step.id}: {step.title}</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.description}</p>

        {currentStep === 1 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Identify what each function does:</p>
            {ERC721_ANNOTATIONS.map((a, i) => (
              <Expandable key={i} title={a.fn}>
                {a.desc}
              </Expandable>
            ))}
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <h3 style={{ color: '#fcd34d', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Storage writes</h3>
            <ul style={{ marginLeft: '1.25rem', marginBottom: '1rem' }}>
              <li><code>_owners[tokenId] = to</code> — records the new owner</li>
              <li><code>_balances[to]++</code> — increments the recipient&apos;s token count</li>
              <li><code>_nextTokenId++</code> — advances the counter for the next mint</li>
              <li><code>_tokenURIs[tokenId] = tokenURI_</code> — stores metadata URI</li>
            </ul>
            <h3 style={{ color: '#fcd34d', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Gas costs</h3>
            <p style={{ marginBottom: '1rem' }}>SSTORE to cold slot: ~20,000 gas each. Event emission: ~375 gas per topic + ~8 gas per byte of data. First mint to an address costs more (cold storage).</p>
            <h3 style={{ color: '#fcd34d', fontSize: '0.95rem', marginBottom: '0.5rem' }}>Event emission</h3>
            <p><code>Transfer(address(0), to, tokenId)</code> — indexed: from (zero for mint), to, tokenId. This is the standard ERC-721 Transfer event that block explorers and wallets use.</p>
          </div>
        )}

        {currentStep === 3 && step.code && (
          <CodeBlock code={step.code} onLoad={handleLoadCode} loadLabel={step.loadLabel} />
        )}

        {currentStep === 5 && step.code && (
          <CodeBlock code={step.code} onLoad={handleLoadCode} loadLabel={step.loadLabel} />
        )}

        {currentStep === 6 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              First deploy LabNFTSale: <code>npx hardhat run scripts/deploy-lab-nft-sale.js --network localhost</code>. Then:
            </p>
            <h3 style={{ color: '#fcd34d', fontSize: '0.95rem', marginBottom: '0.35rem' }}>Seller (you own the NFT)</h3>
            <CodeBlock
              code={`// Replace addresses! Seller: approve sale contract, then list
const nftAddr = "0x...";   // LabNFT contract address
const saleAddr = "0x...";  // LabNFTSale contract address
const tokenId = 1;
const price = ethers.parseEther("0.01");  // 0.01 ETH

const nft = await ethers.getContractAt("LabNFT", nftAddr);
const sale = await ethers.getContractAt("LabNFTSale", saleAddr);

await nft.approve(saleAddr, tokenId);
await sale.list(nftAddr, tokenId, price);
console.log("Listed! Share sale address and price with buyer.");`}
              onLoad={handleLoadCode}
              loadLabel="Load seller script"
            />
            <h3 style={{ color: '#fcd34d', fontSize: '0.95rem', marginTop: '1rem', marginBottom: '0.35rem' }}>Buyer (you pay ETH)</h3>
            <CodeBlock
              code={`// Replace sale address! Buyer: pay to buy
const saleAddr = "0x...";  // LabNFTSale contract address (seller shares this)
const price = ethers.parseEther("0.01");  // Must match seller's price

const sale = await ethers.getContractAt("LabNFTSale", saleAddr);
await sale.buy({ value: price });
console.log("Bought! Check ownerOf on the NFT contract.");`}
              onLoad={handleLoadCode}
              loadLabel="Load buyer script"
            />
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>EIP-721 metadata schema: name, description, image (required). Image can be a data URI.</p>
            <textarea
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                background: '#0c0c0c',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#86efac',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
              }}
              placeholder='{"name":"...","description":"...","image":"..."}'
            />
            {metadataError && <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: '0.35rem' }}>{metadataError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleGenerateDataUri} style={{ padding: '0.4rem 0.8rem', background: 'var(--primary)', border: 'none', borderRadius: '0.35rem', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                Generate Data URI
              </button>
              {dataUri && (
                <>
                  <button type="button" onClick={copyDataUri} style={{ padding: '0.4rem 0.8rem', background: '#334155', border: 'none', borderRadius: '0.35rem', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>
                    Copy Data URI
                  </button>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all', maxWidth: '100%' }}>
                    {dataUri.slice(0, 60)}...
                  </div>
                </>
              )}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.75rem' }}>
              Use the data URI as the second argument to <code>mint(to, tokenURI)</code> in Step 3.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button type="button" onClick={() => setCurrentStep((p) => Math.max(1, p - 1))} disabled={currentStep <= 1} style={{ padding: '0.5rem 1rem', background: currentStep <= 1 ? '#334155' : '#475569', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: currentStep <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          Previous
        </button>
        <button type="button" onClick={() => setCurrentStep((p) => Math.min(STEPS.length, p + 1))} disabled={currentStep >= STEPS.length} style={{ padding: '0.5rem 1rem', background: currentStep >= STEPS.length ? '#334155' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: currentStep >= STEPS.length ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          Next
        </button>
      </div>

      <ChainSearch provider={provider} rpcUrl={rpcUrl} />

      {loadFeedback && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '0.5rem', color: '#86efac', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {loadFeedback}
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }} data-lab-terminal>
        <button
          type="button"
          onClick={() => setTerminalOpen(!terminalOpen)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            background: '#1a1a2e',
            border: '1px solid #1e293b',
            borderRadius: terminalOpen ? '0.75rem 0.75rem 0 0' : '0.75rem',
            color: '#f8fafc',
            fontSize: '1.1rem',
            cursor: 'pointer',
          }}
        >
          <span>Lab Terminal</span>
          <span>{terminalOpen ? '▼' : '▶'}</span>
        </button>
        {terminalOpen && (
          <div style={{ border: '1px solid #1e293b', borderTop: 'none', borderRadius: '0 0 0.75rem 0.75rem', overflow: 'hidden' }}>
            <InlineTerminal loadCode={loadCode} onLoadCodeConsumed={() => setLoadCode('')} rpcUrl={rpcUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
