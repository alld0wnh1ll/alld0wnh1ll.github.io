import { useState, useRef, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const MAX_HISTORY = 200;
const MAX_CMD_HISTORY = 50;

export function BlockchainConsole({ provider, wallet, posAddress, PoSABI, bank, carLot, selectedAddress, loadCode, onLoadCodeConsumed }) {
  const [lines, setLines] = useState([
    { type: 'system', text: '🖥️ Blockchain Console — ethers.js REPL' },
    { type: 'system', text: 'Type JavaScript to interact with the blockchain. Try: help' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [multiBuffer, setMultiBuffer] = useState('');
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // When parent loads a script (e.g. from Contract Lab), inject into input
  useEffect(() => {
    if (loadCode && loadCode.trim()) {
      setInput(loadCode.trim());
      onLoadCodeConsumed?.();
    }
  }, [loadCode, onLoadCodeConsumed]);

  const addLine = useCallback((type, text) => {
    setLines(prev => {
      const next = [...prev, { type, text }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, []);

  const addLines = useCallback((entries) => {
    setLines(prev => {
      const next = [...prev, ...entries];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, []);

  const helpText = `
Available variables:
  provider     — ethers JsonRpcProvider (read blockchain)
  ethers       — ethers.js library
  wallet       — { address, signer, balance } your wallet
  posAddress   — PoS contract address
  PoSABI       — PoS contract ABI
  pos          — PoS contract instance (read-only)
  posSigner    — PoS contract instance (with your signer)

Helper functions:
  balance(addr)           — Get ETH balance
  deploy(name)            — Deploy a role contract (e.g. deploy("CarSellerRole"))
  deployWith(name, args)  — Deploy with constructor args (e.g. deployWith("CarBuyerRole", ["0x..."]))
  connect(addr, abi)      — Get contract instance with signer
  events(contract, name)  — Get all events by name
  tx(hash)                — Get transaction details
  receipt(hash)           — Get transaction receipt
  clear                   — Clear the console

Shortcuts:
  Ctrl+Enter or Run       — Execute code
  .multi                  — Toggle multiline mode (paste blocks of code)
  .run                    — Execute multiline buffer
  Ctrl+Up/Down            — Command history

Examples:
  await pos.totalStaked()
  ethers.formatEther(await balance(wallet.address))
  await posSigner.sendMessage("hello!")
  const cs = connect("0x...", CarSaleABI)
  await deploy("CarSellerRole")
`.trim();

  // Prepare code for execution: add semicolons so multi-statement one-liners work
  const prepareCode = useCallback((code) => {
    let c = code.trim();
    // Add semicolon before 'await' when it starts a new statement (fixes "Unexpected reserved word")
    c = c.replace(/([\)\]\}])\s*await\b/g, '$1; await');
    // Add semicolon before 'return'/'throw'/'const'/'let'/'var' when preceded by ) or }
    c = c.replace(/([\)\]\}])\s*(return|throw|const|let|var)\b/g, '$1; $2');
    // If multiple statements and last is an await expression, add return so result is shown
    const parts = c.split(';').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (last.startsWith('await ')) {
        parts[parts.length - 1] = 'return ' + last;
        c = parts.join('; ');
      }
    }
    return c;
  }, []);

  const runCode = useCallback(async (code) => {
    const prepared = prepareCode(code);
    setRunning(true);
    const captured = [];
    const fakeConsole = {
      log: (...args) => captured.push({ type: 'output', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      error: (...args) => captured.push({ type: 'error', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      warn: (...args) => captured.push({ type: 'warn', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      info: (...args) => captured.push({ type: 'output', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
    };

    try {
      const pos = posAddress && PoSABI ? new ethers.Contract(posAddress, PoSABI, provider) : null;
      const posSigner = posAddress && PoSABI && wallet?.signer ? new ethers.Contract(posAddress, PoSABI, wallet.signer) : null;

      const balance = async (addr) => ethers.formatEther(await provider.getBalance(addr)) + ' ETH';

      const deploy = async (name) => {
        const res = await fetch(`/artifacts/${name}.json`);
        if (!res.ok) throw new Error(`Artifact not found: ${name}. Available: CarSellerRole, CarBuyerRole, MechanicRole, EscrowAgentRole, VictimRole, AttackerRole, InvestigatorRole`);
        const artifact = await res.json();
        const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet.signer);
        fakeConsole.log('Deploying ' + name + '...');
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        fakeConsole.log('✅ Deployed to: ' + addr);
        return contract;
      };

      const deployWith = async (name, args) => {
        const res = await fetch(`/artifacts/${name}.json`);
        if (!res.ok) throw new Error(`Artifact not found: ${name}`);
        const artifact = await res.json();
        const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet.signer);
        fakeConsole.log('Deploying ' + name + ' with args: ' + JSON.stringify(args) + '...');
        const contract = await factory.deploy(...(args || []));
        await contract.waitForDeployment();
        const addr = await contract.getAddress();
        fakeConsole.log('✅ Deployed to: ' + addr);
        return contract;
      };

      const connect = (addr, abi) => {
        const a = String(addr).trim();
        const placeholders = ['CARSALE_ADDR', 'RANSOM_ADDR', 'VICTIM_ADDR', 'YOUR_', '0x...'];
        if (!a.startsWith('0x') || a.length !== 42 || placeholders.some(p => a.toUpperCase().includes(p))) {
          throw new Error('Replace the placeholder with the actual contract address (0x + 40 hex chars). Get it from the instructor.');
        }
        return new ethers.Contract(a, abi, wallet.signer);
      };
      const events = async (contract, name) => {
        const filter = contract.filters[name]?.();
        if (!filter) throw new Error('Event not found: ' + name);
        return await contract.queryFilter(filter, 0);
      };
      const tx = async (hash) => await provider.getTransaction(hash);
      const receipt = async (hash) => await provider.getTransactionReceipt(hash);

      // Fetch CarSale ABI for convenience
      let CarSaleABI = [];
      try {
        const csRes = await fetch('/artifacts/CarSale.json');
        if (csRes.ok) { CarSaleABI = (await csRes.json()).abi; }
      } catch {}

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(
        'provider', 'ethers', 'wallet', 'posAddress', 'PoSABI',
        'pos', 'posSigner', 'console',
        'balance', 'deploy', 'deployWith', 'connect', 'events', 'tx', 'receipt',
        'CarSaleABI',
        'bank', 'carLot', 'selectedAddress',
        prepared
      );
      const result = await fn(
        provider, ethers, wallet, posAddress, PoSABI,
        pos, posSigner, fakeConsole,
        balance, deploy, deployWith, connect, events, tx, receipt,
        CarSaleABI,
        bank || null, carLot || null, selectedAddress || null
      );

      if (captured.length > 0) {
        addLines(captured);
      }
      if (result !== undefined) {
        let display;
        if (typeof result === 'bigint') {
          display = result.toString() + 'n';
        } else if (typeof result === 'object' && result !== null) {
          if (result.target || result.runner) {
            display = `Contract { address: "${result.target || await result.getAddress()}" }`;
          } else {
            try { display = JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2); }
            catch { display = String(result); }
          }
        } else {
          display = String(result);
        }
        addLine('result', display);
      } else if (captured.length === 0) {
        addLine('result', '✓');
      }
    } catch (e) {
      if (captured.length > 0) addLines(captured);
      const msg = e.reason || e.shortMessage || e.message || String(e);
      addLine('error', '❌ ' + msg);
    } finally {
      setRunning(false);
    }
  }, [provider, wallet, posAddress, PoSABI, bank, carLot, selectedAddress, addLine, addLines, prepareCode]);

  const execute = useCallback(async (code) => {
    if (!code.trim()) return;
    if (code.trim() === 'help') {
      addLines(helpText.split('\n').map(t => ({ type: 'system', text: t })));
      return;
    }
    if (code.trim() === 'clear') {
      setLines([{ type: 'system', text: '🖥️ Console cleared.' }]);
      return;
    }
    if (code.trim() === '.multi') {
      setMultiline(m => !m);
      setMultiBuffer('');
      addLine('system', multiline ? 'Multiline mode OFF' : 'Multiline mode ON — type code, then .run to execute');
      return;
    }
    if (code.trim() === '.run' && multiline) {
      if (!multiBuffer.trim()) { addLine('system', 'Nothing to run.'); return; }
      addLine('input', multiBuffer.split('\n').map(l => '  ' + l).join('\n'));
      const toRun = multiBuffer;
      setMultiBuffer('');
      await runCode(toRun);
      return;
    }
    if (multiline) {
      setMultiBuffer(prev => prev + (prev ? '\n' : '') + code);
      return;
    }
    await runCode(code);
  }, [multiline, multiBuffer, addLine, addLines, runCode]);

  const handleKeyDown = useCallback((e) => {
    // Ctrl+Enter runs code (textarea: Enter adds newline)
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      const code = input.trim();
      if (!code) return;
      if (!multiline) {
        addLine('input', code.split('\n').map(l => '> ' + l).join('\n'));
      } else {
        addLine('multi', '... ' + code);
      }
      setCmdHistory(prev => {
        const next = [code, ...prev.filter(c => c !== code)];
        return next.slice(0, MAX_CMD_HISTORY);
      });
      setHistoryIdx(-1);
      setInput('');
      execute(code);
    } else if (e.key === 'Enter' && !e.shiftKey && !multiline && !input.includes('\n')) {
      // Single-line only: Enter runs (backward compat for quick one-liners)
      e.preventDefault();
      const code = input.trim();
      if (!code) return;
      addLine('input', '> ' + code);
      setCmdHistory(prev => {
        const next = [code, ...prev.filter(c => c !== code)];
        return next.slice(0, MAX_CMD_HISTORY);
      });
      setHistoryIdx(-1);
      setInput('');
      execute(code);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.ctrlKey) {
      // Ctrl+Up/Down: command history (Arrow keys alone move cursor in textarea)
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        setCmdHistory(prev => {
          const nextIdx = Math.min(historyIdx + 1, prev.length - 1);
          if (nextIdx >= 0 && prev[nextIdx]) {
            setHistoryIdx(nextIdx);
            setInput(prev[nextIdx]);
          }
          return prev;
        });
      } else {
        if (historyIdx <= 0) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          const nextIdx = historyIdx - 1;
          setHistoryIdx(nextIdx);
          setCmdHistory(prev => {
            if (prev[nextIdx]) setInput(prev[nextIdx]);
            return prev;
          });
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'system', text: '🖥️ Console cleared.' }]);
    }
  }, [input, historyIdx, execute, multiline, addLine]);

  const lineColor = (type) => {
    switch (type) {
      case 'input': return '#60a5fa';
      case 'multi': return '#818cf8';
      case 'result': return '#4ade80';
      case 'error': return '#f87171';
      case 'warn': return '#fbbf24';
      case 'output': return '#e2e8f0';
      case 'system': return '#94a3b8';
      default: return '#cbd5e1';
    }
  };

  return (
    <div style={{
      background: '#0c0c0c',
      borderRadius: '0.75rem',
      border: '1px solid #1e293b',
      overflow: 'hidden',
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
      fontSize: '0.85rem',
    }}>
      {/* Title bar */}
      <div style={{
        background: '#1a1a2e',
        padding: '0.4rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid #1e293b',
      }}>
        <span style={{ color: '#f87171', fontSize: '0.7rem' }}>●</span>
        <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>●</span>
        <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>●</span>
        <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
          Blockchain Console
        </span>
        <span style={{ color: '#475569', fontSize: '0.7rem', marginLeft: 'auto' }}>
          {wallet?.address ? wallet.address.slice(0, 8) + '...' : 'not connected'}
        </span>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        onClick={() => inputRef.current?.focus()}
        style={{
          height: '320px',
          overflowY: 'auto',
          padding: '0.5rem 0.75rem',
          cursor: 'text',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{
            color: lineColor(line.type),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.5,
            padding: '1px 0',
          }}>
            {line.text}
          </div>
        ))}
        {running && (
          <div style={{ color: '#94a3b8', animation: 'pulse 1.5s infinite' }}>
            ⏳ Running...
          </div>
        )}
      </div>

      {/* Input area - textarea so multiline scripts (e.g. Load example script) are visible */}
      <div style={{
        borderTop: '1px solid #1e293b',
        background: '#0f0f1a',
        padding: '0.4rem 0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span style={{ color: multiline ? '#818cf8' : '#60a5fa', marginTop: '0.5rem', userSelect: 'none', flexShrink: 0 }}>
            {multiline ? '...' : '>'}
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder={running ? 'running...' : multiline ? 'multiline — type .run to execute' : 'type command or load script...'}
            autoComplete="off"
            spellCheck={false}
            rows={4}
            style={{
              flex: 1,
              minHeight: '80px',
              maxHeight: '200px',
              resize: 'vertical',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              caretColor: '#60a5fa',
              lineHeight: 1.5,
              padding: '0.25rem 0',
            }}
          />
          <button
            onClick={async () => {
              const code = input.trim();
              if (!code || running) return;
              if (code === 'help') {
                addLines(helpText.split('\n').map(t => ({ type: 'system', text: t })));
                return;
              }
              if (code === 'clear') {
                setLines([{ type: 'system', text: '🖥️ Console cleared.' }]);
                return;
              }
              addLine('input', code.split('\n').map(l => '> ' + l).join('\n'));
              setCmdHistory(prev => {
                const next = [code, ...prev.filter(c => c !== code)];
                return next.slice(0, MAX_CMD_HISTORY);
              });
              setHistoryIdx(-1);
              setInput('');
              await execute(code);
            }}
            disabled={running || !input.trim()}
            style={{
              padding: '0.35rem 0.75rem',
              background: input.trim() && !running ? '#3b82f6' : '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: input.trim() && !running ? 'pointer' : 'not-allowed',
              fontSize: '0.8rem',
              fontWeight: '600',
              flexShrink: 0,
            }}
          >
            Run
          </button>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.25rem' }}>
          Ctrl+Enter to run • Enter adds newline
        </div>
      </div>
    </div>
  );
}
