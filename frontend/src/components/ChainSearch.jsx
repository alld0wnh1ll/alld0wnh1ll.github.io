/**
 * ChainSearch - Look up contracts, blocks, and transactions on the chain
 * Reusable across Live, Beacon Chain Lab, Contract Lab, etc.
 * Students can search by contract address, block hash, or transaction hash.
 */
import { useState, useEffect, useCallback } from 'react';

// ERC-721 Transfer event: Transfer(address,address,uint256)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function ChainSearch({ provider, rpcUrl, onCopy, compact = false }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blockNumber, setBlockNumber] = useState(null);

  useEffect(() => {
    if (!provider) return;
    provider.getBlockNumber().then(setBlockNumber).catch(() => setBlockNumber(null));
    const iv = setInterval(() => provider.getBlockNumber().then(setBlockNumber).catch(() => {}), 5000);
    return () => clearInterval(iv);
  }, [provider]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || !provider) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const normalized = q.startsWith('0x') ? q.toLowerCase() : '0x' + q.toLowerCase();
      const is64Hex = /^0x[a-f0-9]{64}$/.test(normalized);
      const isAddress = /^0x[a-f0-9]{40}$/.test(normalized);

      if (is64Hex) {
        const blockByHash = await provider.getBlock(normalized, true);
        if (blockByHash) {
          const txs = blockByHash.prefetchedTransactions ?? blockByHash.transactions ?? [];
          const transactions = txs.map((tx) => ({
            hash: typeof tx === 'string' ? tx : tx.hash,
            from: typeof tx === 'object' ? tx.from : null,
            to: typeof tx === 'object' ? tx.to : null,
            value: typeof tx === 'object' ? tx.value : null,
          }));
          setResult({
            type: 'block',
            blockNumber: Number(blockByHash.number),
            blockHash: blockByHash.hash,
            timestamp: blockByHash.timestamp,
            txCount: transactions.length,
            parentHash: blockByHash.parentHash,
            transactions,
          });
          return;
        }
        const tx = await provider.getTransaction(normalized);
        if (!tx) {
          setError('Block or transaction not found');
          return;
        }
        const receipt = await provider.getTransactionReceipt(normalized);
        const block = receipt ? await provider.getBlock(receipt.blockNumber) : null;
        setResult({
          type: 'tx',
          blockNumber: receipt?.blockNumber,
          blockHash: block?.hash,
          txHash: normalized,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          contractAddress: receipt?.contractAddress,
          logs: receipt?.logs ?? [],
        });
        return;
      }

      if (isAddress) {
        const code = await provider.getCode(normalized);
        if (!code || code === '0x' || code === '0x0') {
          setError('Address has no code (not a contract or not deployed)');
          return;
        }
        const currentBlock = await provider.getBlockNumber();
        const currentBlockNum = Number(currentBlock);
        const maxBlocks = 500;
        const startBlock = Math.max(0, currentBlockNum - maxBlocks + 1);
        let deploymentBlock = null;
        let deploymentTxHash = null;
        let deploymentFrom = null;
        let deploymentBlockHash = null;

        const getBlockTxs = (block) => block?.prefetchedTransactions ?? block?.transactions ?? [];

        for (let b = currentBlockNum; b >= startBlock; b--) {
          const block = await provider.getBlock(b, true);
          const txs = getBlockTxs(block);
          if (!txs.length) continue;
          for (const tx of txs) {
            if (!tx) continue;
            const txHash = typeof tx === 'string' ? tx : tx.hash;
            if (!txHash) continue;
            try {
              const receipt = await provider.getTransactionReceipt(txHash);
              const created = receipt?.contractAddress;
              if (created && String(created).toLowerCase() === normalized) {
                const txObj = typeof tx === 'object' ? tx : null;
                deploymentBlock = Number(block.number);
                deploymentTxHash = txHash;
                deploymentFrom = txObj?.from ?? receipt?.from;
                deploymentBlockHash = block.hash;
                break;
              }
            } catch (_) {}
          }
          if (deploymentBlock != null) break;
        }

        if (deploymentBlock == null) {
          setError('Contract deployment transaction not found (searched last ' + (currentBlockNum - startBlock + 1) + ' blocks)');
          return;
        }

        const seenBlocks = new Set([deploymentBlock]);
        const allBlocks = [
          { blockNumber: deploymentBlock, blockHash: deploymentBlockHash, txHash: deploymentTxHash, from: deploymentFrom, isDeployment: true },
        ];

        const scanEndBlock = Math.min(currentBlockNum, deploymentBlock + 2000);
        for (let b = deploymentBlock; b <= scanEndBlock; b++) {
          if (seenBlocks.has(b)) continue;
          const block = await provider.getBlock(b, true);
          const scanTxs = getBlockTxs(block);
          if (!scanTxs.length) continue;
          for (const tx of scanTxs) {
            if (!tx) continue;
            const txObj = typeof tx === 'object' ? tx : null;
            const to = txObj?.to;
            if (to && String(to).toLowerCase() === normalized) {
              const txHash = typeof tx === 'string' ? tx : tx.hash;
              seenBlocks.add(b);
              allBlocks.push({
                blockNumber: Number(block.number),
                blockHash: block.hash,
                txHash,
                from: txObj?.from ?? null,
                isDeployment: false,
              });
              break;
            }
          }
        }

        allBlocks.sort((a, b) => a.blockNumber - b.blockNumber);

        setResult({
          type: 'contract',
          blockNumber: deploymentBlock,
          blockHash: deploymentBlockHash,
          txHash: deploymentTxHash,
          from: deploymentFrom,
          contractAddress: normalized,
          allBlocks,
        });
        return;
      }

      setError('Enter a valid address (0x + 40 hex), block hash, or transaction hash (0x + 64 hex)');
    } catch (e) {
      setError(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, provider]);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).then(() => onCopy?.('Copied!'));
  };

  if (compact) {
    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="0x... (address, block hash, or tx hash)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            style={{
              flex: '1 1 200px',
              minWidth: '160px',
              padding: '0.4rem 0.6rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.35rem',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          />
          <button
            type="button"
            onClick={search}
            disabled={loading || !provider}
            style={{
              padding: '0.4rem 0.75rem',
              background: loading ? '#334155' : 'var(--primary)',
              border: 'none',
              borderRadius: '0.35rem',
              color: '#fff',
              fontWeight: 600,
              cursor: loading || !provider ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{error}</div>}
        {result && (
          <div style={{ padding: '0.6rem', background: 'rgba(34,197,94,0.1)', borderRadius: '0.35rem', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 600, color: '#86efac', marginBottom: '0.35rem' }}>
              {result.type === 'block' ? 'Block found' : result.type === 'contract' ? 'Contract found' : 'Transaction found'}
            </div>
            {result.type === 'block' ? (
              <>
                <div style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                  Block #{result.blockNumber} · {result.txCount} tx{result.txCount !== 1 ? 's' : ''}
                </div>
                {result.transactions?.length > 0 && (
                  <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.7rem', marginTop: '0.35rem' }}>
                    {result.transactions.map((tx, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.2rem' }}>
                        <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{String(tx.hash).slice(0, 14)}...</span>
                        <button type="button" onClick={() => copyToClipboard(tx.hash)} style={{ padding: '0.05rem 0.2rem', background: '#334155', border: 'none', borderRadius: '0.2rem', color: '#94a3b8', fontSize: '0.65rem', cursor: 'pointer' }}>Copy</button>
                      </div>
                    ))}
                  </div>
                )}
                {result.blockHash && (
                  <button type="button" onClick={() => copyToClipboard(result.blockHash)} style={{ marginTop: '0.35rem', padding: '0.15rem 0.35rem', background: '#334155', border: 'none', borderRadius: '0.25rem', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}>
                    Copy block hash
                  </button>
                )}
              </>
            ) : result.type === 'contract' && result.allBlocks?.length > 0 ? (
              <>
                <div style={{ fontFamily: 'monospace', color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  Found in {result.allBlocks.length} block{result.allBlocks.length !== 1 ? 's' : ''}
                </div>
                <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {result.allBlocks.map((blk, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: '#e2e8f0' }}>#{blk.blockNumber}</span>
                      {blk.isDeployment && <span style={{ background: '#334155', padding: '0.05rem 0.25rem', borderRadius: '0.2rem', fontSize: '0.65rem', color: '#94a3b8' }}>deployment</span>}
                      {blk.blockHash && (
                        <button type="button" onClick={() => copyToClipboard(blk.blockHash)} style={{ padding: '0.05rem 0.2rem', background: '#334155', border: 'none', borderRadius: '0.2rem', color: '#94a3b8', fontSize: '0.65rem', cursor: 'pointer' }}>
                          Copy hash
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                  Block #{result.blockNumber} · {result.blockHash ? `${String(result.blockHash).slice(0, 18)}...` : '—'}
                </div>
                {result.blockHash && (
                  <button type="button" onClick={() => copyToClipboard(result.blockHash)} style={{ marginTop: '0.35rem', padding: '0.15rem 0.35rem', background: '#334155', border: 'none', borderRadius: '0.25rem', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}>
                    Copy block hash
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <details style={{ marginBottom: compact ? 0 : '1rem', background: 'var(--card)', borderRadius: '0.75rem', border: '1px solid #475569' }}>
      <summary style={{ padding: '1rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
        🔍 Search Chain — Look up contracts & transactions
      </summary>
      <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.35rem' }}>
          <strong style={{ color: '#94a3b8' }}>Connected to:</strong> {rpcUrl || '—'} · Block #{blockNumber ?? '…'}
          <div style={{ marginTop: '0.35rem', color: '#f59e0b' }}>
            Hardhat console must use the <strong>same RPC</strong>. Local: <code style={{ background: '#334155', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>npx hardhat console --network localhost</code>. Remote: <code style={{ background: '#334155', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>RPC_URL=&quot;{rpcUrl || 'http://INSTRUCTOR_IP:8545'}&quot; npx hardhat console --network instructor</code>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          Search by contract address, block hash, or transaction hash.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="0x... (address, block hash, or tx hash)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            style={{
              flex: '1 1 280px',
              minWidth: '200px',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="button"
            onClick={search}
            disabled={loading || !provider}
            style={{
              padding: '0.5rem 1rem',
              background: loading ? '#334155' : 'var(--primary)',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
              fontWeight: 600,
              cursor: loading || !provider ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && (
          <div style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.2)', borderRadius: '0.35rem', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {error}
          </div>
        )}
        {result && (
          <div style={{ padding: '1rem', background: 'rgba(34,197,94,0.1)', borderRadius: '0.5rem', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.9rem' }}>
            <div style={{ fontWeight: 600, color: '#86efac', marginBottom: '0.5rem' }}>
              {result.type === 'block' ? 'Block found' : result.type === 'contract' ? 'Contract deployment found' : 'Transaction found'}
            </div>
            {result.type === 'block' ? (
              <>
                <div style={{ display: 'grid', gap: '0.35rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#e2e8f0' }}>
                  <div>Block: #{result.blockNumber}</div>
                  <div>Hash: <span style={{ wordBreak: 'break-all' }}>{result.blockHash}</span></div>
                  <div>Transactions: {result.txCount}</div>
                  <div>Timestamp: {result.timestamp != null ? new Date(Number(result.timestamp) * 1000).toLocaleString() : '—'}</div>
                  {result.parentHash && <div>Parent: <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{String(result.parentHash).slice(0, 26)}...</span></div>}
                </div>
                {result.transactions?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ fontWeight: 600, color: '#86efac', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Transactions in block ({result.transactions.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {result.transactions.map((tx, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.5rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '0.35rem',
                            fontSize: '0.8rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', flex: '1 1 100%', maxWidth: '100%' }}>
                            {String(tx.hash).slice(0, 18)}...{String(tx.hash).slice(-8)}
                          </span>
                          {tx.from && <span style={{ color: '#94a3b8' }}>From: {String(tx.from).slice(0, 10)}...</span>}
                          {tx.to ? <span style={{ color: '#94a3b8' }}>To: {String(tx.to).slice(0, 10)}...</span> : <span style={{ color: '#f59e0b' }}>Contract creation</span>}
                          {tx.value != null && tx.value !== undefined && (
                            <span style={{ color: '#86efac' }}>
                              {(() => {
                                try {
                                  const v = typeof tx.value === 'bigint' ? tx.value : BigInt(tx.value);
                                  const eth = Number(v / 1000000000000000n) / 1000;
                                  return eth >= 0.0001 ? eth.toFixed(4) + ' ETH' : '—';
                                } catch { return '—'; }
                              })()}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tx.hash)}
                            style={{ padding: '0.15rem 0.35rem', background: '#334155', border: 'none', borderRadius: '0.25rem', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Copy hash
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : result.type === 'tx' ? (
              <>
                <div style={{ display: 'grid', gap: '0.35rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#e2e8f0' }}>
                  <div>Block: #{result.blockNumber} {result.blockHash && <span style={{ color: '#94a3b8' }}>· {String(result.blockHash).slice(0, 22)}...</span>}</div>
                  <div>Tx: <span style={{ wordBreak: 'break-all' }}>{result.txHash}</span></div>
                  <div>From: {result.from}</div>
                  {result.to && <div>To: {result.to}</div>}
                  {result.contractAddress && <div>Contract created: {result.contractAddress}</div>}
                  {result.value != null && (
                    <div>Value: {(() => {
                      try {
                        const v = typeof result.value === 'bigint' ? result.value : BigInt(result.value);
                        return v === 0n ? '0 ETH' : (Number(v) / 1e18).toFixed(6) + ' ETH';
                      } catch { return '—'; }
                    })()}</div>
                  )}
                </div>
                {result.logs?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ fontWeight: 600, color: '#86efac', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      Events ({result.logs.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', fontSize: '0.75rem' }}>
                      {result.logs.map((log, i) => {
                        const isTransfer = String(log.topics?.[0] ?? '').toLowerCase() === TRANSFER_TOPIC.toLowerCase();
                        return (
                          <div key={i} style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.35rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {isTransfer ? (
                              <div style={{ color: '#86efac', fontWeight: 600 }}>Transfer(from, to, tokenId)</div>
                            ) : (
                              <div>Topic0: {String(log.topics?.[0] ?? '').slice(0, 20)}...</div>
                            )}
                            {log.topics?.length > 1 && <div style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>Topics 1–3: from, to, tokenId</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => copyToClipboard(result.txHash)} style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', background: '#334155', border: 'none', borderRadius: '0.35rem', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}>
                  Copy tx hash
                </button>
              </>
            ) : (
              <div style={{ display: 'grid', gap: '0.35rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#e2e8f0' }}>
                <div>Block: #{result.blockNumber} {result.blockHash && <span style={{ color: '#94a3b8' }}>· {String(result.blockHash).slice(0, 22)}...</span>}</div>
                <div>Tx: <span style={{ wordBreak: 'break-all' }}>{result.txHash}</span></div>
                <div>From: {result.from}</div>
                {result.contractAddress && <div>Contract: {result.contractAddress}</div>}
                {result.to && <div>To: {result.to}</div>}
              </div>
            )}
            {result.type === 'contract' && result.allBlocks?.length > 0 && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ fontWeight: 600, color: '#86efac', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  All blocks with transactions ({result.allBlocks.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {result.allBlocks.map((blk, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '0.35rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#e2e8f0', minWidth: '4rem' }}>#{blk.blockNumber}</span>
                      {blk.isDeployment && (
                        <span style={{ background: '#475569', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                          deployment
                        </span>
                      )}
                      {blk.txHash && (
                        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {String(blk.txHash).slice(0, 18)}...
                        </span>
                      )}
                      {blk.blockHash && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(blk.blockHash)}
                          style={{ marginLeft: 'auto', padding: '0.15rem 0.35rem', background: '#334155', border: 'none', borderRadius: '0.25rem', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          Copy block hash
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.blockHash && !(result.type === 'contract' && result.allBlocks?.length > 0) && (
              <button
                type="button"
                onClick={() => copyToClipboard(result.blockHash)}
                style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', background: '#334155', border: 'none', borderRadius: '0.35rem', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Copy block hash
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
