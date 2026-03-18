/**
 * ContractLab - Deploy, connect, and interact with contracts from the GUI.
 * Students can write Solidity, compile, deploy templates, and connect to classmate's contracts.
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { fetchAndLoadSolc } from 'web-solc';
import { ChainSearch } from './ChainSearch';
import { EXAMPLE_SCRIPTS } from '../constants/exampleScripts';
import SimpleStorageArtifact from '../contracts/SimpleStorage.json';
import CarSaleArtifact from '../contracts/CarSale.json';
import CarMarketplaceArtifact from '../contracts/CarMarketplace.json';
import ClassVoteArtifact from '../contracts/ClassVote.json';

function ExampleScriptCard({ script, onLoad }) {
  const [showCode, setShowCode] = useState(false);
  return (
    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
      <div style={{ fontSize: '0.95rem', color: '#c4b5fd', marginBottom: '0.25rem' }}>{script.name}</div>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>{script.description}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onLoad}
          style={{
            padding: '0.4rem 0.9rem',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '0.35rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          Load
        </button>
        <button
          onClick={() => setShowCode(!showCode)}
          style={{
            padding: '0.4rem 0.9rem',
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid #475569',
            borderRadius: '0.35rem',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          {showCode ? 'Hide code' : 'Show full code'}
        </button>
      </div>
      {showCode && (
        <pre style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          background: '#020617',
          borderRadius: '0.35rem',
          color: '#86efac',
          fontSize: '0.8rem',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          maxHeight: '200px',
          border: '1px solid #334155'
        }}>
          {script.code}
        </pre>
      )}
    </div>
  );
}

function DeployedHelp() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.35rem', padding: 0
        }}
      >
        {open ? '▼' : '▶'} How do I check my account balance?
      </button>
      {open && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: '#e2e8f0' }}>ETH balance:</strong> Your wallet balance appears in the card at the top right. Or use the Lab Terminal below—run <code style={{ background: '#1e293b', padding: '0.1rem 0.25rem', borderRadius: 3 }}>npm run console</code> and query the chain.</p>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: '#e2e8f0' }}>Token balance:</strong> If your contract has <code style={{ background: '#1e293b', padding: '0.1rem 0.25rem', borderRadius: 3 }}>balanceOf</code>, go to the <strong>Connect & Interact</strong> tab, paste your contract address, and call <code style={{ background: '#1e293b', padding: '0.1rem 0.25rem', borderRadius: 3 }}>balanceOf(yourAddress)</code>.</p>
        </div>
      )}
    </div>
  );
}

const DEFAULT_SOLIDITY = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    uint256 public value;
    
    function set(uint256 _value) external {
        value = _value;
    }
    
    function get() external view returns (uint256) {
        return value;
    }
}`;

const TEMPLATES = [
  { id: 'SimpleStorage', name: 'SimpleStorage', artifact: SimpleStorageArtifact, constructorArgs: [] },
  { id: 'CarSale', name: 'Car Sale', artifact: CarSaleArtifact, constructorArgs: [
    { name: 'seller', type: 'address', placeholder: '0x...' },
    { name: 'buyer', type: 'address', placeholder: '0x...' },
    { name: 'mechanic', type: 'address', placeholder: '0x...' }
  ]},
  { id: 'CarMarketplace', name: 'Car Marketplace', artifact: CarMarketplaceArtifact, constructorArgs: [] },
  { id: 'ClassVote', name: 'Class Vote (Voting)', artifact: ClassVoteArtifact, constructorArgs: [] }
];

function ContractLab({ provider, rpcUrl, wallet, onLoadScript, setStatusMsg }) {
  const [activeTab, setActiveTab] = useState('examples');
  const [solidityCode, setSolidityCode] = useState(DEFAULT_SOLIDITY);
  const [contractName, setContractName] = useState('MyContract');
  const [compileOutput, setCompileOutput] = useState('');
  const [compiling, setCompiling] = useState(false);
  const [deployTemplate, setDeployTemplate] = useState('SimpleStorage');
  const [deployArgs, setDeployArgs] = useState({});
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState('');
  const [connectAddress, setConnectAddress] = useState('');
  const [connectTemplate, setConnectTemplate] = useState('SimpleStorage');
  const [pastedAbiJson, setPastedAbiJson] = useState('');
  const [pastedAbi, setPastedAbi] = useState(null);
  const [connectMode, setConnectMode] = useState('read');
  const [callResult, setCallResult] = useState('');
  const [calling, setCalling] = useState(false);

  const loadExample = (script) => {
    onLoadScript?.(script.code);
    // Parent handles status when onLoadScript is provided (expands terminal, shows feedback)
    if (!onLoadScript) {
      setStatusMsg?.('✓ Script loaded. Expand Lab Terminal to run it.');
      setTimeout(() => setStatusMsg?.(''), 3000);
    }
  };

  const handleDeploy = async () => {
    if (!wallet?.signer) {
      setStatusMsg?.('❌ Connect wallet first');
      return;
    }
    let abi, bytecode;
    if (deployTemplate === '__custom__' && window.__lastCompiled) {
      abi = window.__lastCompiled.abi;
      bytecode = window.__lastCompiled.bytecode;
    } else {
      const t = TEMPLATES.find(x => x.id === deployTemplate);
      if (!t) return;
      abi = t.artifact.abi;
      bytecode = t.artifact.bytecode;
    }
    setDeploying(true);
    setStatusMsg?.('📤 Deploying...');
    try {
      const factory = new ethers.ContractFactory(abi, bytecode, wallet.signer);
      let instance;
      if (deployTemplate === 'CarSale') {
        const seller = deployArgs.seller || wallet.address;
        const buyer = deployArgs.buyer || ethers.ZeroAddress;
        const mechanic = deployArgs.mechanic || ethers.ZeroAddress;
        instance = await factory.deploy(seller, buyer, mechanic);
      } else if (deployTemplate === 'CarMarketplace') {
        instance = await factory.deploy();
      } else {
        instance = await factory.deploy();
      }
      await instance.waitForDeployment();
      setDeployedAddress(instance.target);
      setStatusMsg?.('✅ Deployed! Address: ' + instance.target);
      setTimeout(() => setStatusMsg?.(''), 4000);
    } catch (e) {
      setStatusMsg?.('❌ ' + (e.reason || e.message));
    } finally {
      setDeploying(false);
    }
  };

  const handleCall = async (fn, isView, args = []) => {
    if (!connectAddress || !ethers.isAddress(connectAddress)) {
      setCallResult('❌ Enter a valid contract address (0x...) above first.');
      return;
    }
    const t = TEMPLATES.find(x => x.id === connectTemplate);
    let abi;
    if (connectTemplate === '__pasted__' && pastedAbi) abi = pastedAbi;
    else if (connectTemplate === '__custom__' && window.__lastCompiled) abi = window.__lastCompiled.abi;
    else abi = t?.artifact?.abi;
    if (!abi) {
      setCallResult('❌ Select a contract type or compile one in Write tab first.');
      return;
    }
    const signer = isView ? provider : wallet?.signer;
    if (!signer) {
      setCallResult(isView ? '❌ Connect to blockchain (set RPC URL in config) to read.' : '❌ Connect wallet to send transactions.');
      return;
    }
    setCalling(true);
    setCallResult('⏳ Calling...');
    try {
      const c = new ethers.Contract(connectAddress, abi, signer);
      const result = await c[fn.name](...args);
      const formatted = Array.isArray(result)
        ? result.map(v => (typeof v === 'bigint' ? v.toString() : String(v))).join(', ')
        : (typeof result === 'bigint' ? result.toString() : String(result));
      setCallResult(formatted);
    } catch (e) {
      setCallResult('❌ ' + (e.reason || e.message || String(e)));
    } finally {
      setCalling(false);
    }
  };

  const getFunctions = (abi) => {
    return (abi || []).filter(x => x.type === 'function' && x.name !== '');
  };

  const boxStyle = {
    padding: '1rem',
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: '0.5rem',
    border: '1px solid #334155',
    marginBottom: '1rem'
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h3 style={{ marginBottom: '1rem', color: '#a78bfa' }}>🏗️ Contract Lab</h3>
      <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
        Deploy templates, connect to classmate's contracts, and run example scripts to verify your setup.
      </p>

      <ChainSearch provider={provider} rpcUrl={rpcUrl} />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['examples', 'write', 'deploy', 'connect'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab ? '#8b5cf6' : '#334155',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {tab === 'examples' ? 'Example Scripts' : tab === 'write' ? 'Write & Compile' : tab === 'deploy' ? 'Deploy' : 'Connect & Interact'}
          </button>
        ))}
      </div>

      {activeTab === 'examples' && (
        <div style={boxStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#e2e8f0' }}>Verification scripts</div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Click Load to paste the script into the Lab Terminal below. The terminal will expand automatically.
          </p>
          {EXAMPLE_SCRIPTS.map((s, i) => (
            <ExampleScriptCard key={i} script={s} onLoad={() => loadExample(s)} />
          ))}
        </div>
      )}

      {activeTab === 'write' && (
        <div style={boxStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#e2e8f0' }}>Write Solidity</div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Write your contract, compile, then deploy. Contract name must match the contract in code.
          </p>
          <input
            placeholder="Contract name (e.g. MyContract)"
            value={contractName}
            onChange={e => setContractName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.35rem', color: '#e2e8f0' }}
          />
          <textarea
            value={solidityCode}
            onChange={e => setSolidityCode(e.target.value)}
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '0.75rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.35rem',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }}
            spellCheck={false}
          />
          <button
            onClick={async () => {
              setCompiling(true);
              setCompileOutput('⏳ Loading compiler...');
              let solcInstance = null;
              try {
                solcInstance = await fetchAndLoadSolc('^0.8.19');
                setCompileOutput('⏳ Compiling...');
                const input = {
                  language: 'Solidity',
                  sources: { 'contract.sol': { content: solidityCode } },
                  settings: {
                    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
                  }
                };
                const output = await solcInstance.compile(input);
                if (output.errors) {
                  const errs = output.errors.filter(e => e.severity === 'error');
                  if (errs.length) {
                    setCompileOutput('Compile errors:\n' + errs.map(e => e.formattedMessage || e.message).join('\n'));
                    return;
                  }
                }
                const contract = output.contracts?.['contract.sol']?.[contractName];
                if (!contract) {
                  setCompileOutput('Contract "' + contractName + '" not found. Check the name matches your contract.');
                  return;
                }
                const abi = contract.abi;
                const bytecode = '0x' + contract.evm.bytecode.object;
                setCompileOutput('✓ Compiled! Go to Deploy tab → select "My compiled contract" → Deploy.');
                setDeployTemplate('__custom__');
                setActiveTab('deploy');
                window.__lastCompiled = { abi, bytecode };
              } catch (e) {
                setCompileOutput('❌ ' + (e.message || String(e)));
              } finally {
                if (solcInstance) solcInstance.stopWorker();
                setCompiling(false);
              }
            }}
            disabled={compiling}
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1rem',
              background: compiling ? '#475569' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: compiling ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {compiling ? '⏳ Compiling...' : 'Compile'}
          </button>
          {compileOutput && (
            <pre style={{ marginTop: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.35rem', color: '#94a3b8', fontSize: '0.85rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {compileOutput}
            </pre>
          )}
        </div>
      )}

      {activeTab === 'deploy' && (
        <div style={boxStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#e2e8f0' }}>Deploy a template</div>
          <select
            value={deployTemplate}
            onChange={e => setDeployTemplate(e.target.value)}
            style={{ padding: '0.5rem', marginBottom: '0.75rem', background: '#1e293b', border: '1px solid #475569', borderRadius: '0.35rem', color: '#e2e8f0' }}
          >
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__custom__">My compiled contract (from Write tab)</option>
          </select>
          {deployTemplate === 'CarSale' && (
            <div style={{ marginBottom: '0.75rem' }}>
              {TEMPLATES.find(t => t.id === 'CarSale').constructorArgs.map(arg => (
                <div key={arg.name} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{arg.name}</label>
                  <input
                    placeholder={arg.placeholder}
                    value={deployArgs[arg.name] || ''}
                    onChange={e => setDeployArgs(prev => ({ ...prev, [arg.name]: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.35rem', color: '#e2e8f0', fontFamily: 'monospace' }}
                  />
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleDeploy}
            disabled={deploying || !wallet?.signer}
            style={{
              padding: '0.5rem 1rem',
              background: (deploying || !wallet?.signer) ? '#475569' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: (deploying || !wallet?.signer) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {deploying ? '⏳ Deploying...' : 'Deploy'}
          </button>
          {deployedAddress && (
            <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#0f172a', borderRadius: '0.35rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#34d399' }}>✓ Deployed: {deployedAddress}</div>
              <button
                onClick={() => navigator.clipboard.writeText(deployedAddress)}
                style={{ marginTop: '0.35rem', padding: '0.25rem 0.5rem', background: '#475569', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Copy address
              </button>
              <DeployedHelp />
            </div>
          )}
        </div>
      )}

      {activeTab === 'connect' && (
        <div style={boxStyle}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#e2e8f0' }}>Connect to a contract</div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
            1. Enter contract address below. 2. Select contract type. 3. Use Read or Write to interact.
          </p>

          {!provider && (
            <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(251, 191, 36, 0.15)', borderRadius: '0.5rem', border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fde047', fontSize: '0.9rem' }}>
              ⚠️ Connect to blockchain first: Set RPC URL in the config panel (top right) and connect to your node.
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Contract address</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                placeholder="0x..."
                value={connectAddress}
                onChange={e => setConnectAddress(e.target.value)}
                style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.35rem', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              {deployedAddress && (
                <button
                  onClick={() => setConnectAddress(deployedAddress)}
                  style={{ padding: '0.5rem 0.75rem', background: '#334155', color: '#94a3b8', border: '1px solid #475569', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  Use deployed
                </button>
              )}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Contract type</label>
            <select
              value={connectTemplate}
              onChange={e => { setConnectTemplate(e.target.value); if (e.target.value !== '__pasted__') setPastedAbi(null); }}
              style={{ width: '100%', padding: '0.6rem', background: '#1e293b', border: '1px solid #475569', borderRadius: '0.35rem', color: '#e2e8f0', fontSize: '0.9rem' }}
            >
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="__custom__">My contract (use last compiled ABI)</option>
              <option value="__pasted__">Paste ABI (any contract)</option>
            </select>
            {connectTemplate === '__pasted__' && (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Paste contract ABI (JSON array from artifacts/*.json)</label>
                <textarea
                  placeholder='[{"inputs":[],"name":"get","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},...]'
                  value={pastedAbiJson}
                  onChange={e => setPastedAbiJson(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '0.6rem',
                    background: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '0.35rem',
                    color: '#e2e8f0',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  onClick={() => {
                    try {
                      const parsed = typeof pastedAbiJson === 'string' ? JSON.parse(pastedAbiJson) : pastedAbiJson;
                      const arr = Array.isArray(parsed) ? parsed : (parsed?.abi || parsed?.ABI);
                      if (!Array.isArray(arr) || arr.length === 0) throw new Error('ABI must be a non-empty array');
                      setPastedAbi(arr);
                      setStatusMsg?.('✓ ABI applied. All functions detected.');
                      setTimeout(() => setStatusMsg?.(''), 3000);
                    } catch (e) {
                      setStatusMsg?.('❌ Invalid ABI: ' + (e.message || 'parse error'));
                      setPastedAbi(null);
                    }
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.4rem 1rem',
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.35rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}
                >
                  Apply ABI
                </button>
                {pastedAbi && (
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#34d399' }}>
                    ✓ {pastedAbi.filter(x => x.type === 'function').length} functions
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Result area - always visible, prominent */}
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155', minHeight: '60px' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Result</div>
            <pre style={{ margin: 0, color: callResult?.startsWith('❌') ? '#fca5a5' : '#86efac', fontSize: '0.9rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {callResult || '—'}
            </pre>
          </div>

          {/* Etherscan-style: Read Contract | Write Contract */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setConnectMode('read')}
              style={{
                padding: '0.5rem 1rem',
                background: connectMode === 'read' ? '#3b82f6' : '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '0.35rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: connectMode === 'read' ? 'bold' : 'normal'
              }}
            >
              Read Contract
            </button>
            <button
              onClick={() => setConnectMode('write')}
              style={{
                padding: '0.5rem 1rem',
                background: connectMode === 'write' ? '#f59e0b' : '#334155',
                color: 'white',
                border: 'none',
                borderRadius: '0.35rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: connectMode === 'write' ? 'bold' : 'normal'
              }}
            >
              Write Contract
            </button>
          </div>

          {connectMode === 'read' && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>View functions (no gas, no wallet needed)</div>
              {(getFunctions(
                connectTemplate === '__pasted__' ? pastedAbi :
                connectTemplate === '__custom__' && window.__lastCompiled ? window.__lastCompiled.abi :
                TEMPLATES.find(t => t.id === connectTemplate)?.artifact?.abi
              ) || []).filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure').map(fn => {
                const inputs = fn.inputs || [];
                return (
                  <div key={fn.name} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.35rem', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '0.9rem', color: '#93c5fd', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                      {fn.name}({inputs.map(i => i.name).join(', ')}) → {fn.outputs?.map(o => o.type || o.internalType).join(', ') || '?'}
                    </div>
                    {inputs.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {inputs.map((inp, i) => (
                          <input
                            key={i}
                            placeholder={inp.name + (inp.type ? ` (${inp.type})` : '')}
                            id={`read-${fn.name}-${inp.name}`}
                            style={{ width: '100%', padding: '0.4rem 0.5rem', marginBottom: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.25rem', color: '#e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace' }}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const args = inputs.map((inp) => {
                          const el = document.getElementById(`read-${fn.name}-${inp.name}`);
                          const v = el?.value?.trim();
                          if (inp.type === 'address') return v || ethers.ZeroAddress;
                          if (inp.type?.includes('uint')) return v ? BigInt(v) : 0n;
                          if (inp.type === 'bool') return v === 'true' || v === '1';
                          return v || '';
                        });
                        await handleCall(fn, true, args);
                      }}
                      disabled={calling}
                      style={{
                        padding: '0.4rem 1rem',
                        background: calling ? '#475569' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.35rem',
                        cursor: calling ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {calling ? 'Querying...' : 'Query'}
                    </button>
                  </div>
                );
              })}
              {(!getFunctions(connectTemplate === '__pasted__' ? pastedAbi : connectTemplate === '__custom__' && window.__lastCompiled ? window.__lastCompiled.abi : TEMPLATES.find(t => t.id === connectTemplate)?.artifact?.abi) || []).filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure').length === 0 && (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No read functions in this contract.</div>
              )}
            </div>
          )}

          {connectMode === 'write' && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>Write functions (require wallet, cost gas)</div>
              {(getFunctions(
                connectTemplate === '__pasted__' ? pastedAbi :
                connectTemplate === '__custom__' && window.__lastCompiled ? window.__lastCompiled.abi :
                TEMPLATES.find(t => t.id === connectTemplate)?.artifact?.abi
              ) || []).filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure').map(fn => {
                const inputs = fn.inputs || [];
                return (
                  <div key={fn.name} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '0.35rem', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                      {fn.name}({inputs.map(i => i.name).join(', ')})
                    </div>
                    {inputs.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {inputs.map((inp, i) => (
                          <input
                            key={i}
                            placeholder={inp.name + (inp.type ? ` (${inp.type})` : '')}
                            id={`write-${fn.name}-${inp.name}`}
                            style={{ width: '100%', padding: '0.4rem 0.5rem', marginBottom: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.25rem', color: '#e2e8f0', fontSize: '0.85rem', fontFamily: 'monospace' }}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const args = inputs.map((inp) => {
                          const el = document.getElementById(`write-${fn.name}-${inp.name}`);
                          const v = el?.value?.trim();
                          if (inp.type === 'address') return v || ethers.ZeroAddress;
                          if (inp.type?.includes('uint')) return v ? BigInt(v) : 0n;
                          if (inp.type === 'bool') return v === 'true' || v === '1';
                          return v || '';
                        });
                        await handleCall(fn, false, args);
                      }}
                      disabled={calling || !wallet?.signer}
                      style={{
                        padding: '0.4rem 1rem',
                        background: (calling || !wallet?.signer) ? '#475569' : '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.35rem',
                        cursor: (calling || !wallet?.signer) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {calling ? 'Sending...' : 'Write'}
                    </button>
                  </div>
                );
              })}
              {(!getFunctions(connectTemplate === '__pasted__' ? pastedAbi : connectTemplate === '__custom__' && window.__lastCompiled ? window.__lastCompiled.abi : TEMPLATES.find(t => t.id === connectTemplate)?.artifact?.abi) || []).filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure').length === 0 && (
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No write functions in this contract.</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>
        <strong>Any contract:</strong> Select <strong>Paste ABI</strong> and paste the ABI array from <code>artifacts/.../Contract.json</code> to detect and call all functions. Or compile in the Write tab, then use &quot;My contract&quot;.
      </div>
    </div>
  );
}

export default ContractLab;
